import {createApp} from 'vue'
import {createPinia} from 'pinia'
import VueKonva from 'vue-konva'
import lottie from 'lottie-web'
import {defineElement} from '@lordicon/element'
import App from './App.vue'
import {i18n, initLocaleFromHint} from './i18n/index.js'
import router from './router/index.ts'
import {installRouteSeo} from './seo/routeMeta.ts'
import {API_BASE} from './api/client.ts'
import './style.css'

defineElement(lottie.loadAnimation)

async function boot(){
  await initLocaleFromHint(API_BASE, 1500)
  installRouteSeo(router)
  createApp(App).use(createPinia()).use(router).use(i18n).use(VueKonva).mount('#app')
}

boot()
