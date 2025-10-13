import neo4j, {
  type Driver,
  type QueryResult,
  type Session,
} from "neo4j-driver"
import {
  DEFAULT_NEO4J_CONFIG,
  type Neo4jConfig,
} from "#storage/neo4j/neo4j-config.ts"

/**
 * Manages connections to a Neo4j database
 */
export class Neo4jConnectionManager {
  private readonly driver: Driver
  private readonly config: Neo4jConfig

  /**
   * Creates a new Neo4j connection manager
   * @param config Connection configuration
   */
  constructor(config?: Partial<Neo4jConfig>) {
    this.config = {
      ...DEFAULT_NEO4J_CONFIG,
      ...config,
    }

    this.driver = neo4j.driver(
      this.config.uri,
      neo4j.auth.basic(this.config.username, this.config.password),
      {}
    )
  }

  /**
   * Gets a Neo4j session for executing queries
   * @returns A Neo4j session
   */
  getSession(): Session {
    return this.driver.session({
      database: this.config.database,
    })
  }

  /**
   * Executes a Cypher query
   * @param query The Cypher query
   * @param parameters Query parameters
   * @returns Query result
   */
  async executeQuery(
    query: string,
    parameters: Record<string, unknown>
  ): Promise<QueryResult> {
    const session = this.getSession()
    try {
      return await session.run(query, parameters)
    } finally {
      await session.close()
    }
  }

  /**
   * Closes the Neo4j driver connection
   */
  async close(): Promise<void> {
    await this.driver.close()
  }

  /**
   * Gets the underlying Neo4j driver instance
   * @returns The Neo4j driver
   */
  getDriver(): Driver {
    return this.driver
  }

  /**
   * Verifies the connection to the Neo4j database
   * @returns A promise that resolves if the connection is successful
   * @throws Error if connection verification fails
   */
  async verifyConnectivity(): Promise<void> {
    // Use getServerInfo() which internally calls verifyConnectivityAndGetServerInfo()
    // This is the recommended non-deprecated approach in Neo4j driver v5
    await this.driver.getServerInfo({ database: this.config.database })
  }
}
