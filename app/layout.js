import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
})

export const viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f8f6f1' },
    { media: '(prefers-color-scheme: dark)', color: '#0f1412' },
  ],
}

export const metadata = {
  title: {
    // Both the browser tab and the blue link in search results read this
    // verbatim, so it is the bare name. What the product does belongs in the
    // description underneath, not bolted onto the title with a colon.
    default: 'Project Syllabus',
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
    title: 'Project Syllabus',
    description:
      'Syllabus tracking for IB, A-Level and AP students. Where you stand is set by testing, not by how confident you feel.',
    siteName: 'Project Syllabus',
    locale: 'en_GB',
    type: 'website',
    url: 'https://www.psyllabus.app',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Project Syllabus',
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

// Set the theme before the browser paints. Anything later and dark-mode users
// get a white flash on every navigation.
const themeScript = `(function(){try{
var t=localStorage.getItem('psyllabus:theme')||'system';
var d=t==='dark'||(t==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches);
document.documentElement.setAttribute('data-theme',d?'dark':'light');
document.documentElement.style.colorScheme=d?'dark':'light';
}catch(e){}})()`

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${inter.variable} h-full`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
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