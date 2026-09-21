import { useCallback, useLayoutEffect, useMemo, useRef, type KeyboardEvent, type PointerEvent } from 'react'

// CSS の --drum-item-h（.drumRoll）と同じ高さにする
const ITEM_HEIGHT = 40

// ドラムロール（回転式）の数値選択。
// 上下にスクロールして、まん中の帯に止まった数字が選ばれる。
// - スマホ・タブレット: 指でスクロール（スクロールスナップで数字にぴたっと止まる）
// - PC: マウスホイール／ドラッグ／数字をクリック／キーボード（↑↓・PageUp/PageDown・Home/End）
export function DrumRoll(props: {
  min: number
  max: number
  value: number
  onChange: (value: number) => void
  unit?: string
  label: string
}) {
  const { min, max, value, onChange } = props
  const listRef = useRef<HTMLDivElement | null>(null)
  const guardRef = useRef(false)
  const guardTimerRef = useRef<number | undefined>(undefined)
  const firstRef = useRef(true)
  const dragRef = useRef<{ startY: number; startTop: number; moved: boolean } | null>(null)
  const suppressClickRef = useRef(false)
  const numbers = useMemo(() => Array.from({ length: Math.max(0, max - min + 1) }, (_, index) => min + index), [min, max])

  // プログラムでスクロールしている間（＋−ボタンなど）は、途中の位置を「選ばれた数字」として拾わない。
  // スクロールが止まって少ししたら解除する。
  const armGuard = useCallback((ms: number) => {
    guardRef.current = true
    window.clearTimeout(guardTimerRef.current)
    guardTimerRef.current = window.setTimeout(() => {
      guardRef.current = false
    }, ms)
  }, [])

  const scrollToIndex = useCallback((index: number, smooth: boolean) => {
    const el = listRef.current
    if (!el) return
    armGuard(smooth ? 200 : 80)
    el.scrollTo({ top: index * ITEM_HEIGHT, behavior: smooth ? 'smooth' : 'auto' })
  }, [armGuard])

  // 外から value が変わったとき（＋−ボタンなど）に、その数字までまわす。最初の表示だけは一瞬で合わせる。
  useLayoutEffect(() => {
    const el = listRef.current
    if (!el) return
    const index = Math.max(0, Math.min(numbers.length - 1, Math.round(value) - min))
    if (firstRef.current) {
      firstRef.current = false
      scrollToIndex(index, false)
      return
    }
    if (Math.abs(el.scrollTop - index * ITEM_HEIGHT) > ITEM_HEIGHT / 2) scrollToIndex(index, true)
  }, [value, min, numbers.length, scrollToIndex])

  useLayoutEffect(() => () => window.clearTimeout(guardTimerRef.current), [])

  function handleScroll() {
    const el = listRef.current
    if (!el) return
    if (guardRef.current) {
      armGuard(120)
      return
    }
    const index = Math.max(0, Math.min(numbers.length - 1, Math.round(el.scrollTop / ITEM_HEIGHT)))
    if (min + index !== value) onChange(min + index)
  }

  function handleKeyDown(ev: KeyboardEvent<HTMLDivElement>) {
    const steps: Record<string, number> = { ArrowUp: -1, ArrowLeft: -1, ArrowDown: 1, ArrowRight: 1, PageUp: -10, PageDown: 10 }
    let next: number | null = null
    if (ev.key in steps) next = value + steps[ev.key]
    else if (ev.key === 'Home') next = min
    else if (ev.key === 'End') next = max
    if (next === null) return
    ev.preventDefault()
    onChange(Math.max(min, Math.min(max, next)))
  }

  // マウスのドラッグでもまわせるようにする（タッチはブラウザ標準のスクロールに任せる）
  function handlePointerDown(ev: PointerEvent<HTMLDivElement>) {
    const el = listRef.current
    if (!el || ev.pointerType !== 'mouse' || ev.button !== 0) return
    dragRef.current = { startY: ev.clientY, startTop: el.scrollTop, moved: false }
  }

  function handlePointerMove(ev: PointerEvent<HTMLDivElement>) {
    const el = listRef.current
    const drag = dragRef.current
    if (!el || !drag) return
    const dy = ev.clientY - drag.startY
    if (!drag.moved) {
      if (Math.abs(dy) < 4) return
      drag.moved = true
      el.setPointerCapture(ev.pointerId)
      el.classList.add('dragging')
    }
    el.scrollTop = drag.startTop - dy
  }

  function finishDrag() {
    const el = listRef.current
    const drag = dragRef.current
    dragRef.current = null
    if (!el || !drag?.moved) return
    el.classList.remove('dragging')
    suppressClickRef.current = true
    window.setTimeout(() => {
      suppressClickRef.current = false
    }, 0)
    scrollToIndex(Math.max(0, Math.min(numbers.length - 1, Math.round(el.scrollTop / ITEM_HEIGHT))), true)
  }

  return (
    <div
      className="drumRoll"
      role="spinbutton"
      tabIndex={0}
      aria-label={props.label}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={value}
      aria-valuetext={`${value}${props.unit ?? ''}`}
      onKeyDown={handleKeyDown}
    >
      <div className="drumRollBand" aria-hidden="true">
        {props.unit ? <span className="drumRollUnit">{props.unit}</span> : null}
      </div>
      <div
        className="drumRollList"
        ref={listRef}
        onScroll={handleScroll}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={finishDrag}
        onPointerCancel={finishDrag}
      >
        {numbers.map((number) => {
          const distance = Math.abs(number - value)
          const tone = distance === 0 ? 'isSelected' : distance === 1 ? 'isNear' : distance === 2 ? 'isFar' : 'isEdge'
          return (
            <div
              key={number}
              className={`drumRollItem ${tone}`}
              aria-hidden="true"
              onClick={() => {
                if (!suppressClickRef.current) onChange(number)
              }}
            >
              {number}
            </div>
          )
        })}
      </div>
    </div>
  )
}
