/** @type {import('next').NextConfig} */

// Safely extract just the origin from the Supabase URL.
// Guards against NEXT_PUBLIC_SUPABASE_URL being set with a path suffix
// (e.g. "https://abc.supabase.co/rest/v1/") — a common misconfiguration
// that causes auth/v1, storage/v1, and realtime paths to be blocked by CSP.
function getSupabaseOrigin() {
  const raw = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  try {
    return new URL(raw).origin   // strips any path, query, trailing slash
  } catch {
    return raw
  }
}

const supabaseOrigin = getSupabaseOrigin()
// wss:// is required for Supabase Realtime (WebSocket connections)
const supabaseWs = supabaseOrigin.replace(/^https/, 'wss')

const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['pdf-parse', 'jspdf', 'jspdf-autotable', '@google/genai'],
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "font-src 'self' https://fonts.gstatic.com",
              // Origin-level (no path suffix) covers ALL Supabase endpoints:
              //   /auth/v1/    — sign-in, token refresh
              //   /rest/v1/    — database queries
              //   /storage/v1/ — file uploads and signed URLs
              //   /functions/v1/ — edge functions
              // wss:// covers Supabase Realtime WebSocket connections
              `connect-src 'self' ${supabaseOrigin} ${supabaseWs} https://generativelanguage.googleapis.com https://api.groq.com`,
              // supabaseOrigin needed for <img> tags showing storage-signed URLs
              `img-src 'self' data: blob: ${supabaseOrigin}`,
              // supabaseOrigin needed for <iframe src={signedPdfUrl}> in VerificationForm
              // blob: needed for local PDF object URLs
              `frame-src 'self' blob: ${supabaseOrigin}`,
              "worker-src 'self' blob:",
            ].join('; '),
          },
        ],
      },
    ]
  },
}

module.exports = nextConfig