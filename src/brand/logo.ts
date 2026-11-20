import { computed, type ComputedRef } from 'vue'
import { useI18n } from 'vue-i18n'
import logoEn from '../assets/brand/packgrida-logo-en.png'
import logoKo from '../assets/brand/packgrida-logo-ko.png'

export const BRAND_NAME = 'PACKGRIDA'

/** zh-CN: English wordmark; ko-KR: EN + 한글 bilingual lockup. */
export function brandLogoForLocale(locale: string): string {
  return locale === 'ko-KR' ? logoKo : logoEn
}

export function useBrandLogo(): {
  logoUrl: ComputedRef<string>
  brandName: string
} {
  const { locale } = useI18n()
  const logoUrl = computed(() => brandLogoForLocale(String(locale.value || 'zh-CN')))
  return { logoUrl, brandName: BRAND_NAME }
}
