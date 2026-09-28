'use client'

import { useState, useRef, useEffect, useCallback } from 'react'

const STAGE = 300 // on-screen working area, square
const OUTPUT = 512 // what gets uploaded, square
const MIN_FRAME = 60 // smallest crop you can drag down to, on screen

/**
 * Pick the square you want out of the photo.
 *
 * The first version showed a circle the size of the whole working area and
 * moved the picture underneath it. That works, but it hides the photo: you can
 * only see the part already inside the circle, so framing means dragging blind
 * and checking what appears. Choosing a face out of a group shot was guesswork.
 *
 * So the photo is shown whole and dimmed, and the crop is a square frame you
 * move over it. Everything outside the frame is darkened, everything inside is
 * at full brightness, and the thirds grid gives you something to line a face up
 * against. The circle inside the frame is what the avatar will actually show,
 * since it renders round everywhere in the app — without it people frame a
 * square perfectly and lose the corners.
 *
 * Nothing is sent until Save. The file is drawn to a 512px canvas and
 * re-encoded as JPEG, so a 12MB phone photo uploads at roughly 60KB.
 */
export default function AvatarCropper({ file, onCancel, onCropped, saving, error }) {
  const [img, setImg] = useState(null)
  // Problems opening the file, which happen before anything reaches the page
  // that owns the upload — so they are shown here, in the dialog, where the
  // person is actually looking.
  const [loadError, setLoadError] = useState('')
  /**
   * The crop square, in stage coordinates, or null for "wherever it starts".
   *
   * Null rather than a computed initial value because the starting frame
   * depends on the photo's shape, which is not known until it loads. Setting it
   * from an effect once the image arrives is the obvious way and it is the
   * wrong one: it is a render, then a second render to correct the first, and
   * the lint rule that forbids it is right. Deriving it means the frame is
   * correct on the first paint and a drag is what makes it real.
   */
  const [frame, setFrame] = useState(null)
  const dragging = useRef(null)
  const canvasRef = useRef(null)

  useEffect(() => {
    if (!file) return
    const url = URL.createObjectURL(file)
    const image = new Image()
    // Events from an image this effect has already cleaned up are ignored.
    //
    // Cleanup revokes the object URL, which makes a still-loading image fail —
    // and that failure arrives after the next run has already started. Without
    // this guard the effect running twice (as it does in development, and on
    // any re-render that changes the file) put "could not be opened" under a
    // photo that had opened perfectly well.
    let current = true
    image.onload = () => {
      if (!current) return
      setLoadError('')
      setImg(image)
      setFrame(null) // a new photo starts framed afresh
    }
    // Without this, a file the browser cannot decode — most often an iPhone
    // HEIC photo, which passes the "is it an image" check by its type and then
    // cannot be drawn — left a blank frame and a Save button that never
    // enabled, with nothing saying why.
    image.onerror = () => {
      if (!current) return
      const kind = (file.type || file.name.split('.').pop() || '').toLowerCase()
      setLoadError(
        /heic|heif/.test(kind)
          ? 'This is an iPhone HEIC photo, which browsers cannot open. Export it as a JPEG or PNG and choose that instead.'
          : 'That file could not be opened as an image. Try a JPEG or PNG.'
      )
    }
    image.src = url
    return () => {
      current = false
      URL.revokeObjectURL(url)
    }
  }, [file])

  /**
   * Where the whole photo sits on the stage.
   *
   * Contained rather than covering: the point of this version is that you can
   * see all of the picture while choosing part of it, so a tall photo gets bars
   * either side rather than being cropped before you have chosen anything.
   */
  const fit = img ? Math.min(STAGE / img.width, STAGE / img.height) : 1
  const shown = img
    ? {
        w: img.width * fit,
        h: img.height * fit,
        x: (STAGE - img.width * fit) / 2,
        y: (STAGE - img.height * fit) / 2,
      }
    : { w: STAGE, h: STAGE, x: 0, y: 0 }

  const maxFrame = Math.min(shown.w, shown.h)

  /** Keep the frame inside the photo, whatever it is asked to be. */
  const clamp = useCallback(
    (f) => {
      const size = Math.max(MIN_FRAME, Math.min(maxFrame, f.size))
      return {
        size,
        x: Math.max(shown.x, Math.min(shown.x + shown.w - size, f.x)),
        y: Math.max(shown.y, Math.min(shown.y + shown.h - size, f.y)),
      }
    },
    [shown.x, shown.y, shown.w, shown.h, maxFrame]
  )

  /** The biggest square the photo allows, centred: where a crop starts. */
  const defaultFrame = {
    size: maxFrame,
    x: shown.x + (shown.w - maxFrame) / 2,
    y: shown.y + (shown.h - maxFrame) / 2,
  }
  const active = frame ? clamp(frame) : defaultFrame

  // Pulled out so the draw effect depends on three numbers rather than on an
  // object rebuilt every render, which would redraw on every render.
  const { x: fx, y: fy, size: fsize } = active
  const { x: sx0, y: sy0, w: sw, h: sh } = shown

  // Draw the photo, the dimming, and the frame.
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !img) return
    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, STAGE, STAGE)
    ctx.drawImage(img, sx0, sy0, sw, sh)

    const x = fx, y = fy, size = fsize

    /* Two washes, both in the panel's own colour, read as one idea: the
       further something is from being kept, the more it disappears into the
       page. Black outside and panel-colour in the corners looked right in the
       dark theme and inverted in the light one, where the corners came out
       brighter than the area nobody had selected at all.

       The colour is read from the stylesheet rather than hardcoded, so it
       follows whichever theme is on.

       Four rectangles rather than one fill with a hole in it, because a
       composite operation here leaves a hairline seam at fractional pixels. */
    const css = getComputedStyle(canvas)
    const panel = css.getPropertyValue('--surface').trim() || '#141414'
    /* The frame and the circle's edge sit on the washed area, which is the
       panel's colour — so white chrome vanished in the light theme. Ink is the
       text colour, which contrasts with the panel by definition in both. */
    const ink = css.getPropertyValue('--text').trim() || '#f0f0f0'

    ctx.save()
    ctx.globalAlpha = 0.85
    ctx.fillStyle = panel
    ctx.fillRect(0, 0, STAGE, y)
    ctx.fillRect(0, y + size, STAGE, STAGE - (y + size))
    ctx.fillRect(0, y, x, size)
    ctx.fillRect(x + size, y, STAGE - (x + size), size)
    ctx.restore()

    const cx = x + size / 2
    const cy = y + size / 2
    const r = size / 2

    /* The corners the circle cuts off, washed out in the panel's own colour.
       A dashed outline said where the circle was and left the corners at full
       brightness, so a face framed neatly in the square still lost its edges
       once the avatar rendered round. Painting them in the surface colour at
       three-quarters shows the shape you are actually going to get while
       leaving enough of the picture visible to keep dragging by. Lighter than
       the wash outside the square, because a corner is inside the crop you
       chose and merely lost to the round mask. */
    ctx.save()
    ctx.globalAlpha = 0.6
    ctx.fillStyle = panel
    ctx.beginPath()
    ctx.rect(x, y, size, size)
    ctx.arc(cx, cy, r, 0, Math.PI * 2)
    ctx.fill('evenodd')
    ctx.restore()

    // Thirds, to line a face up against. Clipped to the circle, because a grid
    // drawn across the washed-out corners is guidance for a region that is
    // about to be thrown away.
    ctx.save()
    ctx.beginPath()
    ctx.arc(cx, cy, r, 0, Math.PI * 2)
    ctx.clip()
    ctx.strokeStyle = 'rgba(255,255,255,0.35)'
    ctx.lineWidth = 1
    ctx.beginPath()
    for (let i = 1; i < 3; i++) {
      const t = (size / 3) * i
      ctx.moveTo(x + t, y)
      ctx.lineTo(x + t, y + size)
      ctx.moveTo(x, y + t)
      ctx.lineTo(x + size, y + t)
    }
    ctx.stroke()
    ctx.restore()

    // The edge of what the avatar shows.
    ctx.save()
    ctx.globalAlpha = 0.55
    ctx.strokeStyle = ink
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.arc(cx, cy, r - 0.5, 0, Math.PI * 2)
    ctx.stroke()
    ctx.restore()

    // The frame itself, and a heavier mark at each corner so the edge reads
    // as a handle rather than as a border on the picture.
    ctx.save()
    ctx.globalAlpha = 0.85
    ctx.strokeStyle = ink
    ctx.lineWidth = 1.5
    ctx.strokeRect(x + 0.75, y + 0.75, size - 1.5, size - 1.5)

    ctx.globalAlpha = 1
    ctx.lineWidth = 3
    const arm = Math.min(18, size / 4)
    ctx.beginPath()
    for (const [cx, cy, dx, dy] of [
      [x, y, 1, 1],
      [x + size, y, -1, 1],
      [x, y + size, 1, -1],
      [x + size, y + size, -1, -1],
    ]) {
      ctx.moveTo(cx + dx * arm, cy)
      ctx.lineTo(cx, cy)
      ctx.lineTo(cx, cy + dy * arm)
    }
    ctx.stroke()
    ctx.restore()
  }, [img, fx, fy, fsize, sx0, sy0, sw, sh])

  const start = (clientX, clientY) => {
    dragging.current = { x: clientX, y: clientY, from: { ...active } }
  }
  const move = (clientX, clientY) => {
    if (!dragging.current) return
    const d = dragging.current
    setFrame(
      clamp({
        size: d.from.size,
        x: d.from.x + (clientX - d.x),
        y: d.from.y + (clientY - d.y),
      })
    )
  }
  const end = () => {
    dragging.current = null
  }

  /** Resize about the centre, so the frame does not walk across the photo. */
  const resize = (size) =>
    setFrame(
      clamp({
        size,
        x: active.x + (active.size - size) / 2,
        y: active.y + (active.size - size) / 2,
      })
    )

  /** Render the chosen square at output size and hand back a JPEG blob. */
  const crop = () => {
    if (!img) return
    const out = document.createElement('canvas')
    out.width = OUTPUT
    out.height = OUTPUT
    const ctx = out.getContext('2d')

    // Frame is in stage coordinates; the source rectangle is the same square
    // measured in the photo's own pixels.
    const sx = (active.x - shown.x) / fit
    const sy = (active.y - shown.y) / fit
    const ss = active.size / fit
    ctx.drawImage(img, sx, sy, ss, ss, 0, 0, OUTPUT, OUTPUT)

    out.toBlob(
      (blob) => {
        if (blob) onCropped(blob)
        else setLoadError('The photo could not be prepared for upload. Try a different image.')
      },
      'image/jpeg',
      0.9
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/40" onClick={saving ? undefined : onCancel} />

      <div className="surface relative w-full max-w-sm p-5">
        <h2 className="t-card-title mb-1">Choose the square</h2>
        <p className="t-small mb-4">Drag the frame over the part you want. The circle is what shows.</p>

        <div
          className="mx-auto touch-none select-none overflow-hidden rounded-[10px] border"
          style={{ width: STAGE, height: STAGE, borderColor: 'var(--border-strong)', background: 'var(--surface-sunken)' }}
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
            width={STAGE}
            height={STAGE}
            className="block cursor-grab active:cursor-grabbing"
          />
        </div>

        <label className="mt-4 block">
          <span className="t-overline">Size</span>
          <input
            type="range"
            min={MIN_FRAME}
            max={Math.max(MIN_FRAME, Math.round(maxFrame))}
            step="1"
            value={Math.round(active.size)}
            onChange={(e) => resize(parseFloat(e.target.value))}
            disabled={!img}
            className="mt-2 w-full accent-[var(--brand)]"
          />
        </label>

        {(loadError || error) && (
          <p
            role="alert"
            className="mt-4 border-l-2 pl-3 text-[12.5px] leading-relaxed"
            style={{ borderColor: 'var(--danger)', color: 'var(--danger)' }}
          >
            {loadError || error}
          </p>
        )}

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
