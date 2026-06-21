import type { NextConfig } from "next";

// Applied to every route. HSTS is already added by Vercel's edge, so it's not
// repeated here. The CSP is intentionally scoped to `frame-ancestors` only —
// it blocks clickjacking without risking the script/style/connect sources the
// app depends on. A full content CSP (script-src/connect-src/…) should be
// added separately once it's been verified in a browser.
const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
