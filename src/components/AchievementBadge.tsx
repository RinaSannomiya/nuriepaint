// ぬりえの記録ページの「バッジ」タブで使う達成バッジ。
// 画像アセットを増やさずに済むよう、アイコンはインラインSVG。tier(種類)ごとに形と色を変えて見分けやすくする
// （とくべつ=星、ぬった数=メダル、カテゴリー制覇=盾、クイズ=はかせのぼうし）。
export type AchievementTier = 'special' | 'milestone' | 'category' | 'quiz'

export type Achievement = {
  id: string
  title: string
  tier: AchievementTier
  earned: boolean
  count?: number
  total?: number
}

// tierごとのアイコン。塗りは共通クラス（achievementIconShape / achievementIconInner）に任せ、
// 形だけをここで出し分ける。色は App.css 側で tier とロック状態にあわせて切り替える。
function AchievementIconShape(props: { tier: AchievementTier }) {
  switch (props.tier) {
    case 'special':
      // 星（はじめての行動でもらえる、特別な1回性のバッジ）
      return (
        <>
          <polygon className="achievementIconShape" points="24,8 27.9,18.7 39.2,19.1 30.3,26 33.4,36.9 24,30.6 14.6,36.9 17.7,26 8.8,19.1 20.1,18.7" />
          <circle className="achievementIconInner" cx="24" cy="22" r="4" />
        </>
      )
    case 'category':
      // 盾（カテゴリーのぬりえを全部ぬった「マスター」バッジ）
      return (
        <>
          <path className="achievementIconShape" d="M24 5 L38 10 L38 23 C38 34 31 41 24 44 C17 41 10 34 10 23 L10 10 Z" />
          <circle className="achievementIconInner" cx="24" cy="23" r="5" />
        </>
      )
    case 'quiz':
      // はかせのぼうし（クイズ全問正解でもらえる「はかせ」バッジ）
      return (
        <>
          <polygon className="achievementIconShape" points="24,9 41,19 24,27 7,19" />
          <path className="achievementIconShape" d="M15 22 L33 22 L30 34 L18 34 Z" />
          <circle className="achievementIconInner" cx="24" cy="18.5" r="3" />
        </>
      )
    case 'milestone':
    default:
      // メダル（塗った枚数の節目でもらえるバッジ）
      return (
        <>
          <path className="achievementIconShape" d="M14 26 L8 43 L24 35 L40 43 L34 26 Z" />
          <circle className="achievementIconShape" cx="24" cy="18" r="15" />
          <circle className="achievementIconInner" cx="24" cy="18" r="10" />
        </>
      )
  }
}

export function AchievementBadge(props: { achievement: Achievement }) {
  const { title, tier, earned, count, total } = props.achievement
  const showCount = typeof total === 'number' && total > 1
  return (
    <li className={`achievementCard achievementCard-${tier} ${earned ? 'achievementEarned' : 'achievementLocked'}`}>
      <span className="achievementIcon" aria-hidden="true">
        <svg viewBox="0 0 48 48" width="36" height="36">
          <AchievementIconShape tier={tier} />
        </svg>
      </span>
      <span className="achievementTitle">{title}</span>
      {showCount ? <span className="achievementCount">{count ?? 0}/{total}</span> : null}
    </li>
  )
}
