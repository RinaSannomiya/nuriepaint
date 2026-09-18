import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// スマホでページを開いたとき、ブラウザのスクロール位置の復元や読み込み後のずれで
// 少し下にスクロールされた状態から始まらないよう、最初は必ず一番上から表示する。
if ('scrollRestoration' in window.history) window.history.scrollRestoration = 'manual'
{
  let userScrolled = false
  const markUserScrolled = () => {
    userScrolled = true
  }
  for (const type of ['touchstart', 'wheel', 'keydown', 'mousedown'] as const) {
    window.addEventListener(type, markUserScrolled, { once: true, passive: true })
  }
  const scrollToTop = () => {
    if (userScrolled) return
    window.scrollTo(0, 0)
  }
  scrollToTop()
  // 画像・フォントの読み込みが終わったあとにもう一度（操作前なら）先頭へ戻す
  window.addEventListener('load', scrollToTop, { once: true })
  // 戻る／進むでページがキャッシュから復元されたときも先頭から
  window.addEventListener('pageshow', (e) => {
    if (e.persisted) window.scrollTo(0, 0)
  })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
