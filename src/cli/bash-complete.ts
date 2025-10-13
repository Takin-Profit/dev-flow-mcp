#!/usr/bin/env node
/**
 * Bash Autocomplete Support
 * Handles bash completion for the dfm CLI
 */

import { proposeCompletions } from "@stricli/core"
import { app, buildCliContext } from "#cli/app.ts"

// Bash completion starts after argv[0] (node), argv[1] (script), argv[2] (command)
const COMPLETION_ARGS_START_INDEX = 3
const inputs = process.argv.slice(COMPLETION_ARGS_START_INDEX)

if (process.env.COMP_LINE?.endsWith(" ")) {
  inputs.push("")
}

try {
  for (const { completion } of await proposeCompletions(
    app,
    inputs,
    buildCliContext(process)
  )) {
    process.stdout.write(`${completion}\n`)
  }
} catch {
  // ignore errors during completion
}
