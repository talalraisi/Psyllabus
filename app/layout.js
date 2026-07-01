import { Plus_Jakarta_Sans } from 'next/font/google'
import './globals.css'

const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
})

export const metadata = {
  title: {
    default: 'PSyllabus',
    template: '%s · PSyllabus',
  },
  description:
    'Track your IB, A-Level, or AP syllabus topic by topic. See where you are weak and know exactly what to study today.',
  keywords: ['IB', 'A-Level', 'AP', 'syllabus', 'study planner', 'exam prep'],
  authors: [{ name: 'Talal Al-Raisi' }],
  openGraph: {
    title: 'PSyllabus — Know exactly what to study next',
    description:
      'Syllabus-mapped progress tracking for IB, A-Level, and AP students.',
    siteName: 'PSyllabus',
    locale: 'en_GB',
    type: 'website',
  },
}

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${jakarta.variable} h-full`}>
      <body className="min-h-full flex flex-col bg-[var(--bg,#FAFAF8)] text-[var(--text,#1C1917)] font-sans antialiased">
        {children}
      </body>
    </html>
  )
}