import type { PointerEvent } from 'react'
import { RasterLineArt, type RasterPaintCommand } from './RasterLineArt'

export function Lemon(props: {
  fills: Record<string, string>
  onPaint: (regionId: string, ev: PointerEvent<SVGElement>) => void
  color?: string
  command?: RasterPaintCommand | null
  eyedropper?: boolean
  brush?: boolean
  onPickColor?: (color: string) => void
  restoreImage?: { url: string; seq: number } | null
}) {
  return (
    <RasterLineArt
      title="レモン"
      crop={{ x: 83, y: 387, width: 392, height: 342 }}
      color={props.color}
      command={props.command}
      eyedropper={props.eyedropper}
      brush={props.brush}
      onPickColor={props.onPickColor}
      restoreImage={props.restoreImage}
    />
  )
}
