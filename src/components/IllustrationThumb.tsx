import type { IllustrationDef } from '../illustrations/illustrations'
import { useEffect, useState } from 'react'

export function IllustrationThumb(props: { illustration: IllustrationDef }) {
  const [trimmedSrc, setTrimmedSrc] = useState<string | null>(null)

  useEffect(() => {
    if (!props.illustration.thumbnailImage || !props.illustration.autoTrimThumbnail) {
      setTrimmedSrc(null)
      return
    }

    let canceled = false
    trimThumbnailWhitespace(props.illustration.thumbnailImage)
      .then((src) => {
        if (!canceled) setTrimmedSrc(src)
      })
      .catch(() => {
        if (!canceled) setTrimmedSrc(null)
      })

    return () => {
      canceled = true
    }
  }, [props.illustration.autoTrimThumbnail, props.illustration.thumbnailImage])

  if (props.illustration.thumbnailImage) {
    return (
      <img
        className={`thumbImage ${props.illustration.autoTrimThumbnail ? 'autoTrimThumb' : ''}`}
        src={trimmedSrc ?? props.illustration.thumbnailImage}
        alt=""
        loading="lazy"
        decoding="async"
        draggable={false}
      />
    )
  }

  return props.illustration.node({
    fills: {},
    onPaint: () => {},
  })
}

async function trimThumbnailWhitespace(src: string) {
  const image = await loadImage(src)
  const sample = document.createElement('canvas')
  const maxSourceSize = 900
  const sourceScale = Math.min(1, maxSourceSize / Math.max(image.naturalWidth, image.naturalHeight))
  const sourceWidth = Math.max(1, Math.round(image.naturalWidth * sourceScale))
  const sourceHeight = Math.max(1, Math.round(image.naturalHeight * sourceScale))
  sample.width = sourceWidth
  sample.height = sourceHeight
  const sampleCtx = sample.getContext('2d', { willReadFrequently: true })
  if (!sampleCtx) return src
  sampleCtx.drawImage(image, 0, 0, sourceWidth, sourceHeight)
  const data = sampleCtx.getImageData(0, 0, sourceWidth, sourceHeight)
  const bounds = findContentBounds(data)
  if (!bounds) return src

  const padding = Math.round(Math.max(bounds.right - bounds.left, bounds.bottom - bounds.top) * 0.08)
  const left = Math.max(0, bounds.left - padding)
  const top = Math.max(0, bounds.top - padding)
  const right = Math.min(sourceWidth - 1, bounds.right + padding)
  const bottom = Math.min(sourceHeight - 1, bounds.bottom + padding)
  const croppedWidth = right - left + 1
  const croppedHeight = bottom - top + 1
  const output = document.createElement('canvas')
  output.width = croppedWidth
  output.height = croppedHeight
  const outputCtx = output.getContext('2d')
  if (!outputCtx) return src
  outputCtx.fillStyle = '#fff'
  outputCtx.fillRect(0, 0, croppedWidth, croppedHeight)
  outputCtx.drawImage(sample, left, top, croppedWidth, croppedHeight, 0, 0, croppedWidth, croppedHeight)
  return output.toDataURL('image/png')
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error(`Failed to load ${src}`))
    image.src = src
  }).catch(() => null).then((image) => {
    if (!image) throw new Error(`Failed to load ${src}`)
    return image
  })
}

function findContentBounds(imageData: ImageData) {
  let left = imageData.width
  let right = -1
  let top = imageData.height
  let bottom = -1

  for (let y = 0; y < imageData.height; y += 1) {
    for (let x = 0; x < imageData.width; x += 1) {
      const p = (y * imageData.width + x) * 4
      const r = imageData.data[p]
      const g = imageData.data[p + 1]
      const b = imageData.data[p + 2]
      const a = imageData.data[p + 3]
      const brightness = (r + g + b) / 3
      const saturation = Math.max(r, g, b) - Math.min(r, g, b)
      const isLineOrColor = brightness < 218 || (saturation > 48 && brightness < 248)
      if (a < 16 || !isLineOrColor) continue
      left = Math.min(left, x)
      right = Math.max(right, x)
      top = Math.min(top, y)
      bottom = Math.max(bottom, y)
    }
  }

  if (right < 0 || bottom < 0) return null
  return { left, right, top, bottom }
}
