import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  output: "standalone",
};

export default withSentryConfig(nextConfig, {
  org: "freddie-software-solutions",
  project: "javascript-nextjs",
  silent: !process.env.CI,
  widenClientFileUpload: true,
});
