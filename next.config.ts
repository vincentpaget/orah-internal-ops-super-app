import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ['jsforce', '@slack/web-api'],
};

export default nextConfig;
