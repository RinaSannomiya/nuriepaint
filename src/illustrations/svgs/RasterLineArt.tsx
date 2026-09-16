import { useCallback, useEffect, useRef, useState, type CSSProperties, type TouchList } from 'react'

const SHEET = '/lineart/coloring-sheet.png'
const LINE_THRESHOLD = 218

export type RasterPaintCommand = {
  seq: number
  type: 'undo' | 'redo' | 'reset'
}

export function RasterLineArt(props: {
  title: string
  crop?: { x: number; y: number; width: number; height: number }
  source?: string
  color?: string
  command?: RasterPaintCommand | null
  onTwoFingerTap?: () => void
  eyedropper?: boolean
  brush?: boolean
  onPickColor?: (color: string) => void
  restoreImage?: { url: string; seq: number } | null
  paintMask?: 'circle'
  allowEdgeFill?: boolean
}) {
  const source = props.source ?? SHEET
  const cropX = props.crop?.x
  const cropY = props.crop?.y
  const cropWidth = props.crop?.width
  const cropHeight = props.crop?.height
  const restoreUrl = props.restoreImage?.url
  const restoreSeq = props.restoreImage?.seq
  const [aspectRatio, setAspectRatio] = useState(cropWidth && cropHeight ? cropWidth / cropHeight : 1)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const touchPaintTimerRef = useRef<number | null>(null)
  const twoFingerTapRef = useRef<{ distance: number; centerX: number; centerY: number; startedAt: number } | null>(null)
  const brushDraggingRef = useRef(false)
  const lastBrushPointRef = useRef<{ x: number; y: number } | null>(null)
  const stateRef = useRef<{
    barrier: Uint8Array
    lineData: ImageData
    fillData: ImageData
    history: Uint8ClampedArray[]
    redoHistory: Uint8ClampedArray[]
    width: number
    height: number
    lastCommandSeq: number
  } | null>(null)

  const redraw = useCallback(() => {
    const canvas = canvasRef.current
    const state = stateRef.current
    if (!canvas || !state) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const output = ctx.createImageData(state.width, state.height)
    for (let i = 0; i < state.width * state.height; i += 1) {
      const p = i * 4
      output.data[p] = state.fillData.data[p + 3] ? state.fillData.data[p] : 255
      output.data[p + 1] = state.fillData.data[p + 3] ? state.fillData.data[p + 1] : 255
      output.data[p + 2] = state.fillData.data[p + 3] ? state.fillData.data[p + 2] : 255
      output.data[p + 3] = 255

      const lineAlpha = state.lineData.data[p + 3] / 255
      if (lineAlpha > 0) {
        output.data[p] = Math.round(output.data[p] * (1 - lineAlpha))
        output.data[p + 1] = Math.round(output.data[p + 1] * (1 - lineAlpha))
        output.data[p + 2] = Math.round(output.data[p + 2] * (1 - lineAlpha))
      }
    }
    ctx.putImageData(output, 0, 0)
  }, [])

  const clearTouchPaintTimer = useCallback(() => {
    if (touchPaintTimerRef.current === null) return
    window.clearTimeout(touchPaintTimerRef.current)
    touchPaintTimerRef.current = null
  }, [])

  const clearTwoFingerTap = useCallback(() => {
    twoFingerTapRef.current = null
  }, [])

  const restoreFromImage = useCallback((url: string) => {
    const state = stateRef.current
    if (!state) return

    let canceled = false
    const img = new Image()
    img.onload = () => {
      if (canceled) return
      const sample = document.createElement('canvas')
      sample.width = state.width
      sample.height = state.height
      const ctx = sample.getContext('2d')
      if (!ctx) return
      ctx.drawImage(img, 0, 0, state.width, state.height)
      const restored = ctx.getImageData(0, 0, state.width, state.height)
      state.history = []
      state.redoHistory = []
      state.fillData.data.fill(0)

      for (let i = 0; i < state.width * state.height; i += 1) {
        if (state.barrier[i]) continue
        const p = i * 4
        const r = restored.data[p]
        const g = restored.data[p + 1]
        const b = restored.data[p + 2]
        const isBackground =
          (Math.abs(r - 255) < 8 && Math.abs(g - 255) < 8 && Math.abs(b - 255) < 8) ||
          (Math.abs(r - 255) < 8 && Math.abs(g - 253) < 8 && Math.abs(b - 248) < 8)
        if (isBackground) continue
        state.fillData.data[p] = r
        state.fillData.data[p + 1] = g
        state.fillData.data[p + 2] = b
        state.fillData.data[p + 3] = 255
      }
      redraw()
    }
    img.src = url

    return () => {
      canceled = true
    }
  }, [redraw])

  useEffect(() => {
    let canceled = false
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) return

    const img = new Image()
    img.onload = () => {
      if (canceled) return
      const x = cropX ?? 0
      const y = cropY ?? 0
      const width = cropWidth ?? img.naturalWidth
      const height = cropHeight ?? img.naturalHeight
      setAspectRatio(width / height)
      canvas.width = width
      canvas.height = height
      ctx.clearRect(0, 0, width, height)
      ctx.drawImage(img, x, y, width, height, 0, 0, width, height)

      const source = ctx.getImageData(0, 0, width, height)
      const lineData = ctx.createImageData(width, height)
      const fillData = ctx.createImageData(width, height)
      const barrier = new Uint8Array(width * height)

      for (let i = 0; i < width * height; i += 1) {
        const p = i * 4
        const lum = source.data[p] * 0.299 + source.data[p + 1] * 0.587 + source.data[p + 2] * 0.114
        if (lum < LINE_THRESHOLD) {
          barrier[i] = 1
          lineData.data[p] = 0
          lineData.data[p + 1] = 0
          lineData.data[p + 2] = 0
          lineData.data[p + 3] = Math.min(255, Math.max(90, (255 - lum) * 1.6))
        }
      }

      stateRef.current = {
        barrier,
        lineData,
        fillData,
        history: [],
        redoHistory: [],
        width,
        height,
        lastCommandSeq: 0,
      }
      redraw()
      if (restoreUrl) restoreFromImage(restoreUrl)
    }
    img.src = source

    return () => {
      canceled = true
      clearTouchPaintTimer()
      clearTwoFingerTap()
    }
  }, [clearTouchPaintTimer, clearTwoFingerTap, cropHeight, cropWidth, cropX, cropY, redraw, restoreFromImage, restoreUrl, source])

  useEffect(() => {
    const state = stateRef.current
    if (!state || !props.command || props.command.seq === state.lastCommandSeq) return
    state.lastCommandSeq = props.command.seq

    if (props.command.type === 'reset') {
      state.history.push(new Uint8ClampedArray(state.fillData.data))
      state.redoHistory = []
      state.fillData.data.fill(0)
      redraw()
      return
    }

    if (props.command.type === 'redo') {
      const next = state.redoHistory.pop()
      if (next) {
        state.history.push(new Uint8ClampedArray(state.fillData.data))
        state.fillData.data.set(next)
        redraw()
      }
      return
    }

    const prev = state.history.pop()
    if (prev) {
      state.redoHistory.push(new Uint8ClampedArray(state.fillData.data))
      state.fillData.data.set(prev)
      redraw()
    }
  }, [props.command, redraw])

  useEffect(() => {
    if (!restoreUrl) return
    return restoreFromImage(restoreUrl)
  }, [restoreSeq, restoreUrl, restoreFromImage])

  function paintAt(clientX: number, clientY: number) {
    const canvas = canvasRef.current
    const state = stateRef.current
    if (!canvas || !state || !props.color) return

    const rect = canvas.getBoundingClientRect()
    const startX = Math.floor(((clientX - rect.left) / rect.width) * state.width)
    const startY = Math.floor(((clientY - rect.top) / rect.height) * state.height)
    if (startX < 0 || startY < 0 || startX >= state.width || startY >= state.height) return

    const start = startY * state.width + startX
    const isPaintable = (idx: number) => {
      if (state.barrier[idx]) return false
      if (props.paintMask !== 'circle') return true

      const x = idx % state.width
      const y = Math.floor(idx / state.width)
      const centerX = (state.width - 1) / 2
      const centerY = (state.height - 1) / 2
      const radius = Math.min(state.width, state.height) * 0.485
      return (x - centerX) ** 2 + (y - centerY) ** 2 <= radius ** 2
    }
    if (!isPaintable(start)) return

    const visited = new Uint8Array(state.width * state.height)
    const stack = [start]
    const pixels: number[] = []
    let touchesEdge = false
    visited[start] = 1

    while (stack.length) {
      const idx = stack.pop()
      if (idx === undefined) break
      const x = idx % state.width
      const y = Math.floor(idx / state.width)
      pixels.push(idx)
      if (x === 0 || y === 0 || x === state.width - 1 || y === state.height - 1) touchesEdge = true

      const neighbors = [idx - 1, idx + 1, idx - state.width, idx + state.width]
      for (const next of neighbors) {
        if (next < 0 || next >= visited.length || visited[next] || !isPaintable(next)) continue
        const nx = next % state.width
        if ((next === idx - 1 && nx !== x - 1) || (next === idx + 1 && nx !== x + 1)) continue
        visited[next] = 1
        stack.push(next)
      }
    }

    if ((props.paintMask !== 'circle' && touchesEdge && !props.allowEdgeFill) || pixels.length === 0) return

    const { r, g, b } = hexToRgb(props.color)
    state.history.push(new Uint8ClampedArray(state.fillData.data))
    state.history = state.history.slice(-50)
    state.redoHistory = []
    for (const idx of pixels) {
      const p = idx * 4
      state.fillData.data[p] = r
      state.fillData.data[p + 1] = g
      state.fillData.data[p + 2] = b
      state.fillData.data[p + 3] = 255
    }
    redraw()
  }

  function pickAt(clientX: number, clientY: number) {
    const canvas = canvasRef.current
    const state = stateRef.current
    if (!canvas || !state) return

    const rect = canvas.getBoundingClientRect()
    const x = Math.floor(((clientX - rect.left) / rect.width) * state.width)
    const y = Math.floor(((clientY - rect.top) / rect.height) * state.height)
    if (x < 0 || y < 0 || x >= state.width || y >= state.height) return

    const picked = getPaintedPixelColor(state, x, y)
    if (picked) {
      props.onPickColor?.(picked)
      return
    }

    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const pixel = ctx.getImageData(x, y, 1, 1).data
    props.onPickColor?.(rgbToHex(pixel[0], pixel[1], pixel[2]))
  }

  function interactAt(clientX: number, clientY: number) {
    if (props.eyedropper) {
      pickAt(clientX, clientY)
      return
    }
    paintAt(clientX, clientY)
  }

  function brushPaintAt(clientX: number, clientY: number) {
    const last = lastBrushPointRef.current
    if (last && Math.hypot(clientX - last.x, clientY - last.y) < 8) return
    lastBrushPointRef.current = { x: clientX, y: clientY }
    paintAt(clientX, clientY)
  }

  return (
    <canvas
      ref={canvasRef}
      className="inkSvg rasterCanvas"
      role="img"
      aria-label={props.title}
      style={{ '--art-aspect': aspectRatio } as CSSProperties}
      onPointerDown={(ev) => {
        if (ev.pointerType === 'touch') return
        ev.preventDefault()
        interactAt(ev.clientX, ev.clientY)
        if (props.brush && !props.eyedropper) {
          brushDraggingRef.current = true
          lastBrushPointRef.current = { x: ev.clientX, y: ev.clientY }
        }
      }}
      onPointerMove={(ev) => {
        if (ev.pointerType === 'touch') return
        if (!brushDraggingRef.current || !props.brush || props.eyedropper) return
        if (ev.buttons !== 1) return
        brushPaintAt(ev.clientX, ev.clientY)
      }}
      onPointerUp={() => {
        brushDraggingRef.current = false
        lastBrushPointRef.current = null
      }}
      onPointerLeave={() => {
        brushDraggingRef.current = false
        lastBrushPointRef.current = null
      }}
      onPointerCancel={() => {
        brushDraggingRef.current = false
        lastBrushPointRef.current = null
      }}
      onTouchStart={(ev) => {
        if (ev.touches.length >= 2) {
          ev.preventDefault()
          clearTouchPaintTimer()
          twoFingerTapRef.current = getTwoFingerTouchInfo(ev.touches)
          lastBrushPointRef.current = null
          return
        }

        if (ev.touches.length !== 1) return
        const touch = ev.touches[0]
        const { clientX, clientY } = touch
        clearTouchPaintTimer()
        lastBrushPointRef.current = null
        touchPaintTimerRef.current = window.setTimeout(() => {
          touchPaintTimerRef.current = null
          interactAt(clientX, clientY)
          if (props.brush && !props.eyedropper) {
            lastBrushPointRef.current = { x: clientX, y: clientY }
          }
        }, 80)
      }}
      onTouchMove={(ev) => {
        if (ev.touches.length === 1 && props.brush && !props.eyedropper) {
          ev.preventDefault()
          clearTouchPaintTimer()
          const touch = ev.touches[0]
          brushPaintAt(touch.clientX, touch.clientY)
          return
        }

        clearTouchPaintTimer()
        const start = twoFingerTapRef.current
        if (!start || ev.touches.length < 2) return
        const current = getTwoFingerTouchInfo(ev.touches)
        if (Math.abs(current.distance - start.distance) > 14 || Math.hypot(current.centerX - start.centerX, current.centerY - start.centerY) > 14) {
          clearTwoFingerTap()
        }
      }}
      onTouchEnd={() => {
        clearTouchPaintTimer()
        lastBrushPointRef.current = null
        const start = twoFingerTapRef.current
        if (!start) return
        clearTwoFingerTap()
        if (performance.now() - start.startedAt <= 280) props.onTwoFingerTap?.()
      }}
      onTouchCancel={() => {
        clearTouchPaintTimer()
        clearTwoFingerTap()
        lastBrushPointRef.current = null
      }}
    />
  )
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

function hexToRgb(hex: string) {
  const value = hex.replace('#', '')
  return {
    r: Number.parseInt(value.slice(0, 2), 16),
    g: Number.parseInt(value.slice(2, 4), 16),
    b: Number.parseInt(value.slice(4, 6), 16),
  }
}

function rgbToHex(r: number, g: number, b: number) {
  return `#${[r, g, b].map((value) => value.toString(16).padStart(2, '0')).join('')}`
}

function getPaintedPixelColor(
  state: {
    fillData: ImageData
    width: number
    height: number
  },
  x: number,
  y: number,
) {
  const direct = readPaintedPixel(state, x, y)
  if (direct) return direct

  for (let radius = 1; radius <= 10; radius += 1) {
    for (let dy = -radius; dy <= radius; dy += 1) {
      for (let dx = -radius; dx <= radius; dx += 1) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== radius) continue
        const picked = readPaintedPixel(state, x + dx, y + dy)
        if (picked) return picked
      }
    }
  }

  return null
}

function readPaintedPixel(
  state: {
    fillData: ImageData
    width: number
    height: number
  },
  x: number,
  y: number,
) {
  if (x < 0 || y < 0 || x >= state.width || y >= state.height) return null
  const p = (y * state.width + x) * 4
  if (!state.fillData.data[p + 3]) return null
  return rgbToHex(state.fillData.data[p], state.fillData.data[p + 1], state.fillData.data[p + 2])
}
