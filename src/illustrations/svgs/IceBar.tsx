import type { PointerEvent } from 'react'
import { RasterLineArt, type RasterPaintCommand } from './RasterLineArt'

export function IceBar(props: {
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
      title="ガリガリくんのアイス"
      crop={{ x: 151, y: 733, width: 215, height: 367 }}
      color={props.color}
      command={props.command}
      eyedropper={props.eyedropper}
      brush={props.brush}
      onPickColor={props.onPickColor}
      restoreImage={props.restoreImage}
    />
  )
}
