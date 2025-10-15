import type { PostgresConfig } from "./postgres-config.js"
import type { PostgresConnectionManager } from "./postgres-connection-manager.js"

/**
 * Manages database schema initialization for Apache AGE and pgvector
 */
export class PostgresSchemaManager {
  constructor(
    private readonly connectionManager: PostgresConnectionManager,
    private readonly config: PostgresConfig
  ) {}

  /**
   * Initialize the complete database schema
   */
  async initializeSchema(): Promise<void> {
    await this.enableExtensions()
    await this.createGraph()
    await this.createEntityTable()
    await this.createRelationTable()
    await this.createVectorIndexes()
  }

  /**
   * Enable required PostgreSQL extensions
   */
  private async enableExtensions(): Promise<void> {
    // Enable Apache AGE extension
    await this.connectionManager.query("CREATE EXTENSION IF NOT EXISTS age")

    // Enable pgvector extension for vector operations
    await this.connectionManager.query("CREATE EXTENSION IF NOT EXISTS vector")

    // Load AGE into the current session
    await this.connectionManager.query("LOAD 'age'")
    await this.connectionManager.query(
      "SET search_path = ag_catalog, '$user', public"
    )
  }

  /**
   * Create the Apache AGE graph
   */
  private async createGraph(): Promise<void> {
    try {
      await this.connectionManager.query("SELECT create_graph($1)", [
        this.config.graphName,
      ])
    } catch (error) {
      // Graph might already exist, check if it's a "already exists" error
      if (error instanceof Error && error.message.includes("already exists")) {
        // Graph already exists, continue
      } else {
        throw error
      }
    }
  }

  /**
   * Create entity table with vector support
   */
  private async createEntityTable(): Promise<void> {
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS entities (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) UNIQUE NOT NULL,
        entity_type VARCHAR(100) NOT NULL,
        observations TEXT[] DEFAULT '{}',
        embedding vector(${this.config.vectorDimensions}),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        valid_from TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        valid_to TIMESTAMP WITH TIME ZONE
      )
    `

    await this.connectionManager.query(createTableQuery)

    // Create indexes
    await this.connectionManager.query(
      "CREATE INDEX IF NOT EXISTS idx_entities_name ON entities(name)"
    )
    await this.connectionManager.query(
      "CREATE INDEX IF NOT EXISTS idx_entities_type ON entities(entity_type)"
    )
    await this.connectionManager.query(
      "CREATE INDEX IF NOT EXISTS idx_entities_created_at ON entities(created_at)"
    )
  }

  /**
   * Create relation table
   */
  private async createRelationTable(): Promise<void> {
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS relations (
        id SERIAL PRIMARY KEY,
        from_entity VARCHAR(255) NOT NULL,
        to_entity VARCHAR(255) NOT NULL,
        relation_type VARCHAR(100) NOT NULL,
        strength DECIMAL(3,2) DEFAULT 1.0 CHECK (strength >= 0.0 AND strength <= 1.0),
        confidence DECIMAL(3,2) DEFAULT 1.0 CHECK (confidence >= 0.0 AND confidence <= 1.0),
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        valid_from TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        valid_to TIMESTAMP WITH TIME ZONE,
        UNIQUE(from_entity, to_entity, relation_type, valid_from)
      )
    `

    await this.connectionManager.query(createTableQuery)

    // Create indexes
    await this.connectionManager.query(
      "CREATE INDEX IF NOT EXISTS idx_relations_from ON relations(from_entity)"
    )
    await this.connectionManager.query(
      "CREATE INDEX IF NOT EXISTS idx_relations_to ON relations(to_entity)"
    )
    await this.connectionManager.query(
      "CREATE INDEX IF NOT EXISTS idx_relations_type ON relations(relation_type)"
    )
    await this.connectionManager.query(
      "CREATE INDEX IF NOT EXISTS idx_relations_created_at ON relations(created_at)"
    )
  }

  /**
   * Create vector indexes for similarity search
   */
  private async createVectorIndexes(): Promise<void> {
    const indexType = this.getVectorIndexType()

    const createIndexQuery = `
      CREATE INDEX IF NOT EXISTS idx_entities_embedding 
      ON entities 
      USING ${indexType} (embedding)
    `

    await this.connectionManager.query(createIndexQuery)
  }

  /**
   * Get the appropriate vector index type based on similarity function
   */
  private getVectorIndexType(): string {
    switch (this.config.vectorSimilarityFunction) {
      case "cosine":
        return "ivfflat (embedding vector_cosine_ops)"
      case "l2":
        return "ivfflat (embedding vector_l2_ops)"
      case "inner_product":
        return "ivfflat (embedding vector_ip_ops)"
      default:
        return "ivfflat (embedding vector_cosine_ops)"
    }
  }

  /**
   * Drop all schema objects (for testing/reset)
   */
  async dropSchema(): Promise<void> {
    // Drop tables
    await this.connectionManager.query("DROP TABLE IF EXISTS relations CASCADE")
    await this.connectionManager.query("DROP TABLE IF EXISTS entities CASCADE")

    // Drop graph
    try {
      await this.connectionManager.query("SELECT drop_graph($1, true)", [
        this.config.graphName,
      ])
    } catch (_error) {
      // Graph might not exist or already dropped
    }
  }

  /**
   * Check if schema is properly initialized
   */
  async isSchemaInitialized(): Promise<boolean> {
    try {
      // Check if extensions are enabled
      const extensions = await this.connectionManager.query<{
        extname: string
      }>("SELECT extname FROM pg_extension WHERE extname IN ('age', 'vector')")

      if (extensions.length < 2) {
        return false
      }

      // Check if tables exist
      const tables = await this.connectionManager.query<{ tablename: string }>(
        "SELECT tablename FROM pg_tables WHERE tablename IN ('entities', 'relations')"
      )

      if (tables.length < 2) {
        return false
      }

      // Check if graph exists
      const graphs = await this.connectionManager.query<{ name: string }>(
        "SELECT name FROM ag_graph WHERE name = $1",
        [this.config.graphName]
      )

      return graphs.length > 0
    } catch (_error) {
      return false
    }
  }
}
