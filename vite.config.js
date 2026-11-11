import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

/** GitHub Pages 项目页需要仓库名作为 base；本地开发用 / */
const pagesBase=process.env.GITHUB_PAGES==='1'?'/pacdora-vue3-v2/':'/'

export default defineConfig({
  plugins:[vue()],
  base:pagesBase,
  server:{
    proxy:{
      '/api':{
        target:'http://127.0.0.1:8000',
        changeOrigin:true
      },
      '/admin':{
        target:'http://127.0.0.1:8000',
        changeOrigin:true
      }
    }
  }
})
