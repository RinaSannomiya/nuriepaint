// ぬりえカードにつけるチェックマーク。
// learned: クイズに正解した（緑） / saved: マイギャラリーに作品を保存している（コーラルレッド）
export type CheckKind = 'learned' | 'saved'

const CHECK_ICONS: Record<CheckKind, { src: string; label: string }> = {
  learned: { src: '/icons/check-green.png', label: '覚えた' },
  saved: { src: '/icons/check-coral.png', label: 'マイギャラリーに保存ずみ' },
}

export function CheckBadge(props: { kind: CheckKind; className?: string; label?: string }) {
  const icon = CHECK_ICONS[props.kind]
  return (
    <span className={`learnedBadge ${props.className ?? ''}`} role="img" aria-label={props.label ?? icon.label}>
      <img src={icon.src} alt="" draggable={false} />
    </span>
  )
}
