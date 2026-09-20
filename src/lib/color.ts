function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n))
}

const toHex = (x: number) => clamp(Math.round(x), 0, 255).toString(16).padStart(2, '0')

export function rgbToHex(r: number, g: number, b: number) {
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toLowerCase()
}

export function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const m = hex.trim().match(/^#?([0-9a-f]{6})$/i)
  if (!m) return null
  const raw = m[1]
  return {
    r: parseInt(raw.slice(0, 2), 16),
    g: parseInt(raw.slice(2, 4), 16),
    b: parseInt(raw.slice(4, 6), 16),
  }
}

// 白（#ffffff）かどうか。白は背景と同化して見えないので、UI側で薄いグレーの枠線を付けるために使う
export function isWhiteColor(hex: string | null | undefined) {
  if (!hex) return false
  const rgb = hexToRgb(hex)
  return rgb ? rgb.r === 255 && rgb.g === 255 && rgb.b === 255 : false
}

// h: 0..360, s/l: 0..100
export function hslToHex(h: number, s: number, l: number) {
  const _h = (((h % 360) + 360) % 360) / 360
  const _s = clamp(s, 0, 100) / 100
  const _l = clamp(l, 0, 100) / 100

  const q = _l < 0.5 ? _l * (1 + _s) : _l + _s - _l * _s
  const p = 2 * _l - q

  const hue2rgb = (t: number) => {
    let _t = t
    if (_t < 0) _t += 1
    if (_t > 1) _t -= 1
    if (_t < 1 / 6) return p + (q - p) * 6 * _t
    if (_t < 1 / 2) return q
    if (_t < 2 / 3) return p + (q - p) * (2 / 3 - _t) * 6
    return p
  }

  const r = Math.round(hue2rgb(_h + 1 / 3) * 255)
  const g = Math.round(hue2rgb(_h) * 255)
  const b = Math.round(hue2rgb(_h - 1 / 3) * 255)

  return rgbToHex(r, g, b)
}

export function hexToHsl(hex: string): { h: number; s: number; l: number } | null {
  const m = hex.trim().match(/^#?([0-9a-f]{6})$/i)
  if (!m) return null
  const raw = m[1]
  const r = parseInt(raw.slice(0, 2), 16) / 255
  const g = parseInt(raw.slice(2, 4), 16) / 255
  const b = parseInt(raw.slice(4, 6), 16) / 255

  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const d = max - min

  let h = 0
  const l = (max + min) / 2
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1))

  if (d !== 0) {
    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6
        break
      case g:
        h = ((b - r) / d + 2) / 6
        break
      case b:
        h = ((r - g) / d + 4) / 6
        break
    }
  }

  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  }
}
