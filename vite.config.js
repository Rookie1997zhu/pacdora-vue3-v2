import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/** GitHub Pages 项目页需要仓库名作为 base；本地开发用 / */
const pagesBase=process.env.GITHUB_PAGES==='1'?'/pacdora-vue3-v2/':'/'

export default defineConfig({
  plugins:[vue({
    template:{
      compilerOptions:{
        isCustomElement:(tag)=>tag==='lord-icon',
      },
    },
  })],
  base:pagesBase,
  resolve:{
    alias:[
      {find:'@packative-lab',replacement:path.resolve(__dirname,'research/packative-dieline-lab/src')},
      // 结构规格（数 MB）不进浏览器包：引擎里对 structureSpecs.js 的导入换成空占位，
      // 规格本体按盒型从 public/spec/ 懒加载（src/templates/lazy.js）。Node 端不经过 Vite，仍读完整文件。
      {find:/^.*\/catalog\/structureSpecs\.js$/,replacement:path.resolve(__dirname,'src/catalog/structureSpecs.browser.js')},
      // 「按尺寸插值」模板的数据同理：Node 端读 public/sampled，浏览器端按盒型懒加载
      {find:/^.*\/catalog\/sampledTemplates\.js$/,replacement:path.resolve(__dirname,'src/catalog/sampledTemplates.browser.js')},
    ],
  },
  server:{
    proxy:{
      '/api':{
        target:'http://127.0.0.1:8000',
        changeOrigin:true
      }
    }
  },
  build:{
    chunkSizeWarningLimit:1200,
    rollupOptions:{
      output:{
        manualChunks(id){
          if(!id.includes('node_modules')) return
          if(/[\\/]node_modules[\\/](three)[\\/]/.test(id)) return 'three'
          if(/[\\/]node_modules[\\/](konva|vue-konva)[\\/]/.test(id)) return 'konva'
          if(/[\\/]node_modules[\\/](lottie-web)[\\/]/.test(id)) return 'lottie'
          if(/[\\/]node_modules[\\/](motion-v|gsap)[\\/]/.test(id)) return 'motion'
          if(/[\\/]node_modules[\\/](pdf-lib|polygon-clipping)[\\/]/.test(id)) return 'geom'
          if(/[\\/]node_modules[\\/](vue|vue-router|pinia|vue-i18n)[\\/]/.test(id)) return 'vue-core'
        },
      },
    },
  },
})
