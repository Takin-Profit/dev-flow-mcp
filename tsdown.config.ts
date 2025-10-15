/**
 * tsdown Build Configuration for DevFlow MCP
 *
 * This configuration handles the production build for the DevFlow MCP server.
 * It generates both the MCP server entry point and CLI tool binaries.
 *
 * Build Outputs:
 * - dist/server/index.js - Main MCP server entry point (ESM)
 * - dist/server/index.d.ts - TypeScript declarations for server
 * - dist/cli/index.js - CLI tool entry point (executable)
 * - dist/cli/bash-complete.js - Bash completion script (executable)
 *
 * The build uses Node.js 20+ as the target runtime and generates ESM modules.
 */

import { defineConfig } from "tsdown"

export default defineConfig({
  // ============================================================================
  // Entry Points
  // ============================================================================
  /**
   * Entry files for the build.
   * We have two main entry points:
   * 1. Server - The MCP protocol server (main export)
   * 2. CLI - Command-line interface tools
   */
  entry: {
    // Main MCP server entry point
    "server/index": "src/server/index.ts",

    // CLI tools (marked as executables via bin in package.json)
    "cli/index": "src/cli/index.ts",
    "cli/bash-complete": "src/cli/bash-complete.ts",
  },

  // ============================================================================
  // Output Configuration
  // ============================================================================
  /**
   * Output directory for all generated files
   */
  outDir: "dist",

  /**
   * Module format - ESM only since package.json has "type": "module"
   */
  format: ["esm"],

  /**
   * Use fixed .mjs extension for ES modules to ensure compatibility
   * This is important for Node.js module resolution
   */
  fixedExtension: false, // Use .js since package.json type is "module"

  /**
   * Clean the output directory before each build to remove stale files
   */
  clean: true,

  // ============================================================================
  // Platform & Target Configuration
  // ============================================================================
  /**
   * Target platform - Node.js runtime
   * This enables proper handling of Node.js built-in modules
   */
  platform: "node",

  /**
   * Compilation target - automatically determined from engines.node in package.json
   * Currently set to node >= 20.0.0
   *
   * Set to false to preserve modern JavaScript syntax without downleveling.
   * Since we're targeting Node.js 20+, we can use all modern features.
   */
  target: false, // Preserve modern syntax for Node.js 20+

  // ============================================================================
  // TypeScript Declaration Files
  // ============================================================================
  /**
   * Disable TypeScript declaration files (.d.ts)
   * This is a CLI application, not a library, so consumers don't need types
   */
  dts: false,

  // ============================================================================
  // Source Maps
  // ============================================================================
  /**
   * Disable source maps for production builds
   * This is a CLI tool running on the server, not a library
   * Source maps would just add unnecessary file size
   */
  sourcemap: false,

  // ============================================================================
  // Code Optimization
  // ============================================================================
  /**
   * Enable tree-shaking to remove unused code
   * This reduces bundle size by eliminating dead code
   */
  treeshake: true,

  /**
   * Disable minification for easier debugging of production builds
   * The code is already optimized by tree-shaking and runs server-side
   * where file size is less critical
   */
  minify: false,

  // ============================================================================
  // Dependencies
  // ============================================================================
  /**
   * External dependencies - these won't be bundled
   * All dependencies in package.json are external by default
   * They'll be installed via npm/pnpm when the package is installed
   */
  // Note: tsdown handles dependencies automatically from package.json

  /**
   * No external exceptions - all production dependencies stay external
   * This keeps the bundle small and allows consumers to manage versions
   */
  noExternal: [],

  // ============================================================================
  // Path Aliases
  // ============================================================================
  /**
   * Path alias configuration matching tsconfig.json
   * Resolves "#*" imports to "./src/*"
   */
  alias: {
    "#cli": "./src/cli",
    "#config": "./src/config.ts",
    "#embeddings": "./src/embeddings",
    "#knowledge-graph-manager": "./src/knowledge-graph-manager.ts",
    "#logger": "./src/logger.ts",
    "#server": "./src/server",
    "#storage": "./src/storage",
    "#types": "./src/types",
    "#utils": "./src/utils",
  },

  // ============================================================================
  // Module Protocol
  // ============================================================================
  /**
   * Add node: protocol prefix to Node.js built-in modules
   * This is the modern best practice for Node.js imports
   * E.g., import('fs') becomes import('node:fs')
   */
  nodeProtocol: true,

  // ============================================================================
  // Build Reporting
  // ============================================================================
  /**
   * Enable size reporting after build
   * Shows bundle sizes and helps identify large dependencies
   */
  report: true,

  /**
   * Log level for build output
   * Options: 'silent' | 'error' | 'warn' | 'info'
   */
  logLevel: "info",

  // ============================================================================
  // Additional Features
  // ============================================================================
  /**
   * Enable import.meta.glob support (Vite-style)
   * Useful for dynamic imports of multiple files
   */
  globImport: false, // Not needed for this project

  /**
   * Runtime shims for Node.js globals (like __dirname, __filename)
   * Not needed since we're targeting Node.js and use import.meta.url
   */
  shims: false,

  /**
   * Custom tsconfig path
   * Defaults to searching for tsconfig.json in the project root
   */
  tsconfig: "./tsconfig.json",
})
