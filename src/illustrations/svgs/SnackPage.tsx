import type { PointerEvent } from 'react'
import { RasterLineArt, type RasterPaintCommand } from './RasterLineArt'

export function SnackPage(props: {
  page: string
  title: string
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
      title={props.title}
      source={`/lineart/snacks/snack-${props.page}.png`}
      color={props.color}
      command={props.command}
      eyedropper={props.eyedropper}
      onPickColor={props.onPickColor}
      restoreImage={props.restoreImage}
    />
  )
}
