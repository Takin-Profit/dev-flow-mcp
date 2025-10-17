/**
 * Neo4j Schema Manager
 *
 * Manages Neo4j database schema operations including:
 * - Creating and managing constraints
 * - Creating and managing indexes
 * - Creating vector indexes for semantic search
 * - Schema initialization and verification
 *
 * Design Notes:
 * - Accepts logger via constructor injection
 * - Handles both modern and legacy Neo4j syntax
 * - Provides detailed logging for troubleshooting
 * - Type-safe with proper error handling
 */

import {
  DEFAULT_NEO4J_CONFIG,
  type Neo4jConfig,
} from "#db/neo4j/neo4j-config"
import type { Neo4jConnectionManager } from "#db/neo4j/neo4j-connection-manager"
import type { Logger } from "#types"
import { createNoOpLogger } from "#types"

/**
 * Similarity function types for vector indexes
 */
export type SimilarityFunction = "cosine" | "euclidean"

/**
 * Configuration for Neo4j schema manager
 */
export type Neo4jSchemaManagerConfig = {
  /** Neo4j configuration options */
  config?: Partial<Neo4jConfig>
  /** Enable debug logging (default: true) */
  debug?: boolean
  /** Logger instance for dependency injection */
  logger?: Logger
}

/**
 * Manages Neo4j schema operations
 *
 * This class:
 * - Creates and verifies database constraints
 * - Creates and manages vector indexes for embeddings
 * - Handles schema initialization
 * - Provides comprehensive logging for troubleshooting
 * - Supports both modern and legacy Neo4j syntax
 */
export class Neo4jSchemaManager {
  private readonly connectionManager: Neo4jConnectionManager
  private readonly config: Neo4jConfig
  private readonly debug: boolean
  private readonly logger: Logger

  /**
   * Creates a new Neo4j schema manager
   *
   * @param connectionManager - Neo4j connection manager instance
   * @param options - Configuration options including logger
   */
  constructor(
    connectionManager: Neo4jConnectionManager,
    options: Neo4jSchemaManagerConfig = {}
  ) {
    this.connectionManager = connectionManager
    this.config = {
      ...DEFAULT_NEO4J_CONFIG,
      ...options.config,
    }
    this.debug = options.debug ?? true
    this.logger = options.logger ?? createNoOpLogger()

    this.logger.debug("Neo4jSchemaManager initialized", {
      debug: this.debug,
      vectorIndexName: this.config.vectorIndexName,
      vectorDimensions: this.config.vectorDimensions,
      similarityFunction: this.config.similarityFunction,
    })
  }

  /**
   * Log debug messages if debug mode is enabled
   *
   * @param message - Debug message to log
   * @param meta - Additional metadata
   */
  private log(message: string, meta?: Record<string, unknown>): void {
    if (this.debug) {
      this.logger.debug(`[Neo4jSchemaManager] ${message}`, meta)
    }
  }

  /**
   * Lists all constraints in the database
   *
   * @returns Array of constraint information
   */
  async listConstraints(): Promise<Record<string, unknown>[]> {
    this.log("Listing existing constraints...")

    try {
      const result = await this.connectionManager.executeQuery(
        "SHOW CONSTRAINTS",
        {}
      )
      const constraints = result.records.map((record) => record.toObject())
      this.log("Constraints listed successfully", { count: constraints.length })
      return constraints
    } catch (error) {
      this.logger.error("Failed to list constraints", error)
      throw error
    }
  }

  /**
   * Lists all indexes in the database
   *
   * @returns Array of index information
   */
  async listIndexes(): Promise<Record<string, unknown>[]> {
    this.log("Listing existing indexes...")

    try {
      const result = await this.connectionManager.executeQuery(
        "SHOW INDEXES",
        {}
      )
      const indexes = result.records.map((record) => record.toObject())
      this.log("Indexes listed successfully", { count: indexes.length })
      return indexes
    } catch (error) {
      this.logger.error("Failed to list indexes", error)
      throw error
    }
  }

  /**
   * Drops a constraint if it exists
   *
   * @param name - Name of the constraint to drop
   * @returns True if successful, false otherwise
   */
  async dropConstraintIfExists(name: string): Promise<boolean> {
    this.log("Dropping constraint if exists", { constraintName: name })

    try {
      await this.connectionManager.executeQuery(
        `DROP CONSTRAINT ${name} IF EXISTS`,
        {}
      )
      this.log("Constraint dropped successfully", { constraintName: name })
      return true
    } catch (error) {
      this.logger.warn("Failed to drop constraint", {
        constraintName: name,
        error,
      })
      return false
    }
  }

  /**
   * Drops an index if it exists
   *
   * @param name - Name of the index to drop
   * @returns True if successful, false otherwise
   */
  async dropIndexIfExists(name: string): Promise<boolean> {
    this.log("Dropping index if exists", { indexName: name })

    try {
      await this.connectionManager.executeQuery(
        `DROP INDEX ${name} IF EXISTS`,
        {}
      )
      this.log("Index dropped successfully", { indexName: name })
      return true
    } catch (error) {
      this.logger.warn("Failed to drop index", {
        indexName: name,
        error,
      })
      return false
    }
  }

  /**
   * Creates a unique constraint on entity names
   *
   * Creates a composite uniqueness constraint on (name, validTo) to ensure
   * temporal entity uniqueness in the knowledge graph.
   *
   * @param recreate - Whether to drop and recreate the constraint if it exists
   */
  async createEntityConstraints(recreate = false): Promise<void> {
    this.log("Creating entity name constraint...", { recreate })

    const constraintName = "entity_name"

    if (recreate) {
      await this.dropConstraintIfExists(constraintName)
    }

    // Create a composite uniqueness constraint on name and validTo
    const query = `
      CREATE CONSTRAINT entity_name IF NOT EXISTS
      FOR (e:Entity)
      REQUIRE (e.name, e.validTo) IS UNIQUE
    `

    try {
      await this.connectionManager.executeQuery(query, {})
      this.log("Entity name constraint created", { constraintName })

      // Verify the constraint was created
      const constraints = await this.listConstraints()
      const found = constraints.some((c) => c.name === constraintName)
      this.log("Constraint verification", {
        constraintName,
        found,
        totalConstraints: constraints.length,
      })

      if (!found) {
        this.logger.warn("Constraint was not found after creation", {
          constraintName,
        })
      }
    } catch (error) {
      this.logger.error("Failed to create entity constraint", error, {
        constraintName,
      })
      throw error
    }
  }

  /**
   * Creates a vector index for storing and querying embeddings
   *
   * Vector indexes enable semantic search via similarity functions (cosine, euclidean).
   * The index must be ONLINE before it can be used for queries.
   *
   * @param options - Configuration options for vector index creation
   */
  async createVectorIndex(options: {
    indexName: string
    nodeLabel: string
    propertyName: string
    dimensions: number
    similarityFunction?: SimilarityFunction
    recreate?: boolean
  }): Promise<void> {
    const {
      indexName,
      nodeLabel,
      propertyName,
      dimensions,
      similarityFunction,
      recreate = false,
    } = options
    this.log("Creating vector index", {
      indexName,
      nodeLabel,
      propertyName,
      dimensions,
      similarityFunction: similarityFunction || this.config.similarityFunction,
      recreate,
    })

    if (recreate) {
      await this.dropIndexIfExists(indexName)
    }

    const query = `
      CREATE VECTOR INDEX ${indexName} IF NOT EXISTS
      FOR (n:${nodeLabel})
      ON (n.${propertyName})
      OPTIONS {
        indexConfig: {
          \`vector.dimensions\`: ${dimensions},
          \`vector.similarity_function\`: '${similarityFunction || this.config.similarityFunction}'
        }
      }
    `

    try {
      this.log("Executing vector index creation query", { indexName, query })
      await this.connectionManager.executeQuery(query, {})
      this.log("Vector index creation query executed", { indexName })

      // Verify the index was created
      const exists = await this.vectorIndexExists(indexName)
      this.log("Vector index verification", { indexName, exists })

      if (!exists) {
        this.logger.warn(
          "Vector index was not found or not ONLINE after creation",
          {
            indexName,
          }
        )
        const allIndexes = await this.listIndexes()
        this.logger.warn("All indexes", { allIndexes })
      }
    } catch (error) {
      this.logger.error("Failed to create vector index", error, {
        indexName,
        nodeLabel,
        propertyName,
        dimensions,
      })
      throw error
    }
  }

  /**
   * Checks if a vector index exists and is ONLINE
   *
   * Tries modern syntax first, falls back to legacy syntax for older Neo4j versions.
   * Only returns true if the index exists AND is in ONLINE state.
   *
   * @param indexName - The name of the vector index to check
   * @returns True if the index exists and is ONLINE, false otherwise
   */
  async vectorIndexExists(indexName: string): Promise<boolean> {
    this.log("Checking if vector index exists and is ONLINE", { indexName })

    try {
      // Try modern syntax (Neo4j 5.13+)
      const result = await this.connectionManager.executeQuery(
        "SHOW VECTOR INDEXES WHERE name = $indexName",
        { indexName }
      )

      if (result.records.length === 0) {
        this.log("Vector index does not exist", { indexName })
        return false
      }

      // Type guard for array access
      const firstRecord = result.records[0]
      if (!firstRecord) {
        this.log("No records found for vector index", { indexName })
        return false
      }

      const state = firstRecord.get("state")
      const isOnline = state === "ONLINE"

      this.log("Vector index state checked", { indexName, state, isOnline })

      if (!isOnline) {
        this.logger.warn("Vector index exists but is not ONLINE", {
          indexName,
          state,
        })
      }

      return isOnline
    } catch (error) {
      this.log(
        "Error checking vector index with modern syntax, trying fallback",
        {
          indexName,
          error: error instanceof Error ? error.message : String(error),
        }
      )

      // Try legacy syntax for older Neo4j versions
      try {
        const fallbackResult = await this.connectionManager.executeQuery(
          'SHOW INDEXES WHERE type = "VECTOR" AND name = $indexName',
          { indexName }
        )

        if (fallbackResult.records.length === 0) {
          this.log("Vector index does not exist (fallback check)", {
            indexName,
          })
          return false
        }

        // Type guard for array access
        const firstRecord = fallbackResult.records[0]
        if (!firstRecord) {
          this.log("No records found for vector index (fallback)", {
            indexName,
          })
          return false
        }

        const state = firstRecord.get("state")
        const isOnline = state === "ONLINE"

        this.log("Vector index state checked (fallback)", {
          indexName,
          state,
          isOnline,
        })

        if (!isOnline) {
          this.logger.warn("Vector index exists but is not ONLINE (fallback)", {
            indexName,
            state,
          })
        }

        return isOnline
      } catch (fallbackError) {
        this.logger.error(
          "Failed to check vector index with both modern and legacy syntax",
          fallbackError,
          {
            indexName,
          }
        )
        return false
      }
    }
  }

  /**
   * Waits for a vector index to be ONLINE
   *
   * @param indexName - The name of the vector index to wait for
   * @param timeout - Timeout in milliseconds (default: 30000)
   */
  async waitForVectorIndex(
    indexName: string,
    timeout = 120_000
  ): Promise<void> {
    this.log("Waiting for vector index to be ONLINE", { indexName, timeout })

    const startTime = Date.now()

    while (Date.now() - startTime < timeout) {
      try {
        const isOnline = await this.vectorIndexExists(indexName)
        if (isOnline) {
          this.log("Vector index is ONLINE", { indexName })
          return
        }
      } catch (error) {
        this.logger.warn("Error checking vector index status", {
          indexName,
          error,
        })
      }

      // Wait for a short interval before checking again
      await new Promise((resolve) => setTimeout(resolve, 500))
    }

    throw new Error(
      `Timed out waiting for vector index ${indexName} to be ONLINE`
    )
  }

  /**
   * Initializes the complete schema
   *
   * Creates all necessary constraints and indexes for the knowledge graph:
   * - Entity name uniqueness constraint
   * - Vector index for entity embeddings
   *
   * @param recreate - Whether to drop and recreate existing constraints and indexes
   */
  async initializeSchema(recreate = false): Promise<void> {
    this.log("Initializing Neo4j schema...", { recreate })

    try {
      // Create constraints
      await this.createEntityConstraints(recreate)

      // Create vector index for entity embeddings
      const indexName = this.config.vectorIndexName
      const nodeLabel = "Entity"
      const propertyName = "embedding"
      const dimensions = this.config.vectorDimensions
      const similarityFunction = this.config.similarityFunction

      if (recreate) {
        await this.dropIndexIfExists(indexName)
      }

      const query = `
        CREATE VECTOR INDEX ${indexName} IF NOT EXISTS
        FOR (n:${nodeLabel})
        ON (n.${propertyName})
        OPTIONS {
          indexConfig: {
            \`vector.dimensions\`: ${dimensions},
            \`vector.similarity_function\`: '${similarityFunction}'
          }
        }
      `

      await this.connectionManager.executeQuery(query, {})

      this.logger.info("Schema initialization complete", {
        indexName,
        dimensions,
        similarityFunction,
      })
    } catch (error) {
      this.logger.error("Failed to initialize schema", error)
      throw error
    }
  }

  /**
   * Closes the connection manager
   *
   * Should be called when the schema manager is no longer needed.
   */
  async close(): Promise<void> {
    this.log("Closing connection manager")

    try {
      await this.connectionManager.close()
      this.log("Connection manager closed successfully")
    } catch (error) {
      this.logger.error("Failed to close connection manager", error)
      throw error
    }
  }
}
