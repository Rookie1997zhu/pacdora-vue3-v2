from rest_framework.authentication import SessionAuthentication


class SessionAuthentication401(SessionAuthentication):
    """Return WWW-Authenticate so unauthenticated requests become 401, not 403."""

    def authenticate_header(self, request):
        return 'Session'
