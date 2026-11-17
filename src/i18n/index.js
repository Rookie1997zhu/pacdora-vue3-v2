import {createI18n} from 'vue-i18n'
import zhCN from './zh-CN.js'
import koKR from './ko-KR.js'

export const LOCALE_KEY='boxcraft.locale'
export const LOCALE_COOKIE='boxcraft_locale'
export const LOCALES=['zh-CN','ko-KR']

function writeLocaleCookie(code){
  if(typeof document==='undefined')return
  const maxAge=60*60*24*365
  document.cookie=`${LOCALE_COOKIE}=${encodeURIComponent(code)}; path=/; max-age=${maxAge}; samesite=lax`
}

function readStoredLocale(){
  try{
    const v=localStorage.getItem(LOCALE_KEY)
    if(LOCALES.includes(v))return v
  }catch{/* ignore */}
  return null
}

function syncHtmlLang(code){
  if(typeof document!=='undefined'){
    document.documentElement.lang=code==='ko-KR'?'ko':'zh-CN'
  }
}

const stored=readStoredLocale()
const initial=stored||'zh-CN'
syncHtmlLang(initial)
if(stored)writeLocaleCookie(stored)

export const i18n=createI18n({
  legacy:false,
  locale:initial,
  fallbackLocale:'zh-CN',
  messages:{
    'zh-CN':zhCN,
    'ko-KR':koKR
  }
})

export function setLocale(code){
  if(!LOCALES.includes(code))return
  i18n.global.locale.value=code
  try{localStorage.setItem(LOCALE_KEY,code)}catch{/* ignore */}
  writeLocaleCookie(code)
  syncHtmlLang(code)
}

export function getLocale(){
  return i18n.global.locale.value
}

export function hasStoredLocale(){
  return !!readStoredLocale()
}

/** Resolve locale from API when user has not chosen manually. */
export async function initLocaleFromHint(apiBase='/api/v1', timeoutMs=1500){
  if(readStoredLocale())return getLocale()
  const ctrl=typeof AbortController!=='undefined'?new AbortController():null
  const timer=ctrl?setTimeout(()=>ctrl.abort(),timeoutMs):null
  try{
    const res=await fetch(`${apiBase.replace(/\/$/,'')}/site/locale-hint/`,{
      credentials:'include',
      headers:{Accept:'application/json'},
      signal:ctrl?ctrl.signal:undefined,
    })
    if(!res.ok)return getLocale()
    const body=await res.json()
    const locale=body?.data?.locale
    if(LOCALES.includes(locale)){
      // Do not persist as "user choice" — only apply for this visit unless they switch.
      i18n.global.locale.value=locale
      syncHtmlLang(locale)
      writeLocaleCookie(locale)
    }
  }catch{/* timeout / offline → keep default */}
  finally{
    if(timer)clearTimeout(timer)
  }
  return getLocale()
}
