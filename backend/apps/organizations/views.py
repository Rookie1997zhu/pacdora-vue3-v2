from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView

from apps.organizations.models import Membership
from config.api import fail, ok


class OrganizationListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        rows = (
            Membership.objects.filter(user=request.user, is_active=True)
            .select_related('organization')
            .order_by('organization__name')
        )
        items = [
            {
                'id': str(m.organization_id),
                'name': m.organization.name,
                'slug': m.organization.slug,
                'role': m.role,
            }
            for m in rows
        ]
        return ok({'items': items, 'page': 1, 'page_size': len(items), 'total': len(items)}, request=request)


class OrganizationDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, org_id):
        m = (
            Membership.objects.filter(
                user=request.user,
                organization_id=org_id,
                is_active=True,
            )
            .select_related('organization')
            .first()
        )
        if not m:
            return fail('无权访问该组织', code='FORBIDDEN', request=request, http_status=403)
        members = (
            Membership.objects.filter(organization_id=org_id, is_active=True)
            .select_related('user')
            .order_by('role', 'user__email')
        )
        return ok(
            {
                'id': str(m.organization_id),
                'name': m.organization.name,
                'slug': m.organization.slug,
                'role': m.role,
                'members': [
                    {
                        'user_id': str(x.user_id),
                        'email': x.user.email,
                        'display_name': x.user.display_name,
                        'role': x.role,
                    }
                    for x in members
                ],
            },
            request=request,
        )
