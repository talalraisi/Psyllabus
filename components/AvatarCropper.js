'use client'

import { useState, useRef, useEffect, useCallback } from 'react'

const BOX = 280 // on-screen crop window
const OUTPUT = 512 // what gets uploaded, square

/**
 * Pick, zoom, drag, crop.
 *
 * The old upload sent the original file straight to storage, so a 5MB cap
 * rejected most photos taken on a phone and whatever did get through was
 * squashed into a circle at whatever aspect ratio it happened to be.
 *
 * Cropping in the browser fixes both. The file is drawn to a canvas at 512px
 * square and re-encoded as JPEG, so a 12MB photo uploads as roughly 60KB and
 * the size limit stops mattering. Nothing is sent until Save.
 */
export default function AvatarCropper({ file, onCancel, onCropped, saving }) {
  const [img, setImg] = useState(null)
  const [zoom, setZoom] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const dragging = useRef(null)
  const canvasRef = useRef(null)

  useEffect(() => {
    if (!file) return
    const url = URL.createObjectURL(file)
    const image = new Image()
    image.onload = () => {
      setImg(image)
      setZoom(1)
      setOffset({ x: 0, y: 0 })
    }
    image.src = url
    return () => URL.revokeObjectURL(url)
  }, [file])

  // Scale that just fills the crop box, so there is never a transparent edge.
  const baseScale = img ? Math.max(BOX / img.width, BOX / img.height) : 1
  const scale = baseScale * zoom

  /** Keep the picture covering the box however far it is dragged. */
  const clamp = useCallback(
    (next) => {
      if (!img) return next
      const limitX = Math.max(0, (img.width * scale - BOX) / 2)
      const limitY = Math.max(0, (img.height * scale - BOX) / 2)
      return {
        x: Math.max(-limitX, Math.min(limitX, next.x)),
        y: Math.max(-limitY, Math.min(limitY, next.y)),
      }
    },
    [img, scale]
  )

  useEffect(() => {
    setOffset((o) => clamp(o))
  }, [clamp])

  // Draw the preview.
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !img) return
    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, BOX, BOX)
    ctx.save()
    ctx.beginPath()
    ctx.arc(BOX / 2, BOX / 2, BOX / 2, 0, Math.PI * 2)
    ctx.clip()
    const w = img.width * scale
    const h = img.height * scale
    ctx.drawImage(img, BOX / 2 - w / 2 + offset.x, BOX / 2 - h / 2 + offset.y, w, h)
    ctx.restore()
  }, [img, scale, offset])

  const start = (clientX, clientY) => {
    dragging.current = { x: clientX, y: clientY, from: { ...offset } }
  }
  const move = (clientX, clientY) => {
    if (!dragging.current) return
    const d = dragging.current
    setOffset(clamp({ x: d.from.x + (clientX - d.x), y: d.from.y + (clientY - d.y) }))
  }
  const end = () => {
    dragging.current = null
  }

  /** Render at output size and hand back a JPEG blob. */
  const crop = () => {
    if (!img) return
    const out = document.createElement('canvas')
    out.width = OUTPUT
    out.height = OUTPUT
    const ctx = out.getContext('2d')
    const ratio = OUTPUT / BOX
    ctx.save()
    ctx.beginPath()
    ctx.arc(OUTPUT / 2, OUTPUT / 2, OUTPUT / 2, 0, Math.PI * 2)
    ctx.clip()
    const w = img.width * scale * ratio
    const h = img.height * scale * ratio
    ctx.drawImage(
      img,
      OUTPUT / 2 - w / 2 + offset.x * ratio,
      OUTPUT / 2 - h / 2 + offset.y * ratio,
      w,
      h
    )
    ctx.restore()
    out.toBlob((blob) => blob && onCropped(blob), 'image/jpeg', 0.9)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/40" onClick={saving ? undefined : onCancel} />

      <div className="surface relative w-full max-w-sm p-5">
        <h2 className="t-card-title mb-1">Position your photo</h2>
        <p className="t-small mb-4">Drag to move, and use the slider to zoom.</p>

        <div
          className="mx-auto touch-none select-none"
          style={{ width: BOX, height: BOX }}
          onMouseDown={(e) => start(e.clientX, e.clientY)}
          onMouseMove={(e) => move(e.clientX, e.clientY)}
          onMouseUp={end}
          onMouseLeave={end}
          onTouchStart={(e) => start(e.touches[0].clientX, e.touches[0].clientY)}
          onTouchMove={(e) => move(e.touches[0].clientX, e.touches[0].clientY)}
          onTouchEnd={end}
        >
          <canvas
            ref={canvasRef}
            width={BOX}
            height={BOX}
            className="cursor-grab rounded-full border border-[var(--border-strong)] active:cursor-grabbing"
          />
        </div>

        <label className="mt-4 block">
          <span className="t-overline">Zoom</span>
          <input
            type="range"
            min="1"
            max="4"
            step="0.01"
            value={zoom}
            onChange={(e) => setZoom(parseFloat(e.target.value))}
            className="mt-2 w-full accent-[var(--brand)]"
          />
        </label>

        <div className="mt-5 flex gap-2">
          <button onClick={onCancel} disabled={saving} className="btn btn-quiet control-md flex-1">
            Cancel
          </button>
          <button onClick={crop} disabled={saving || !img} className="btn btn-solid control-md flex-1">
            {saving ? 'Saving…' : 'Save photo'}
          </button>
        </div>
      </div>
    </div>
  )
}
