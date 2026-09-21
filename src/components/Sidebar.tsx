import { useEffect, useRef } from 'react'
import { ILLUSTRATIONS, type IllustrationDef, type IllustrationId } from '../illustrations/illustrations'
import { IllustrationThumb } from './IllustrationThumb'
import { CheckBadge, type CheckKind } from './CheckBadge'

export function Sidebar(props: { selected: IllustrationId | null; illustrations?: IllustrationDef[]; checkedIds?: Set<string>; checkKind?: CheckKind; onSelect: (id: IllustrationId) => void; onBackToCategories?: () => void; backLabel?: string; scrollToTopToken?: number }) {
  const illustrations = props.illustrations ?? ILLUSTRATIONS
  const cardsRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!props.scrollToTopToken) return
    const container = cardsRef.current
    if (!container) return
    window.requestAnimationFrame(() => {
      const activeEl = container.querySelector<HTMLElement>('.cardBtn.active')
      if (!activeEl) return
      const containerRect = container.getBoundingClientRect()
      const activeRect = activeEl.getBoundingClientRect()
      container.scrollTop += activeRect.top - containerRect.top
    })
  }, [props.scrollToTopToken])
  return (
    <div className="sidebar">
      <div className="sidebarTitle">
        <span>イラスト</span>
        {props.onBackToCategories ? (
          <button className="sidebarCategoryBackButton" type="button" onClick={props.onBackToCategories}>
            {props.backLabel ?? 'カテゴリー選択へ'}
          </button>
        ) : null}
      </div>
      <div className="cards" role="list" ref={cardsRef}>
        {illustrations.map((it, idx) => {
          const active = props.selected === it.id
          return (
            <button
              key={it.id}
              type="button"
              className={`cardBtn ${active ? 'active' : ''}`}
              onClick={() => props.onSelect(it.id)}
              role="listitem"
              style={{ ['--stagger' as never]: `${Math.min(idx, 12)}` }}
            >
              {props.checkedIds?.has(it.id) ? <CheckBadge kind={props.checkKind ?? 'learned'} className="sidebarLearnedBadge" /> : null}
              <div className="cardThumb" aria-hidden="true">
                <div className="thumbPaper">
                  <IllustrationThumb illustration={it} />
                </div>
              </div>
              <div className="cardMeta">
                <div className="cardTitle">{it.title}</div>
                <div className="cardSub">{it.subtitle}</div>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
