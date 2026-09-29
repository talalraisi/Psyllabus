/**
 * Headers, and why each one is here.
 *
 * There were none. Every page shipped with whatever defaults the platform
 * happened to set, which for a product holding minors' exam results is not a
 * position to be in — and it is the cheapest thing on any security checklist
 * to fix, because none of it requires touching the app.
 *
 * The Content-Security-Policy is deliberately Report-Only to begin with. A
 * wrong CSP does not warn, it silently stops scripts running, and finding that
 * out from a student whose quiz will not submit is the worst possible way. It
 * reports for a while, we read what it would have blocked, and then it is
 * enforced.
 */

const SUPABASE = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://*.supabase.co'

/* 'unsafe-inline' for scripts is here because the theme script in the layout
   runs inline before paint — it has to, or every page flashes the wrong theme
   on load — and Next inlines its own bootstrap. Tightening this means moving
   to per-request nonces in the proxy, which is a real change and wants its own
   pass rather than being smuggled into a headers commit. */
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self' data:",
  `img-src 'self' data: blob: ${SUPABASE}`,
  `connect-src 'self' ${SUPABASE} https://*.supabase.co wss://*.supabase.co`,
  "form-action 'self'",
  // Nothing on this site should ever be framed. Clickjacking a quiz is not a
  // dramatic attack, but the answer to "can this be framed" should be no.
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "object-src 'none'",
  'upgrade-insecure-requests',
].join('; ')

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactCompiler: true,
  images: {
    // Avoid serving stale logos after you replace public/logo.png
    minimumCacheTTL: 0,
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          // HTTPS for two years, subdomains included. This is the header that
          // makes "enforce HTTPS everywhere" true rather than aspirational:
          // without it the first request of a session can still go in clear.
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
          // Stop the browser guessing a type it was not given. An avatar
          // uploaded as a JPEG should never be run as anything else.
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          // Belt and braces with frame-ancestors, for anything old enough not
          // to read CSP.
          { key: 'X-Frame-Options', value: 'DENY' },
          // Do not leak the page somebody was on to whoever they click through
          // to. A subtopic in a URL says what a student is weak at.
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          // Nothing here needs any of these, so nothing here may ask.
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
          },
          { key: 'Content-Security-Policy-Report-Only', value: csp },
        ],
      },
    ]
  },
}

export default nextConfig
