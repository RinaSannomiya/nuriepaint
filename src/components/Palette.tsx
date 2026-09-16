import { useMemo, type CSSProperties, type ReactNode } from 'react'
import { hexToHsl, hexToRgb, hslToHex, rgbToHex } from '../lib/color'

export const DEFAULT_SWATCHES: { name: string; hex: string }[] = [
  { name: '赤', hex: '#ff3b30' },
  { name: 'だいだい', hex: '#ff9500' },
  { name: '黄', hex: '#ffd60a' },
  { name: '緑', hex: '#34c759' },
  { name: '水色', hex: '#5ac8fa' },
  { name: '青', hex: '#007aff' },
  { name: '紫', hex: '#af52de' },
  { name: 'ピンク', hex: '#ff8ac2' },
  { name: '茶', hex: '#8e5a2b' },
  { name: '黒', hex: '#1c1c1e' },
]

export function Palette(props: {
  value: string
  onChange: (hex: string) => void
  showSliders?: boolean
  showSwatches?: boolean
  controlMode?: 'rgb' | 'cmy' | 'hsl'
  swatches?: { name: string; hex: string }[]
  actions?: ReactNode
}) {
  const parsed = useMemo(() => hexToRgb(props.value), [props.value])
  const parsedHsl = useMemo(() => hexToHsl(props.value), [props.value])
  const r = parsed?.r ?? 255
  const g = parsed?.g ?? 90
  const b = parsed?.b ?? 60
  const h = parsedHsl?.h ?? 0
  const s = parsedHsl?.s ?? 100
  const l = parsedHsl?.l ?? 60
  const c = 255 - r
  const m = 255 - g
  const y = 255 - b
  const showSliders = props.showSliders ?? true
  const showSwatches = props.showSwatches ?? true
  const controlMode = props.controlMode ?? 'rgb'
  const swatches = props.swatches ?? DEFAULT_SWATCHES

  const liveHex = useMemo(() => rgbToHex(r, g, b), [r, g, b])

  return (
    <div className={`palette ${showSwatches ? 'hasSwatches' : 'noSwatches'} ${showSliders ? 'hasSliders' : 'noSliders'}`}>
      <div className="paletteLeft">
        <div className="colorChip" style={{ background: liveHex }} aria-label={`選択中の色: ${liveHex}`} />
        <div className="colorMeta">
          <div className="colorLabel">選択中</div>
          <div className="colorValue">{liveHex}</div>
        </div>
      </div>

      {showSliders ? (
        <div className="paletteControls">
          {controlMode === 'rgb' ? (
            <>
              <ColorSlider label="R" chipClass="primaryChipR" value={r} max={255} trackClass="redTrack" trackStyle={{ ['--rgb-g' as never]: `${g}`, ['--rgb-b' as never]: `${b}` }} onChange={(next) => props.onChange(rgbToHex(next, g, b))} />
              <ColorSlider label="G" chipClass="primaryChipG" value={g} max={255} trackClass="greenTrack" trackStyle={{ ['--rgb-r' as never]: `${r}`, ['--rgb-b' as never]: `${b}` }} onChange={(next) => props.onChange(rgbToHex(r, next, b))} />
              <ColorSlider label="B" chipClass="primaryChipB" value={b} max={255} trackClass="blueTrack" trackStyle={{ ['--rgb-r' as never]: `${r}`, ['--rgb-g' as never]: `${g}` }} onChange={(next) => props.onChange(rgbToHex(r, g, next))} />
            </>
          ) : null}

          {controlMode === 'cmy' ? (
            <>
              <ColorSlider label="C" chipClass="primaryChipC" value={c} max={255} trackClass="cyanTrack" trackStyle={{ ['--cmy-m' as never]: `${m}`, ['--cmy-y' as never]: `${y}` }} onChange={(next) => props.onChange(rgbToHex(255 - next, g, b))} />
              <ColorSlider label="M" chipClass="primaryChipM" value={m} max={255} trackClass="magentaTrack" trackStyle={{ ['--cmy-c' as never]: `${c}`, ['--cmy-y' as never]: `${y}` }} onChange={(next) => props.onChange(rgbToHex(r, 255 - next, b))} />
              <ColorSlider label="Y" chipClass="primaryChipY" value={y} max={255} trackClass="yellowTrack" trackStyle={{ ['--cmy-c' as never]: `${c}`, ['--cmy-m' as never]: `${m}` }} onChange={(next) => props.onChange(rgbToHex(r, g, 255 - next))} />
            </>
          ) : null}

          {controlMode === 'hsl' ? (
            <>
              <ColorSlider label="色相" chipClass="primaryChipHue" value={h} max={360} trackClass="hueTrack" onChange={(next) => props.onChange(hslToHex(next, s, l))} />
              <ColorSlider label="彩度" chipClass="primaryChipSat" value={s} max={100} trackClass="saturationTrack" trackStyle={{ ['--hsl-h' as never]: `${h}`, ['--hsl-l' as never]: `${l}%` }} onChange={(next) => props.onChange(hslToHex(h, next, l))} />
              <ColorSlider label="明るさ" chipClass="primaryChipLight" value={l} max={100} trackClass="lightnessTrack" trackStyle={{ ['--hsl-h' as never]: `${h}`, ['--hsl-s' as never]: `${s}%` }} onChange={(next) => props.onChange(hslToHex(h, s, next))} />
            </>
          ) : null}
        </div>
      ) : null}

      {props.actions ? (
        <div className="paletteActions" aria-label="色の操作">
          {props.actions}
        </div>
      ) : null}

      {showSwatches ? (
        <div className="swatches" aria-label="カラースウォッチ">
          {swatches.map((sw) => (
            <button
              key={`${sw.name}-${sw.hex}`}
              type="button"
              className="swatch"
              style={{ background: sw.hex }}
              title={sw.name}
              onClick={() => props.onChange(sw.hex)}
              aria-label={`スウォッチ: ${sw.name}`}
            />
          ))}
        </div>
      ) : null}
    </div>
  )
}

function ColorSlider(props: {
  label: string
  chipClass: string
  value: number
  max: number
  trackClass: string
  trackStyle?: CSSProperties
  onChange: (value: number) => void
}) {
  return (
    <div className="sliderRow">
      <div className="sliderLabel">
        <span className={`primaryChip ${props.chipClass}`} aria-hidden="true" />
        <span>{props.label}</span>
      </div>
      <div className={`sliderTrack ${props.trackClass}`} style={props.trackStyle}>
        <input
          className="range"
          type="range"
          min={0}
          max={props.max}
          value={props.value}
          onChange={(e) => props.onChange(Number(e.target.value))}
          aria-label={props.label}
        />
      </div>
      <div className="sliderValue">{props.value}</div>
    </div>
  )
}
