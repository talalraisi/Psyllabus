import Image from 'next/image'
import logo from '@/public/logo.png'

/**
 * The wordmark on the auth and onboarding screens.
 *
 * `sizes` is not optional here. Without it next/image assumes the logo could
 * fill the viewport and the browser downloads a multi-hundred-kilobyte re-encode
 * of a 2000px source to draw something around 100px tall. The source is square,
 * so the rendered width tracks the height.
 */
export default function Logo({ width = 300, height = 90, className = '', priority = false }) {
  return (
    <Image
      src={logo}
      alt="Project Syllabus"
      width={width}
      height={height}
      priority={priority}
      sizes={`${height}px`}
      className={className}
      style={{ height: `${height}px`, width: 'auto', maxWidth: 'none' }}
    />
  )
}
