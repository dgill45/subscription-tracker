import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // Fix for monorepo-style setup - set the root for output file tracing
  outputFileTracingRoot: path.join(__dirname, "../"),
};

export default nextConfig;
