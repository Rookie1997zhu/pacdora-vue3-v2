/**
 * 浏览器端占位：结构规格不随引擎打包，按盒型从 public/spec/ 懒加载（见 src/templates/lazy.js）。
 * vite.config.js 把对 structureSpecs.js 的导入别名到本文件；Node 端仍读完整的 structureSpecs.js。
 */
export default {from:'lazy',specs:[]}
