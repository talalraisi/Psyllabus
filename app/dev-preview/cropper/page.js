'use client'

/**
 * The photo cropper, fed the files that used to fail silently.
 *
 * Not reachable in production — same gate as the parent harness.
 */

import { useEffect, useState } from 'react'
import { notFound, useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import AvatarCropper from '@/components/AvatarCropper'

const ENABLED = process.env.NODE_ENV !== 'production'

function makePng() {
  const c = document.createElement('canvas')
  c.width = 400
  c.height = 300
  const ctx = c.getContext('2d')
  ctx.fillStyle = '#4f7c68'
  ctx.fillRect(0, 0, 400, 300)
  ctx.fillStyle = '#fff'
  ctx.font = '48px sans-serif'
  ctx.fillText('photo', 130, 170)
  return new Promise((resolve) =>
    c.toBlob((b) => resolve(new File([b], 'photo.png', { type: 'image/png' })), 'image/png')
  )
}

function Inner() {
  const params = useSearchParams()
  const mode = params.get('mode') || 'ok'
  const [file, setFile] = useState(null)
  const [log, setLog] = useState([])

  useEffect(() => {
    if (!ENABLED) return
    if (mode === 'heic') {
      // What an iPhone photo looks like to a browser that cannot decode it:
      // an "image" type and bytes it cannot draw.
      Promise.resolve(new File([new Uint8Array([0, 0, 0, 24, 102, 116, 121, 112, 104, 101, 105, 99])], 'IMG_0001.HEIC', { type: 'image/heic' })).then(setFile)
    } else {
      makePng().then(setFile)
    }
  }, [mode])

  if (!ENABLED) notFound()
  if (!file) return null

  return (
    <div data-mode={mode}>
      <AvatarCropper
        file={file}
        saving={false}
        error={mode === 'refused' ? 'The upload could not reach the server. Check your connection and try again.' : ''}
        onCancel={() => setLog((l) => [...l, 'cancel'])}
        onCropped={(blob) => setLog((l) => [...l, `cropped ${blob.type} ${blob.size}b`])}
      />
      <pre id="log" style={{ position: 'fixed', top: 8, left: 8, zIndex: 100, color: 'var(--text)' }}>
        {log.join('\n')}
      </pre>
    </div>
  )
}

export default function CropperPreview() {
  return (
    <Suspense fallback={null}>
      <Inner />
    </Suspense>
  )
}
