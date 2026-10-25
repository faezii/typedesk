import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // PDF fonts are read by @react-pdf at runtime (lib/pdf-fonts.ts), so tracing can't see them.
  outputFileTracingIncludes: { "/api/**/*": ["./assets/fonts/*"] },
  experimental: {
    serverActions: { bodySizeLimit: "15mb" },
  },
};

export default nextConfig;
