/**
 * Application Configuration
 * Centralized configuration for environment variables, paths, and storage
 */

import { existsSync, mkdirSync } from "node:fs"
import path from "node:path"
import { consola } from "consola"
import xdgAppPaths from "xdg-app-paths"
import { z } from "zod"

// Re-export zod for convenience
export { z }

// Note: We inline these constants here to avoid circular dependencies
// The canonical values are defined in #types/constants
const DEFAULT_RATE_LIMIT_TOKENS = 150_000
const DEFAULT_RATE_LIMIT_INTERVAL = 60_000

// ============================================================================
// Environment Variables
// ============================================================================

/**
 * Environment variable schema using Zod
 * Defines all environment variables used by the application with validation
 */
const envSchema = z.object({
  // Application environment
  DFM_ENV: z
    .enum(["development", "production", "test", "testing"])
    .default("development"),

  // OpenAI Configuration
  DFM_OPENAI_API_KEY: z.string().optional(),
  DFM_OPENAI_EMBEDDING_MODEL: z.string().default("text-embedding-3-small"),

  // Embedding Configuration
  DFM_EMBEDDING_RATE_LIMIT_TOKENS: z.preprocess(
    (val) => (val ? Number(val) : DEFAULT_RATE_LIMIT_TOKENS),
    z.number().default(DEFAULT_RATE_LIMIT_TOKENS)
  ),
  DFM_EMBEDDING_RATE_LIMIT_INTERVAL: z.preprocess(
    (val) => (val ? Number(val) : DEFAULT_RATE_LIMIT_INTERVAL),
    z.number().default(DEFAULT_RATE_LIMIT_INTERVAL)
  ),
  DFM_MOCK_EMBEDDINGS: z.preprocess(
    (val) => val === "true" || val === true,
    z.boolean().default(false)
  ),

  // SQLite Configuration (minimal, user-facing)
  DFM_SQLITE_LOCATION: z.string().default("./devflow.db"),

  // Logging Configuration
  DFM_LOG_LEVEL: z.enum(["error", "warn", "info", "debug"]).default("info"),
  DFM_ENABLE_CONSOLE_LOGS: z.preprocess(
    (val) => val === "true" || val === true,
    z.boolean().default(false)
  ),

  // Debug Configuration
  DFM_DEBUG: z.preprocess(
    (val) => val === "true" || val === true,
    z.boolean().default(false)
  ),
})

// Debug: Log raw process.env before parsing
if (process.env.DFM_DEBUG === "true") {
  consola.debug("[CONFIG] Raw process.env.DFM_ENV:", process.env.DFM_ENV)
  consola.debug(
    "[CONFIG] Raw process.env.DFM_SQLITE_LOCATION:",
    process.env.DFM_SQLITE_LOCATION
  )
}

// Parse and validate environment variables
const parsedEnv = envSchema.safeParse(process.env)

if (!parsedEnv.success) {
  consola.error(
    "❌ Invalid environment variables:",
    JSON.stringify(parsedEnv.error.format(), null, 4)
  )
  process.exit(1)
}

export const env = parsedEnv.data

// Re-export zod for convenience
export { z }

// Debug: Log what zod parsed
if (env.DFM_DEBUG) {
  consola.debug("[CONFIG] Parsed env.DFM_ENV:", env.DFM_ENV)
  consola.debug(
    "[CONFIG] Parsed env.DFM_SQLITE_LOCATION:",
    env.DFM_SQLITE_LOCATION
  )
}

export type Env = z.infer<typeof envSchema>

export function getEnv<K extends keyof Env>(key: K): Env[K] {
  return env[key]
}

// ============================================================================
// Paths
// ============================================================================

/**
 * Initialize XDG paths for the application
 * This provides standard system directories for config, data, cache, logs, etc.
 */
export const appPaths = xdgAppPaths({ name: "devflow-mcp" })

/**
 * Get the log directory path
 * Logs go in the state directory as they track runtime state
 */
export function getLogDir(): string {
  return path.join(appPaths.state(), "log")
}

/**
 * Get the absolute path to the data directory
 * Uses XDG Base Directory specification for proper system integration
 * Creates the directory if it doesn't exist
 */
export function getDataDirectoryPath(): string {
  const dataDir = appPaths.data()

  if (!existsSync(dataDir)) {
    mkdirSync(dataDir, { recursive: true })
  }

  return dataDir
}

/**
 * Get the memory file path
 */
export function getMemoryFilePath(): string {
  const dataDir = getDataDirectoryPath()
  return path.join(dataDir, "memory.sqlite")
}
