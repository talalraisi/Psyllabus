import './globals.css'
import { Inter } from 'next/font/google'

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
})

export const metadata = {
  title: {
    default: 'PSyllabus',
    template: '%s · PSyllabus',
  },
  description: 'Track your IB, A-Level, or AP syllabus topic by topic. See where you are weak and know exactly what to study today.',
  keywords: ['IB', 'A-Level', 'AP', 'syllabus', 'study planner', 'exam prep'],
  authors: [{ name: 'Talal Al-Raisi' }],
}

export default function RootLayout({ children }) {
  return (
    <html lang="en" className="h-full">
      <body className={`${inter.className} min-h-full flex flex-col antialiased`}>
        {children}
      </body>
    </html>
  )
}