import type { PointerEvent } from 'react'
import { RasterLineArt, type RasterPaintCommand } from './RasterLineArt'

export function Peach(props: {
  fills: Record<string, string>
  onPaint: (regionId: string, ev: PointerEvent<SVGElement>) => void
  color?: string
  command?: RasterPaintCommand | null
  eyedropper?: boolean
  onPickColor?: (color: string) => void
  restoreImage?: { url: string; seq: number } | null
}) {
  return (
    <RasterLineArt
      title="もも"
      crop={{ x: 569, y: 1109, width: 404, height: 390 }}
      color={props.color}
      command={props.command}
      eyedropper={props.eyedropper}
      onPickColor={props.onPickColor}
      restoreImage={props.restoreImage}
    />
  )
}
