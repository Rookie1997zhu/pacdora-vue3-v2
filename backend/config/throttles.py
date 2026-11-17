from rest_framework.throttling import SimpleRateThrottle

from apps.designs.models import Design


class RevisionSaveRateThrottle(SimpleRateThrottle):
    rate = '30/min'

    def get_cache_key(self, request, view):
        if request.method != 'POST' or not request.user.is_authenticated:
            return None
        return self.cache_format % {
            'scope': 'revision_save_user',
            'ident': request.user.pk,
        }


class OrganizationExportRateThrottle(SimpleRateThrottle):
    rate = '10/min'

    def get_cache_key(self, request, view):
        if request.method != 'POST' or not request.user.is_authenticated:
            return None
        design_id = view.kwargs.get('design_id')
        organization_id = (
            Design.objects.filter(pk=design_id)
            .values_list('organization_id', flat=True)
            .first()
        )
        if not organization_id:
            return None
        return self.cache_format % {
            'scope': 'export_create_org',
            'ident': organization_id,
        }
