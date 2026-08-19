import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
})

export const viewport = {
  themeColor: '#2D6A4F',
}

export const metadata = {
  title: {
    default: 'PSyllabus',
    template: '%s · PSyllabus',
  },
  manifest: '/manifest.json',
  icons: {
    apple: '/apple-touch-icon.png',
  },
  appleWebApp: {
    capable: true,
    title: 'PSyllabus',
    statusBarStyle: 'default',
  },
  description:
    'Track your IB, A-Level, or AP syllabus topic by topic. See where you are weak and know exactly what to study today.',
  keywords: ['IB', 'A-Level', 'AP', 'syllabus', 'study planner', 'exam prep'],
  authors: [{ name: 'Talal Al-Raisi' }],
  metadataBase: new URL('https://www.psyllabus.app'),
  openGraph: {
    title: 'PSyllabus: Know exactly what to study next',
    description:
      'Syllabus-mapped progress tracking for IB, A-Level, and AP students. Status is set by testing, never self-rating.',
    siteName: 'PSyllabus',
    locale: 'en_GB',
    type: 'website',
    url: 'https://www.psyllabus.app',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'PSyllabus: Know exactly what to study next',
    description:
      'Syllabus-mapped progress tracking for IB, A-Level, and AP students.',
  },
}

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${inter.variable} h-full`}>
      <body className="min-h-full flex flex-col bg-[var(--bg,#FAFAF8)] text-[var(--text,#1C1917)] font-sans antialiased">
        {children}
      </body>
    </html>
  )
}