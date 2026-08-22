export default function robots() {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        // Signed-in areas hold personal data and have no search value.
        disallow: ['/dashboard/', '/onboarding', '/auth/'],
      },
    ],
    sitemap: 'https://www.psyllabus.app/sitemap.xml',
  }
}
