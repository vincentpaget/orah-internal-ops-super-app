import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ['jsforce', '@slack/web-api'],
  // Blueprint HTML is read from disk at request time, so it must be bundled with the route.
  outputFileTracingIncludes: {
    '/api/blueprints/*': ['./content/blueprints/**/*'],
  },
};

export default nextConfig;
