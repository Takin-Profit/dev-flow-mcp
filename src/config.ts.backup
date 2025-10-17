/**
 * Application Configuration
 * Centralized configuration for environment variables, paths, and storage
 */

import { existsSync, mkdirSync } from "node:fs"
import path from "node:path"
import { consola } from "consola"
import xdgAppPaths from "xdg-app-paths"
import { z } from "zod"
import { StorageProviderFactory } from "#db/storage-provider-factory"
import type { VectorStoreFactoryOptions } from "#db/vector-store-factory"
import {
  DEFAULT_RATE_LIMIT_INTERVAL,
  DEFAULT_RATE_LIMIT_TOKENS,
  DEFAULT_VECTOR_DIMENSIONS,
} from "#types"

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

  // Storage Configuration
  DFM_STORAGE_TYPE: z.enum(["neo4j"]).default("neo4j"),

  // Neo4j Configuration
  NEO4J_URI: z.string().default("bolt://localhost:7687"),
  NEO4J_USERNAME: z.string().default("neo4j"),
  NEO4J_PASSWORD: z.string().default("dfm_password"),
  NEO4J_DATABASE: z.string().default("neo4j"),
  NEO4J_VECTOR_INDEX: z.string().default("entity_embeddings"),
  NEO4J_VECTOR_DIMENSIONS: z.preprocess(
    (val) => (val ? Number(val) : DEFAULT_VECTOR_DIMENSIONS),
    z.number().default(DEFAULT_VECTOR_DIMENSIONS)
  ),
  NEO4J_SIMILARITY_FUNCTION: z.enum(["cosine", "euclidean"]).default("cosine"),

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
  consola.debug("[CONFIG] Raw process.env.NEO4J_URI:", process.env.NEO4J_URI)
  consola.debug(
    "[CONFIG] Raw process.env.NEO4J_PASSWORD:",
    process.env.NEO4J_PASSWORD ? "***SET***" : "undefined"
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

// Debug: Log what zod parsed
if (env.DFM_DEBUG) {
  consola.debug("[CONFIG] Parsed env.DFM_ENV:", env.DFM_ENV)
  consola.debug("[CONFIG] Parsed env.NEO4J_URI:", env.NEO4J_URI)
  consola.debug("[CONFIG] Parsed env.NEO4J_PASSWORD:", env.NEO4J_PASSWORD)
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

// ============================================================================
// Storage Configuration
// ============================================================================

/**
 * Configuration for storage providers
 */
export type StorageConfig = {
  type: "neo4j"
  options: {
    neo4jUri?: string
    neo4jUsername?: string
    neo4jPassword?: string
    neo4jDatabase?: string
    neo4jVectorIndexName?: string
    neo4jVectorDimensions?: number
    neo4jSimilarityFunction?: "cosine" | "euclidean"
  }
  vectorStoreOptions?: VectorStoreFactoryOptions
}

/**
 * Determines the storage type based on the environment variable
 */
export function determineStorageType(_envType: string | undefined): "neo4j" {
  // Always return neo4j regardless of input
  return "neo4j"
}

/**
 * Creates a storage configuration object using validated environment variables
 */
export function createStorageConfig(
  storageType: string | undefined
): StorageConfig {
  const storageProviderType = determineStorageType(storageType)

  const config: StorageConfig = {
    type: storageProviderType,
    options: {
      neo4jUri: env.NEO4J_URI,
      neo4jUsername: env.NEO4J_USERNAME,
      neo4jPassword: env.NEO4J_PASSWORD,
      neo4jDatabase: env.NEO4J_DATABASE,
      neo4jVectorIndexName: env.NEO4J_VECTOR_INDEX,
      neo4jVectorDimensions: env.NEO4J_VECTOR_DIMENSIONS,
      neo4jSimilarityFunction: env.NEO4J_SIMILARITY_FUNCTION,
    },
  }

  return config
}

/**
 * Initializes the storage provider based on environment variables
 */
export function initializeStorageProvider(): ReturnType<
  StorageProviderFactory["createProvider"]
> {
  const factory = new StorageProviderFactory()
  const config = createStorageConfig(env.DFM_STORAGE_TYPE)

  return factory.createProvider(config)
}
