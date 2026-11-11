from __future__ import annotations

import hashlib
import secrets
from datetime import timedelta

from django.conf import settings
from django.contrib.auth import login, logout
from django.core.mail import send_mail
from django.middleware.csrf import get_token
from django.utils import timezone
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_protect, ensure_csrf_cookie
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.views import APIView

from apps.accounts.models import PasswordResetToken, User
from apps.accounts.serializers import (
    LoginSerializer,
    PasswordResetConfirmSerializer,
    PasswordResetRequestSerializer,
    RegisterSerializer,
    UserSerializer,
)
from apps.organizations.models import Membership, Organization
from apps.organizations.services import ensure_personal_org
from config.api import fail, ok


def user_payload(user):
    return UserSerializer(user).data


@method_decorator(ensure_csrf_cookie, name='dispatch')
class CsrfView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def get(self, request):
        token = get_token(request)
        return ok({'csrf_token': token}, message='CSRF ready', request=request)


@method_decorator(csrf_protect, name='dispatch')
class RegisterView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request):
        ser = RegisterSerializer(data=request.data)
        if not ser.is_valid():
            return fail('注册失败', code='VALIDATION_ERROR', errors=ser.errors, request=request)
        user = ser.save()
        ensure_personal_org(user)
        login(request, user)
        return ok({'user': user_payload(user)}, message='注册成功', request=request, http_status=201)


@method_decorator(csrf_protect, name='dispatch')
class LoginView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request):
        ser = LoginSerializer(data=request.data, context={'request': request})
        if not ser.is_valid():
            return fail('登录失败', code='AUTH_FAILED', errors=ser.errors, request=request, http_status=400)
        user = ser.validated_data['user']
        login(request, user)
        request.session.cycle_key()
        return ok({'user': user_payload(user)}, message='登录成功', request=request)


@method_decorator(csrf_protect, name='dispatch')
class LogoutView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        logout(request)
        return ok({}, message='已退出', request=request)


class MeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        memberships = (
            Membership.objects.filter(user=request.user, is_active=True)
            .select_related('organization')
            .order_by('organization__name')
        )
        orgs = [
            {
                'id': str(m.organization_id),
                'name': m.organization.name,
                'slug': m.organization.slug,
                'role': m.role,
            }
            for m in memberships
        ]
        return ok({'user': user_payload(request.user), 'organizations': orgs}, request=request)


@method_decorator(csrf_protect, name='dispatch')
class PasswordResetRequestView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request):
        ser = PasswordResetRequestSerializer(data=request.data)
        if not ser.is_valid():
            return fail('请求无效', code='VALIDATION_ERROR', errors=ser.errors, request=request)
        email = ser.validated_data['email'].lower().strip()
        delivery = 'blocked'
        user = User.objects.filter(email__iexact=email, is_active=True).first()
        if user:
            raw = secrets.token_urlsafe(32)
            token_hash = hashlib.sha256(raw.encode('utf-8')).hexdigest()
            PasswordResetToken.objects.create(
                user=user,
                token_hash=token_hash,
                expires_at=timezone.now() + timedelta(hours=2),
            )
            mode = getattr(settings, 'EMAIL_BACKEND_MODE', 'disabled')
            if mode == 'smtp':
                send_mail(
                    subject='BOXCRAFT 密码重置',
                    message=f'重置令牌（测试用，生产应使用链接）: {raw}',
                    from_email=settings.DEFAULT_FROM_EMAIL,
                    recipient_list=[user.email],
                    fail_silently=False,
                )
                delivery = 'smtp'
            else:
                delivery = 'blocked'
        # Anti-enumeration: same message whether user exists
        return ok(
            {'delivery': delivery},
            message='若邮箱存在，已受理重置请求',
            request=request,
        )


@method_decorator(csrf_protect, name='dispatch')
class PasswordResetConfirmView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request):
        ser = PasswordResetConfirmSerializer(data=request.data)
        if not ser.is_valid():
            return fail('请求无效', code='VALIDATION_ERROR', errors=ser.errors, request=request)
        raw = ser.validated_data['token']
        token_hash = hashlib.sha256(raw.encode('utf-8')).hexdigest()
        row = (
            PasswordResetToken.objects.select_related('user')
            .filter(token_hash=token_hash, used_at__isnull=True, expires_at__gt=timezone.now())
            .first()
        )
        if not row:
            return fail('令牌无效或已过期', code='TOKEN_INVALID', request=request, http_status=400)
        user = row.user
        user.set_password(ser.validated_data['password'])
        user.save(update_fields=['password'])
        row.used_at = timezone.now()
        row.save(update_fields=['used_at'])
        return ok({}, message='密码已更新', request=request)
