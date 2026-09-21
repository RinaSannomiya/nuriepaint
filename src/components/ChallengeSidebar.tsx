import type { IllustrationDef } from '../illustrations/illustrations'
import { CheckBadge } from './CheckBadge'
import { IllustrationThumb } from './IllustrationThumb'

export type ChallengeAnswered = { illustration: IllustrationDef | null; correct: boolean }

// チャレンジモード中、左のイラスト一覧の代わりに出す「進み具合」の表示。
// 何問中何問目か・正解数・答え合わせが終わったぬりえの見本（1問目が上、下へ順番に）・リセット（1問目からやりなおし）
export function ChallengeSidebar(props: {
  total: number
  current: number
  correct: number
  answered: ChallengeAnswered[]
  onReset: () => void
}) {
  const done = props.answered.length
  const items = props.answered.map((item, index) => ({ ...item, number: index + 1 }))
  return (
    <div className="sidebar challengeSidebar">
      <div className="sidebarTitle">
        <span>ぬりえテスト</span>
        <button className="sidebarCategoryBackButton" type="button" onClick={props.onReset}>
          リセット
        </button>
      </div>
      <div className="challengeSummary">
        <div className="challengeStats">
          <div className="challengeStat">
            <span>もんだい</span>
            <strong>
              {props.current}
              <small>/ {props.total}</small>
            </strong>
          </div>
          <div className="challengeStat challengeStatCorrect">
            <span>正解</span>
            <strong>
              {props.correct}
              <small>問</small>
            </strong>
          </div>
        </div>
        <div className="challengeMeter" role="progressbar" aria-label="ぬりえテストの進み具合" aria-valuemin={0} aria-valuemax={props.total} aria-valuenow={done}>
          <i style={{ width: `${props.total ? (done / props.total) * 100 : 0}%` }} />
        </div>
      </div>
      <div className="cards" role="list">
        {items.length ? (
          items.map((item) => {
            const illustration = item.illustration
            if (!illustration) return null
            return (
              <div className="cardBtn challengeAnsweredCard" key={item.number} role="listitem">
                {item.correct ? (
                  <CheckBadge kind="learned" className="sidebarLearnedBadge" label="正解" />
                ) : (
                  <span className="challengeMissBadge" role="img" aria-label="ふせいかい">×</span>
                )}
                <div className="cardThumb" aria-hidden="true">
                  <div className="thumbPaper">
                    {illustration.referenceImage ? (
                      <img className="thumbImage" src={illustration.referenceImage} alt="" loading="lazy" decoding="async" draggable={false} />
                    ) : (
                      <IllustrationThumb illustration={illustration} />
                    )}
                  </div>
                </div>
                <div className="cardMeta">
                  <div className="cardTitle">{illustration.title}</div>
                  <div className="cardSub">{item.number}問目</div>
                </div>
              </div>
            )
          })
        ) : null}
      </div>
    </div>
  )
}
