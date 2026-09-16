import type { ReactNode } from 'react'

export function SvgFrame(props: { title: string; children: ReactNode; viewBox: string }) {
  return (
    <svg
      role="img"
      aria-label={props.title}
      viewBox={props.viewBox}
      className="inkSvg"
      xmlns="http://www.w3.org/2000/svg"
    >
      {props.children}
    </svg>
  )
}

