import type { NextConfig } from "next";

// Only real, currently-active external origins are listed here.
// Pusher is not yet configured (no cluster/keys set) - its domains must be
// added to connect-src/script-src once it's activated, or realtime silently
// breaks under CSP with no server-side error.
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://accounts.google.com https://js.stripe.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://utfs.io https://*.uploadthing.com https://lh3.googleusercontent.com https://picsum.photos https://fastly.picsum.photos https://i.pravatar.cc",
  "font-src 'self' data:",
  "connect-src 'self' https://utfs.io https://*.uploadthing.com https://api.stripe.com",
  "frame-src 'self' https://accounts.google.com https://js.stripe.com https://hooks.stripe.com",
  "form-action 'self' https://accounts.google.com",
  "frame-ancestors 'self'",
  "base-uri 'self'",
  "object-src 'none'",
].join('; ');

const nextConfig: NextConfig = {
  reactCompiler: true,
  output: 'standalone', // Docker deployment support
  poweredByHeader: false,

  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'utfs.io', // Uploadthing
      },
      {
        protocol: 'https',
        hostname: '*.uploadthing.com',
      },
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com', // Google OAuth avatars
      },
    ],
  },

  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Content-Security-Policy', value: CSP },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ];
  },
};

export default nextConfig;
