import type { PointerEvent } from 'react'
import { RasterLineArt, type RasterPaintCommand } from './RasterLineArt'

export function Apple(props: {
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
      title="りんご"
      crop={{ x: 96, y: 10, width: 335, height: 365 }}
      color={props.color}
      command={props.command}
      eyedropper={props.eyedropper}
      onPickColor={props.onPickColor}
      restoreImage={props.restoreImage}
    />
  )
}
