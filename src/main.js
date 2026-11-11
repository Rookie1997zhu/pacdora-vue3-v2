import {createApp} from 'vue'
import {createPinia} from 'pinia'
import VueKonva from 'vue-konva'
import App from './App.vue'
import {i18n} from './i18n/index.js'
import router from './router/index.ts'
import './style.css'

createApp(App).use(createPinia()).use(router).use(i18n).use(VueKonva).mount('#app')
