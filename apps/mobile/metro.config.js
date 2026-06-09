// Metro config for a pnpm monorepo. Lets Metro watch the workspace root and
// resolve both the local and hoisted node_modules, plus the @paydirt/shared
// TypeScript source. See https://docs.expo.dev/guides/monorepos/
const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];
// pnpm uses symlinks; don't walk up the tree past our explicit paths.
config.resolver.disableHierarchicalLookup = true;

module.exports = config;
