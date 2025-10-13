/**
 * Stricli Application Definition
 * Central CLI app configuration and context
 */

import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import {
  buildInstallCommand,
  buildUninstallCommand,
  type StricliAutoCompleteContext,
} from "@stricli/auto-complete"
import type { CommandContext } from "@stricli/core"
import { buildApplication, buildRouteMap } from "@stricli/core"
import { mcpCommand } from "#cli/mcp.ts"
import { neo4jRoutes } from "#cli/neo4j.ts"

// Package info
const name = "dfm"
const version = "1.0.0"
const description = "DevFlow MCP - Development workflow knowledge graph"

/**
 * CLI Context
 * Provides access to Node.js APIs for commands
 */
export interface AppContext {
  readonly process: NodeJS.Process
  readonly os: typeof os
  readonly fs: typeof fs
  readonly path: typeof path
}

export type CliContext = CommandContext & StricliAutoCompleteContext & AppContext

/**
 * Build CLI context
 */
export function buildCliContext(process: NodeJS.Process): AppContext {
  return {
    process,
    os,
    fs,
    path,
  }
}

/**
 * CLI Application Routes
 */
const routes = buildRouteMap({
  routes: {
    mcp: mcpCommand,
    neo4j: neo4jRoutes,
    install: buildInstallCommand("dfm", { bash: "__dfm_bash_complete" }),
    uninstall: buildUninstallCommand("dfm", { bash: true }),
  },
  docs: {
    brief: description,
    hideRoute: {
      install: true,
      uninstall: true,
    },
  },
})

/**
 * CLI Application
 */
export const app = buildApplication(routes, {
  name,
  versionInfo: {
    currentVersion: version,
  },
})
