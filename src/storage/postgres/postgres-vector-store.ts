import type { EntityEmbedding, TemporalEntityType } from "#types"
import type { PostgresConfig } from "./postgres-config.js"
import type { PostgresConnectionManager } from "./postgres-connection-manager.js"

const TEST_VECTOR_VALUE = 0.1

/**
 * Vector store implementation using pgvector for PostgreSQL
 */
export class PostgresVectorStore {
  constructor(
    private readonly connectionManager: PostgresConnectionManager,
    private readonly config: PostgresConfig
  ) {}

  /**
   * Store or update an entity's embedding vector
   */
  async storeEntityVector(entityName: string, vector: number[]): Promise<void> {
    if (vector.length !== this.config.vectorDimensions) {
      throw new Error(
        `Vector dimension mismatch: expected ${this.config.vectorDimensions}, got ${vector.length}`
      )
    }

    // Convert number array to pgvector format
    const vectorString = `[${vector.join(",")}]`

    await this.connectionManager.query(
      `UPDATE entities 
       SET embedding = $1::vector, updated_at = NOW() 
       WHERE name = $2 AND valid_to IS NULL`,
      [vectorString, entityName]
    )
  }

  /**
   * Get an entity's embedding
   */
  async getEntityEmbedding(
    entityName: string
  ): Promise<EntityEmbedding | null> {
    const rows = await this.connectionManager.query<{
      embedding: string
      updated_at: string
    }>(
      `
      SELECT embedding, updated_at
      FROM entities 
      WHERE name = $1 AND valid_to IS NULL AND embedding IS NOT NULL
    `,
      [entityName]
    )

    if (rows.length === 0) {
      return null
    }

    const row = rows[0]
    // Parse pgvector format back to number array
    const vectorString = row.embedding.slice(1, -1) // Remove brackets
    const vector = vectorString.split(",").map(Number)

    return {
      entityName,
      vector,
      createdAt: new Date(row.updated_at).getTime(),
    }
  }

  /**
   * Find entities similar to a query vector using pgvector similarity search
   */
  async findSimilarEntities(
    queryVector: number[],
    limit = 10,
    minSimilarity = 0.6
  ): Promise<Array<TemporalEntityType & { similarity: number }>> {
    if (queryVector.length !== this.config.vectorDimensions) {
      throw new Error(
        `Query vector dimension mismatch: expected ${this.config.vectorDimensions}, got ${queryVector.length}`
      )
    }

    const queryVectorString = `[${queryVector.join(",")}]`
    const similarityOperator = this.getSimilarityOperator()
    const orderDirection = this.getOrderDirection()

    const rows = await this.connectionManager.query<{
      name: string
      entity_type: string
      observations: string[]
      created_at: string
      updated_at: string
      similarity: number
    }>(
      `
      SELECT 
        name, 
        entity_type, 
        observations, 
        created_at, 
        updated_at,
        1 - (embedding ${similarityOperator} $1::vector) as similarity
      FROM entities 
      WHERE valid_to IS NULL 
        AND embedding IS NOT NULL
        AND 1 - (embedding ${similarityOperator} $1::vector) >= $2
      ORDER BY embedding ${similarityOperator} $1::vector ${orderDirection}
      LIMIT $3
    `,
      [queryVectorString, minSimilarity, limit]
    )

    return rows.map((row) => ({
      name: row.name,
      entityType: row.entity_type,
      observations: row.observations || [],
      createdAt: new Date(row.created_at).getTime(),
      updatedAt: new Date(row.updated_at).getTime(),
      similarity: row.similarity,
    }))
  }

  /**
   * Count entities that have embeddings
   */
  async countEntitiesWithEmbeddings(): Promise<number> {
    const rows = await this.connectionManager.query<{ count: string }>(`
      SELECT COUNT(*) as count
      FROM entities 
      WHERE valid_to IS NULL AND embedding IS NOT NULL
    `)

    return Number.parseInt(rows[0]?.count || "0", 10)
  }

  /**
   * Get all entities with embeddings (for bulk operations)
   */
  async getAllEntitiesWithEmbeddings(): Promise<
    Array<TemporalEntityType & { vector: number[] }>
  > {
    const rows = await this.connectionManager.query<{
      name: string
      entity_type: string
      observations: string[]
      embedding: string
      created_at: string
      updated_at: string
    }>(`
      SELECT name, entity_type, observations, embedding, created_at, updated_at
      FROM entities 
      WHERE valid_to IS NULL AND embedding IS NOT NULL
      ORDER BY name
    `)

    return rows.map((row) => {
      // Parse pgvector format back to number array
      const vectorString = row.embedding.slice(1, -1) // Remove brackets
      const vector = vectorString.split(",").map(Number)

      return {
        name: row.name,
        entityType: row.entity_type,
        observations: row.observations || [],
        createdAt: new Date(row.created_at).getTime(),
        updatedAt: new Date(row.updated_at).getTime(),
        vector,
      }
    })
  }

  /**
   * Delete an entity's embedding
   */
  async deleteEntityEmbedding(entityName: string): Promise<void> {
    await this.connectionManager.query(
      `UPDATE entities 
       SET embedding = NULL, updated_at = NOW() 
       WHERE name = $1 AND valid_to IS NULL`,
      [entityName]
    )
  }

  /**
   * Get vector index statistics
   */
  async getVectorIndexStats(): Promise<Record<string, unknown>> {
    try {
      // Get index information
      const indexRows = await this.connectionManager.query<{
        indexname: string
        tablename: string
        indexdef: string
      }>(`
        SELECT indexname, tablename, indexdef
        FROM pg_indexes 
        WHERE tablename = 'entities' AND indexname LIKE '%embedding%'
      `)

      // Get table statistics
      const statsRows = await this.connectionManager.query<{
        n_tup_ins: number
        n_tup_upd: number
        n_tup_del: number
        n_live_tup: number
      }>(`
        SELECT n_tup_ins, n_tup_upd, n_tup_del, n_live_tup
        FROM pg_stat_user_tables 
        WHERE relname = 'entities'
      `)

      const embeddingCount = await this.countEntitiesWithEmbeddings()

      return {
        indexes: indexRows,
        tableStats: statsRows[0] || {},
        entitiesWithEmbeddings: embeddingCount,
        vectorDimensions: this.config.vectorDimensions,
        similarityFunction: this.config.vectorSimilarityFunction,
      }
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : "Unknown error",
      }
    }
  }

  /**
   * Get the appropriate similarity operator for pgvector based on config
   */
  private getSimilarityOperator(): string {
    switch (this.config.vectorSimilarityFunction) {
      case "cosine":
        return "<=>"
      case "l2":
        return "<->"
      case "inner_product":
        return "<#>"
      default:
        return "<=>" // Default to cosine
    }
  }

  /**
   * Get the appropriate order direction based on similarity function
   */
  private getOrderDirection(): string {
    // For distance operators, we want ascending order (smaller distance = more similar)
    // For inner product, we want descending order (larger value = more similar)
    return this.config.vectorSimilarityFunction === "inner_product"
      ? "DESC"
      : "ASC"
  }

  /**
   * Test vector search functionality
   */
  async testVectorSearch(): Promise<boolean> {
    try {
      // Create a test vector
      const testVector = new Array(this.config.vectorDimensions).fill(
        TEST_VECTOR_VALUE
      )
      const testVectorString = `[${testVector.join(",")}]`

      // Try a simple vector operation
      await this.connectionManager.query(
        "SELECT $1::vector <=> $1::vector as distance",
        [testVectorString]
      )

      return true
    } catch (_error) {
      return false
    }
  }
}
