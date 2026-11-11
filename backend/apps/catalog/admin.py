from django.contrib import admin

from apps.catalog.models import Product, ProductVariant, TemplateApproval, TemplateDefinition, TemplateVersion


class ProductVariantInline(admin.TabularInline):
    model = ProductVariant
    extra = 0


@admin.register(TemplateDefinition)
class TemplateDefinitionAdmin(admin.ModelAdmin):
    list_display = ('template_key', 'title', 'geometry_mode', 'updated_at')
    search_fields = ('template_key', 'title')


@admin.register(TemplateVersion)
class TemplateVersionAdmin(admin.ModelAdmin):
    list_display = ('template', 'version', 'engine_version', 'is_current', 'created_at')
    list_filter = ('is_current',)
    search_fields = ('template__template_key', 'version')


@admin.register(TemplateApproval)
class TemplateApprovalAdmin(admin.ModelAdmin):
    list_display = ('template_version', 'approved', 'approved_at')
    list_filter = ('approved',)


@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = ('slug', 'name', 'category', 'status', 'default_template', 'sort_order')
    list_filter = ('status', 'category')
    search_fields = ('slug', 'name')
    prepopulated_fields = {'slug': ('name',)}
    inlines = [ProductVariantInline]
