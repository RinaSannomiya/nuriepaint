import { useSyncExternalStore } from 'react'

/** CSSのメディアクエリに合っているかどうかを返す（画面幅が変わったら自動で更新される） */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (notify) => {
      const mql = window.matchMedia(query)
      mql.addEventListener('change', notify)
      return () => mql.removeEventListener('change', notify)
    },
    () => window.matchMedia(query).matches,
    () => false,
  )
}
