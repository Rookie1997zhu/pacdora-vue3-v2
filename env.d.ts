/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE: string
  readonly VITE_ROOT_HOME: string
  readonly GITHUB_PAGES?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<object, object, unknown>
  export default component
}

declare module 'vue-konva' {
  import type { Plugin } from 'vue'
  const VueKonva: Plugin
  export default VueKonva
}

declare module '@/knife.js'
declare module '../knife.js'
declare module '../../knife.js'
