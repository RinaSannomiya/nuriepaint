import type { IllustrationDef } from '../illustrations/illustrations'
import type { CSSProperties, PointerEvent, TouchList } from 'react'
import { useLayoutEffect, useRef, useState } from 'react'
import type { RasterPaintCommand } from '../illustrations/svgs/RasterLineArt'

const MAX_ART_ZOOM = 10

export function Stage(props: {
  illustration: IllustrationDef | null
  fills: Record<string, string>
  color?: string
  command?: RasterPaintCommand | null
  zoom: number
  onZoomChange: (zoom: number | ((value: number) => number)) => void
  eyedropper?: boolean
  brush?: boolean
  restoreImage?: { url: string; seq: number } | null
  quizMode?: boolean
  quizAvailable?: boolean
  onStartQuiz?: () => void
  onExitQuiz?: () => void
  onCompleteQuiz?: () => void
  challengeProgress?: string
  onQuitChallenge?: () => void
  onOpenSaved?: () => void
  onSave?: () => void
  onPickColor?: (color: string) => void
  onUndo?: () => void
  onPaint: (regionId: string, ev: PointerEvent<SVGElement>) => void
}) {
  const [referenceOpen, setReferenceOpen] = useState(false)
  const paperRef = useRef<HTMLDivElement | null>(null)
  const pinchRef = useRef<{ distance: number; zoom: number; centerX: number; centerY: number; scrollLeft: number; scrollTop: number } | null>(null)
  const panRef = useRef<{ x: number; y: number; scrollLeft: number; scrollTop: number } | null>(null)
  const twoFingerTapRef = useRef<{ distance: number; centerX: number; centerY: number; startedAt: number } | null>(null)
  const zoomAnchorRef = useRef<{
    fromZoom: number
    toZoom: number
    scrollLeft: number
    scrollTop: number
    fromClientX: number
    fromClientY: number
    toClientX: number
    toClientY: number
  } | null>(null)

  useLayoutEffect(() => {
    const anchor = zoomAnchorRef.current
    const container = paperRef.current
    if (!anchor || !container || props.zoom !== anchor.toZoom) return
    zoomAnchorRef.current = null
    const scale = anchor.toZoom / anchor.fromZoom
    const rect = container.getBoundingClientRect()
    const localX = anchor.scrollLeft + anchor.fromClientX - rect.left
    const localY = anchor.scrollTop + anchor.fromClientY - rect.top
    container.scrollLeft = localX * scale - (anchor.toClientX - rect.left)
    container.scrollTop = localY * scale - (anchor.toClientY - rect.top)
  }, [props.zoom])

  useLayoutEffect(() => {
    zoomAnchorRef.current = null
    pinchRef.current = null
    panRef.current = null
    twoFingerTapRef.current = null
    const container = paperRef.current
    if (!container) return
    container.scrollTo({ top: 0, left: 0 })
  }, [props.illustration?.id])

  if (!props.illustration) {
    return (
      <div className="emptyStage" role="region" aria-label="イラスト未選択">
        <div className="emptyTitle">イラストを選んでスタート</div>
      </div>
    )
  }

  return (
    <div className="stage" role="region" aria-label="塗り絵エリア">
      <div className="stageHeader">
        <div className="stageTitleBlock">
          <div className="stageTitleRow">
            <div className="stageTitle">{props.illustration.title}</div>
            {props.quizMode ? <span className="quizModeBadge">{props.challengeProgress ? 'ぬりえテスト' : 'クイズモード'}</span> : null}
          </div>
          <div className="stageSub">{props.illustration.subtitle}</div>
          {props.challengeProgress ? <div className="challengeProgress">{props.challengeProgress}</div> : null}
        </div>
        <div className="stageHeaderActions">
          {!props.quizMode && props.quizAvailable ? (
            <button className="btn quizModeToggleButton" type="button" onClick={props.onStartQuiz}>
              クイズモードへ
            </button>
          ) : null}
          <div className="tabletStageQuickActions">
            <button className="btn" type="button" onClick={props.onOpenSaved}>
              マイギャラリー
            </button>
            <button className="btn" type="button" onClick={props.onSave}>
              保存
            </button>
          </div>
          <div className="mobileZoomControls" aria-label="塗り絵の拡大縮小">
            <button className="btn zoomResetButton mobileStageZoomResetButton" type="button" onClick={() => props.onZoomChange(1)} disabled={props.zoom <= 1} aria-label="100%に戻す" title="100%に戻す">
              100%
            </button>
            <button className="btn iconButton" type="button" onClick={() => props.onZoomChange((value) => Math.max(1, Number((value - 0.25).toFixed(2))))} disabled={props.zoom <= 1} aria-label="縮小" title="縮小">
              <ZoomOutIcon />
            </button>
            <button className="btn iconButton" type="button" onClick={() => props.onZoomChange((value) => Math.min(MAX_ART_ZOOM, Number((value + 0.25).toFixed(2))))} disabled={props.zoom >= MAX_ART_ZOOM} aria-label="拡大" title="拡大">
              <ZoomInIcon />
            </button>
          </div>
          {props.quizMode ? (
            <>
              {props.onQuitChallenge ? (
                <button className="btn challengeQuitButton" type="button" onClick={props.onQuitChallenge}>
                  やめる
                </button>
              ) : (
                <button className="btn quizModeToggleButton quizExitButton" type="button" onClick={props.onExitQuiz}>
                  ぬりえモードへ
                </button>
              )}
              <button className="btn quizCompleteButton" type="button" onClick={props.onCompleteQuiz}>
                完成！
              </button>
            </>
          ) : null}
          {!props.quizMode && props.illustration.referenceImage ? (
            <button className="btn referenceButton" type="button" onClick={() => setReferenceOpen(true)}>
              見本を見る
            </button>
          ) : null}
        </div>
      </div>
      <div
        ref={paperRef}
        className={`paper ${props.zoom > 1 ? 'zoomedPaper' : ''}`}
        onWheel={(ev) => {
          if (!ev.ctrlKey && !ev.metaKey) return
          ev.preventDefault()
          const nextZoom = clampZoom(props.zoom + (ev.deltaY < 0 ? 0.25 : -0.25))
          zoomAnchorRef.current = {
            fromZoom: props.zoom,
            toZoom: nextZoom,
            scrollLeft: ev.currentTarget.scrollLeft,
            scrollTop: ev.currentTarget.scrollTop,
            fromClientX: ev.clientX,
            fromClientY: ev.clientY,
            toClientX: ev.clientX,
            toClientY: ev.clientY,
          }
          props.onZoomChange(nextZoom)
        }}
        onTouchStart={(ev) => {
          const paper = ev.currentTarget
          const canPan = props.zoom > 1 || paper.scrollHeight > paper.clientHeight + 1 || paper.scrollWidth > paper.clientWidth + 1
          if (ev.touches.length === 1 && canPan && !props.brush) {
            panRef.current = {
              x: ev.touches[0].clientX,
              y: ev.touches[0].clientY,
              scrollLeft: ev.currentTarget.scrollLeft,
              scrollTop: ev.currentTarget.scrollTop,
            }
            return
          }

          if (ev.touches.length !== 2) return
          ev.preventDefault()
          panRef.current = null
          twoFingerTapRef.current = getTwoFingerTouchInfo(ev.touches)
          pinchRef.current = {
            distance: getTouchDistance(ev.touches),
            zoom: props.zoom,
            ...getTouchCenter(ev.touches),
            scrollLeft: ev.currentTarget.scrollLeft,
            scrollTop: ev.currentTarget.scrollTop,
          }
        }}
        onTouchMove={(ev) => {
          if (ev.touches.length === 1 && panRef.current && !props.brush) {
            ev.preventDefault()
            ev.currentTarget.scrollLeft = panRef.current.scrollLeft + panRef.current.x - ev.touches[0].clientX
            ev.currentTarget.scrollTop = panRef.current.scrollTop + panRef.current.y - ev.touches[0].clientY
            return
          }

          if (ev.touches.length === 2 && pinchRef.current) {
            ev.preventDefault()
            const tapStart = twoFingerTapRef.current
            if (tapStart) {
              const current = getTwoFingerTouchInfo(ev.touches)
              if (Math.abs(current.distance - tapStart.distance) > 14 || Math.hypot(current.centerX - tapStart.centerX, current.centerY - tapStart.centerY) > 14) {
                twoFingerTapRef.current = null
              }
            }
            const nextZoom = clampZoom(pinchRef.current.zoom * (getTouchDistance(ev.touches) / pinchRef.current.distance))
            const center = getTouchCenter(ev.touches)
            const base = pinchRef.current
            zoomAnchorRef.current = {
              fromZoom: base.zoom,
              toZoom: nextZoom,
              scrollLeft: base.scrollLeft,
              scrollTop: base.scrollTop,
              fromClientX: base.centerX,
              fromClientY: base.centerY,
              toClientX: center.x,
              toClientY: center.y,
            }
            props.onZoomChange(nextZoom)
          }
        }}
        onTouchEnd={(ev) => {
          const tapStart = twoFingerTapRef.current
          if (tapStart && ev.touches.length < 2) {
            twoFingerTapRef.current = null
            if (performance.now() - tapStart.startedAt <= 320) props.onUndo?.()
          }
          if (ev.touches.length < 2) pinchRef.current = null
          if (ev.touches.length === 0) panRef.current = null
        }}
        onTouchCancel={() => {
          pinchRef.current = null
          panRef.current = null
          twoFingerTapRef.current = null
        }}
      >
        <div className={`zoomSurface ${props.zoom > 1 ? 'zoomed' : ''}`} style={{ '--art-zoom': props.zoom } as CSSProperties}>
          {props.illustration.node({
            fills: props.fills,
            color: props.color,
            command: props.command,
            eyedropper: props.eyedropper,
            brush: props.brush,
            onPickColor: props.onPickColor,
            restoreImage: props.restoreImage,
            onPaint: (regionId, ev) => {
              ev.preventDefault()
              props.onPaint(regionId, ev)
            },
          })}
        </div>
      </div>
      {referenceOpen && props.illustration.referenceImage ? (
        <div className="modalOverlay" role="dialog" aria-modal="true" aria-label={`${props.illustration.title}の見本`}>
          <div className="modal referencePanel">
            <div className="modalHead">
              <div>
                <div className="modalTitle">{props.illustration.title}</div>
                <div className="modalSub">色の見本</div>
              </div>
              <button className="btn" type="button" onClick={() => setReferenceOpen(false)}>
                閉じる
              </button>
            </div>
            <div className="referenceBody">
              <img src={props.illustration.referenceImage} alt={`${props.illustration.title}の見本`} />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function getTouchDistance(touches: TouchList) {
  const first = touches[0]
  const second = touches[1]
  return Math.hypot(first.clientX - second.clientX, first.clientY - second.clientY)
}

function getTouchCenter(touches: TouchList) {
  const first = touches[0]
  const second = touches[1]
  return {
    centerX: (first.clientX + second.clientX) / 2,
    centerY: (first.clientY + second.clientY) / 2,
    x: (first.clientX + second.clientX) / 2,
    y: (first.clientY + second.clientY) / 2,
  }
}

function getTwoFingerTouchInfo(touches: TouchList) {
  const first = touches[0]
  const second = touches[1]
  return {
    distance: Math.hypot(first.clientX - second.clientX, first.clientY - second.clientY),
    centerX: (first.clientX + second.clientX) / 2,
    centerY: (first.clientY + second.clientY) / 2,
    startedAt: performance.now(),
  }
}

function clampZoom(value: number) {
  return Math.min(MAX_ART_ZOOM, Math.max(1, Number(value.toFixed(2))))
}

function ZoomInIcon() {
  return (
    <svg className="buttonIcon" viewBox="5 5 16 16" aria-hidden="true">
      <circle cx="12" cy="12" r="6" />
      <path d="M12 9v6" />
      <path d="M9 12h6" />
      <path d="m16.5 16.5 4 4" />
    </svg>
  )
}

function ZoomOutIcon() {
  return (
    <svg className="buttonIcon" viewBox="5 5 16 16" aria-hidden="true">
      <circle cx="12" cy="12" r="6" />
      <path d="M9 12h6" />
      <path d="m16.5 16.5 4 4" />
    </svg>
  )
}
