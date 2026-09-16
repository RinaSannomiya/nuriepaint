import type { PointerEvent } from 'react'

export type SvgPaintHandler = (regionId: string, ev: PointerEvent<SVGElement>) => void

export function fillOrPaper(fills: Record<string, string>, regionId: string) {
  return fills[regionId] ?? 'var(--paper)'
}

