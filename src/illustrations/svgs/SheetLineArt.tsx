import type { ReactNode } from 'react'
import { SvgFrame } from './SvgFrame'

const SHEET = '/lineart/coloring-sheet.png'
const SHEET_WIDTH = 1024
const SHEET_HEIGHT = 1536

export function SheetLineArt(props: {
  title: string
  crop: { x: number; y: number; width: number; height: number }
  children: ReactNode
}) {
  const { x, y, width, height } = props.crop

  return (
    <SvgFrame title={props.title} viewBox={`${x} ${y} ${width} ${height}`}>
      {props.children}
      <image
        href={SHEET}
        x="0"
        y="0"
        width={SHEET_WIDTH}
        height={SHEET_HEIGHT}
        preserveAspectRatio="none"
        className="sheetLineArt"
      />
    </SvgFrame>
  )
}
