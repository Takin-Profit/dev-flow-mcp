/**
 * Configuration interface for PostgreSQL storage provider
 */
export type PostgresConfig = {
  /** PostgreSQL connection string or connection options */
  connectionString?: string
  host?: string
  port?: number
  database?: string
  username?: string
  password?: string

  /** Apache AGE graph name */
  graphName: string

  /** Vector search configuration */
  vectorDimensions: number
  vectorSimilarityFunction: "cosine" | "l2" | "inner_product"

  /** Connection pool settings */
  maxConnections?: number
  idleTimeoutMillis?: number
  connectionTimeoutMillis?: number
}

/**
 * Default PostgreSQL configuration
 */
export const DEFAULT_POSTGRES_CONFIG: Partial<PostgresConfig> = {
  host: "localhost",
  port: 5432,
  database: "devflow_mcp",
  graphName: "knowledge_graph",
  vectorDimensions: 1536,
  vectorSimilarityFunction: "cosine",
  maxConnections: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5000,
} as const
