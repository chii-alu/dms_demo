import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Hides the round dev-only route indicator. Compile and runtime errors still show.
  devIndicators: false,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
