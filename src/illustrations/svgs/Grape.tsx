import type { PointerEvent } from 'react'
import { RasterLineArt, type RasterPaintCommand } from './RasterLineArt'

export function Grape(props: {
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
      title="ぶどう"
      crop={{ x: 78, y: 1100, width: 370, height: 430 }}
      color={props.color}
      command={props.command}
      eyedropper={props.eyedropper}
      brush={props.brush}
      onPickColor={props.onPickColor}
      restoreImage={props.restoreImage}
    />
  )
}
