#!/usr/bin/env node
/**
 * MCP Server Entry Point
 * Legacy entry point for backward compatibility
 *
 * This file maintains backward compatibility with the old `dfm-server` command.
 * For new deployments, use: `dfm mcp` instead
 *
 * @deprecated Use `dfm mcp` command instead
 */

import { fileURLToPath } from "node:url"
import startMcpServer from "#server"

// Check if this module is being run directly
const isMainModule = process.argv[1] === fileURLToPath(import.meta.url)

// Only initialize if running as main module, not when imported
if (isMainModule) {
  startMcpServer().catch((error) => {
    console.error("Fatal error starting MCP server:", error)
    process.exit(1)
  })
}
