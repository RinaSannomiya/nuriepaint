import { ILLUSTRATIONS, type IllustrationId } from '../illustrations/illustrations'

export function PickerDialog(props: {
  open: boolean
  selected: IllustrationId | null
  onClose: () => void
  onPick: (id: IllustrationId) => void
}) {
  if (!props.open) return null

  return (
    <div className="modalOverlay" role="dialog" aria-modal="true" aria-label="イラスト選択">
      <div className="modal">
        <div className="modalHead">
          <div>
            <div className="modalTitle">塗り絵を選ぶ</div>
            <div className="modalSub">クリックしたイラストがメインに表示されます。</div>
          </div>
          <button className="btn" type="button" onClick={props.onClose} aria-label="閉じる">
            閉じる
          </button>
        </div>

        <div className="modalGrid">
          {ILLUSTRATIONS.map((it) => {
            const active = props.selected === it.id
            return (
              <button
                key={it.id}
                type="button"
                className={`pickCard ${active ? 'active' : ''}`}
                onClick={() => props.onPick(it.id)}
              >
                <div className="pickThumb" aria-hidden="true">
                  <div className="thumbPaper">
                    {it.node({
                      fills: {},
                      onPaint: () => {},
                    })}
                  </div>
                </div>
                <div className="pickMeta">
                  <div className="pickTitle">{it.title}</div>
                  <div className="pickSub">{it.subtitle}</div>
                </div>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

