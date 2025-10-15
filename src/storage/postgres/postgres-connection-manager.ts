import { Pool, type PoolClient } from "pg"
import type { PostgresConfig } from "./postgres-config.js"

/**
 * Manages PostgreSQL database connections using connection pooling
 */
export class PostgresConnectionManager {
  private readonly pool: Pool
  private readonly config: PostgresConfig

  constructor(config: PostgresConfig) {
    this.config = config

    // Create connection pool
    this.pool = new Pool({
      connectionString: config.connectionString,
      host: config.host,
      port: config.port,
      database: config.database,
      user: config.username,
      password: config.password,
      max: config.maxConnections,
      idleTimeoutMillis: config.idleTimeoutMillis,
      connectionTimeoutMillis: config.connectionTimeoutMillis,
    })

    // Handle pool errors
    this.pool.on("error", (_err) => {
      // Pool errors are handled by the pool itself
    })
  }

  /**
   * Get a client from the connection pool
   */
  getClient(): Promise<PoolClient> {
    return this.pool.connect()
  }

  /**
   * Execute a query with automatic client management
   */
  async query<T = unknown>(text: string, params?: unknown[]): Promise<T[]> {
    const client = await this.getClient()
    try {
      const result = await client.query(text, params)
      return result.rows as T[]
    } finally {
      client.release()
    }
  }

  /**
   * Execute an Apache AGE cypher query
   */
  async cypherQuery<T = unknown>(
    cypherQuery: string,
    _params?: Record<string, unknown>
  ): Promise<T[]> {
    const client = await this.getClient()
    try {
      // Apache AGE cypher queries are executed as PostgreSQL functions
      const query = "SELECT * FROM cypher($1, $2) AS (result agtype)"
      const result = await client.query(query, [
        this.config.graphName,
        cypherQuery,
      ])
      return result.rows.map((row) => row.result) as T[]
    } finally {
      client.release()
    }
  }

  /**
   * Test the database connection
   */
  async testConnection(): Promise<boolean> {
    try {
      const client = await this.getClient()
      try {
        await client.query("SELECT 1")
        return true
      } finally {
        client.release()
      }
    } catch (_error) {
      return false
    }
  }

  /**
   * Close all connections in the pool
   */
  async close(): Promise<void> {
    await this.pool.end()
  }

  /**
   * Get pool statistics
   */
  getPoolStats() {
    return {
      totalCount: this.pool.totalCount,
      idleCount: this.pool.idleCount,
      waitingCount: this.pool.waitingCount,
    }
  }
}
