import type { PointerEvent } from 'react'
import { RasterLineArt, type RasterPaintCommand } from './RasterLineArt'

export function Blueberry(props: {
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
      title="ブルーベリー"
      crop={{ x: 579, y: 784, width: 402, height: 310 }}
      color={props.color}
      command={props.command}
      eyedropper={props.eyedropper}
      onPickColor={props.onPickColor}
      restoreImage={props.restoreImage}
    />
  )
}
