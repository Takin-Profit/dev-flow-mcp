#!/usr/bin/env node
/**
 * CLI Entry Point
 * Main entry for the dfm CLI application
 */

import { run } from "@stricli/core"
import { app, buildCliContext } from "#cli/app.ts"

await run(app, process.argv.slice(2), buildCliContext(process))
