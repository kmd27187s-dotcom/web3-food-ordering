import { fileURLToPath } from "node:url";

const appRoot = fileURLToPath(new URL("./", import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: "standalone",
  outputFileTracingRoot: appRoot,
  experimental: {
    devtoolSegmentExplorer: false
  }
};

export default nextConfig;
