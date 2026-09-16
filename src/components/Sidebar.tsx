import { ILLUSTRATIONS, type IllustrationDef, type IllustrationId } from '../illustrations/illustrations'
import { IllustrationThumb } from './IllustrationThumb'

export function Sidebar(props: { selected: IllustrationId | null; illustrations?: IllustrationDef[]; learnedIds?: Set<string>; onSelect: (id: IllustrationId) => void; onBackToCategories?: () => void }) {
  const illustrations = props.illustrations ?? ILLUSTRATIONS
  return (
    <div className="sidebar">
      <div className="sidebarTitle">
        <span>イラスト</span>
        {props.onBackToCategories ? (
          <button className="sidebarCategoryBackButton" type="button" onClick={props.onBackToCategories}>
            カテゴリー選択へ
          </button>
        ) : null}
      </div>
      <div className="cards" role="list">
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
              {props.learnedIds?.has(it.id) ? <span className="learnedBadge sidebarLearnedBadge" aria-label="覚えた">✓</span> : null}
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
