/** @type {import('next').NextConfig} */
const nextConfig = {
  // @paydirt/shared is published as TypeScript source, so let Next transpile it.
  transpilePackages: ["@paydirt/shared"],
};

export default nextConfig;
