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
    // Search engines show this verbatim, so it leads with the product name.
    default: 'Project Syllabus: IB, A-Level and AP syllabus tracker',
    template: '%s · Project Syllabus',
  },
  manifest: '/manifest.json',
  applicationName: 'Project Syllabus',
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/icon-192.png', type: 'image/png', sizes: '192x192' },
      { url: '/icon-512.png', type: 'image/png', sizes: '512x512' },
    ],
    shortcut: '/favicon.ico',
    apple: '/apple-touch-icon.png',
  },
  alternates: { canonical: 'https://www.psyllabus.app' },
  robots: { index: true, follow: true },
  appleWebApp: {
    capable: true,
    title: 'Project Syllabus',
    statusBarStyle: 'default',
  },
  description:
    'Project Syllabus tracks your IB, A-Level or AP syllabus topic by topic, shows you where you are weak, and tells you what to study today.',
  keywords: ['IB', 'A-Level', 'AP', 'syllabus', 'study planner', 'exam prep'],
  authors: [{ name: 'Talal Al-Raisi' }],
  metadataBase: new URL('https://www.psyllabus.app'),
  openGraph: {
    title: 'Project Syllabus: know exactly what to study next',
    description:
      'Syllabus tracking for IB, A-Level and AP students. Where you stand is set by testing, not by how confident you feel.',
    siteName: 'Project Syllabus',
    locale: 'en_GB',
    type: 'website',
    url: 'https://www.psyllabus.app',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Project Syllabus: know exactly what to study next',
    description:
      'Syllabus tracking for IB, A-Level and AP students.',
  },
}

// Tells Google this is one product with a logo, which is what produces a
// branded result with the mark rather than a generic globe.
const organisationSchema = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'Project Syllabus',
  alternateName: ['PSyllabus', 'P Syllabus'],
  url: 'https://www.psyllabus.app',
  logo: 'https://www.psyllabus.app/icon-512.png',
  description:
    'Syllabus tracking for IB, A-Level and AP students. Where you stand is set by testing, not by how confident you feel.',
  foundingLocation: { '@type': 'Place', name: 'Muscat, Oman' },
}

const siteSchema = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: 'Project Syllabus',
  alternateName: 'PSyllabus',
  url: 'https://www.psyllabus.app',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${inter.variable} h-full`}>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify([organisationSchema, siteSchema]),
          }}
        />
      </head>
      <body className="min-h-full flex flex-col bg-[var(--bg,#FAFAF8)] text-[var(--text,#1C1917)] font-sans antialiased">
        {children}
      </body>
    </html>
  )
}