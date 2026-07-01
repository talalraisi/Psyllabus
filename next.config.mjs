/** @type {import('next').NextConfig} */
const nextConfig = {
  reactCompiler: true,
  images: {
    // Avoid serving stale logos after you replace public/logo.png
    minimumCacheTTL: 0,
  },
};

export default nextConfig;
