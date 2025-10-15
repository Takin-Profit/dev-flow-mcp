import assert from "node:assert/strict"
import { afterEach, beforeEach, describe, it } from "node:test"
import type { PostgresConfig } from "./postgres-config.js"
import { DEFAULT_POSTGRES_CONFIG } from "./postgres-config.js"
import { PostgresStorageProvider } from "./postgres-storage-provider.js"

const DEFAULT_POSTGRES_PORT = 5432
const DEFAULT_VECTOR_DIMENSIONS = 1536

// Mock configuration for testing
const TEST_CONFIG: PostgresConfig = {
  ...DEFAULT_POSTGRES_CONFIG,
  database: "devflow_mcp_test",
  graphName: "test_graph",
} as PostgresConfig

describe("PostgresStorageProvider", () => {
  let provider: PostgresStorageProvider

  beforeEach(() => {
    // Note: This test requires a running PostgreSQL instance with AGE and pgvector
    // In a real implementation, you'd use a test database or mocking
    provider = new PostgresStorageProvider(TEST_CONFIG)
  })

  afterEach(async () => {
    // Clean up connections
    await provider.close()
  })

  it("should create a storage provider instance", () => {
    assert.ok(provider instanceof PostgresStorageProvider)
  })

  it("should have connection manager", () => {
    const connectionManager = provider.getConnectionManager()
    assert.ok(connectionManager)
  })

  // Note: Additional tests would require actual PostgreSQL setup
  // This is just a structural example
})

describe("PostgresConfig", () => {
  it("should have default configuration", () => {
    assert.strictEqual(DEFAULT_POSTGRES_CONFIG.host, "localhost")
    assert.strictEqual(DEFAULT_POSTGRES_CONFIG.port, DEFAULT_POSTGRES_PORT)
    assert.strictEqual(
      DEFAULT_POSTGRES_CONFIG.vectorDimensions,
      DEFAULT_VECTOR_DIMENSIONS
    )
    assert.strictEqual(
      DEFAULT_POSTGRES_CONFIG.vectorSimilarityFunction,
      "cosine"
    )
  })
})
