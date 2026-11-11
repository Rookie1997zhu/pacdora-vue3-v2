from __future__ import annotations

from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import exception_handler as drf_exception_handler


def ok(data=None, message='成功', code='OK', request=None, http_status=status.HTTP_200_OK):
    payload = {
        'code': code,
        'message': message,
        'data': data,
        'request_id': getattr(request, 'request_id', None) if request is not None else None,
    }
    return Response(payload, status=http_status)


def fail(
    message='错误',
    *,
    code='ERROR',
    errors=None,
    request=None,
    http_status=status.HTTP_400_BAD_REQUEST,
):
    payload = {
        'code': code,
        'message': message,
        'data': None,
        'errors': errors or {},
        'request_id': getattr(request, 'request_id', None) if request is not None else None,
    }
    return Response(payload, status=http_status)


def exception_handler(exc, context):
    response = drf_exception_handler(exc, context)
    request = context.get('request')
    request_id = getattr(request, 'request_id', None) if request is not None else None
    if response is None:
        return fail(
            message=str(exc),
            code='SERVER_ERROR',
            request=request,
            http_status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )
    errors = response.data if isinstance(response.data, dict) else {'detail': [str(response.data)]}
    message = '请求失败'
    if isinstance(response.data, dict) and 'detail' in response.data:
        detail = response.data['detail']
        message = detail if isinstance(detail, str) else str(detail)
    code = 'HTTP_ERROR'
    if response.status_code == 401:
        code = 'UNAUTHORIZED'
    elif response.status_code == 403:
        code = 'FORBIDDEN'
    elif response.status_code == 404:
        code = 'NOT_FOUND'
    elif response.status_code == 409:
        code = 'CONFLICT'
    response.data = {
        'code': code,
        'message': message,
        'data': None,
        'errors': errors,
        'request_id': request_id,
    }
    return response
