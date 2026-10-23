/** @type {import('next').NextConfig} */
const nextConfig = {
  // Static export (apps/web/out) — PocketBase serves it from --publicDir on bb.
  output: "export",
  // @paydirt/shared is published as TypeScript source, so let Next transpile it.
  transpilePackages: ["@paydirt/shared"],
};

export default nextConfig;
