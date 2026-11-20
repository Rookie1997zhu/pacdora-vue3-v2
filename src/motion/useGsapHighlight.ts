import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { nextTick, onBeforeUnmount, onMounted, watch, type Ref } from 'vue'
import { prefersReducedMotion } from './presets'

gsap.registerPlugin(ScrollTrigger)

/** Home hero: title / lead / CTA 分步显现（不与 Motion 叠长动画）. */
export function useHomeHeroGsap(root: Ref<HTMLElement | null>) {
  let ctx: gsap.Context | null = null
  let ran = false

  onMounted(() => {
    void nextTick(() => {
      if (ran) return
      ran = true
      const el = root.value
      if (!el) return
      const targets = ['.brand-logo', 'h1', '.lead', '.cta']
        .map((sel) => el.querySelector(sel))
        .filter(Boolean) as Element[]
      if (prefersReducedMotion()) {
        // Never leave copy invisible if a previous visit left inline styles.
        gsap.set(targets, { clearProps: 'opacity,transform' })
        return
      }
      const [logo, title, lead, cta] = targets
      ctx = gsap.context(() => {
        gsap.set(targets, { opacity: 0, y: 10 })
        const tl = gsap.timeline({ defaults: { ease: 'power2.out', duration: 0.45 } })
        if (logo) tl.to(logo, { opacity: 1, y: 0 }, 0)
        if (title) tl.to(title, { opacity: 1, y: 0 }, 0.08)
        if (lead) tl.to(lead, { opacity: 1, y: 0 }, 0.16)
        if (cta) tl.to(cta, { opacity: 1, y: 0 }, 0.24)
      }, el)
    })
  })

  onBeforeUnmount(() => {
    ctx?.revert()
    ctx = null
  })
}

/** Blog detail: 正文 h2 进入视口时短 fade-up，各标题只触发一次. */
export function useBlogBodyHeadingGsap(body: Ref<HTMLElement | null>) {
  let ctx: gsap.Context | null = null

  function bind() {
    ctx?.revert()
    ctx = null
    const el = body.value
    if (!el || prefersReducedMotion()) return
    const headings = el.querySelectorAll('h2')
    if (!headings.length) return
    ctx = gsap.context(() => {
      headings.forEach((h) => {
        gsap.fromTo(
          h,
          { opacity: 0, y: 10 },
          {
            opacity: 1,
            y: 0,
            duration: 0.4,
            ease: 'power2.out',
            scrollTrigger: {
              trigger: h,
              start: 'top 88%',
              once: true,
            },
          },
        )
      })
    }, el)
  }

  watch(
    body,
    async (el) => {
      if (!el) {
        ctx?.revert()
        ctx = null
        return
      }
      await nextTick()
      bind()
    },
    { flush: 'post' },
  )

  onBeforeUnmount(() => {
    ctx?.revert()
    ctx = null
  })
}
