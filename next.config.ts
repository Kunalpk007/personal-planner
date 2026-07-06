import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // firebase-admin is already in Next.js's built-in server-external list;
  // the webpack build respects it correctly (Turbopack had a bug with this).
  serverExternalPackages: ['firebase-admin'],
};

export default nextConfig;
