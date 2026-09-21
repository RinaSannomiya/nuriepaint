// 大カテゴリーの中で、小カテゴリーをしぼりこむ「チップ」の行（すべて／どうぶつ／とり…）。
// あそぶ・マイギャラリー・ぬりえの記録・ひろげるで共通に使う。activeId が null のときは「すべて」が選ばれている。
export type CategoryChipItem = {
  id: string
  label: string
  /** チップの右に小さく出す数（枚数や「ぬった数/全部」など） */
  note?: string | number
}

export function CategoryChips(props: {
  items: CategoryChipItem[]
  activeId: string | null
  onChange: (id: string | null) => void
  ariaLabel: string
  allNote?: string | number
  /** 小さめの見た目（マイギャラリー・記録・ひろげる用） */
  compact?: boolean
  className?: string
}) {
  const { activeId, onChange } = props
  return (
    <nav className={`categoryChips ${props.compact ? 'compactChips' : ''} ${props.className ?? ''}`} aria-label={props.ariaLabel}>
      <button
        type="button"
        className={`categoryChip ${activeId === null ? 'activeChip' : ''}`}
        aria-pressed={activeId === null}
        onClick={() => onChange(null)}
      >
        すべて
        {props.allNote != null ? <small className="categoryChipNote">{props.allNote}</small> : null}
      </button>
      {props.items.map((item) => (
        <button
          key={item.id}
          type="button"
          className={`categoryChip ${activeId === item.id ? 'activeChip' : ''}`}
          aria-pressed={activeId === item.id}
          onClick={() => onChange(item.id)}
        >
          {item.label}
          {item.note != null ? <small className="categoryChipNote">{item.note}</small> : null}
        </button>
      ))}
    </nav>
  )
}
