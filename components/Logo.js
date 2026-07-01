import Image from 'next/image'
import logo from '@/public/logo.png'

export default function Logo({ width = 300, height = 90, className = '', priority = false }) {
  return (
    <Image
      src={logo}
      alt="PSyllabus"
      width={width}
      height={height}
      priority={priority}
      className={className}
      style={{ height: `${height}px`, width: 'auto', maxWidth: 'none' }}
    />
  )
}
