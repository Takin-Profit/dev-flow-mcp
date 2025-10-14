/**
 * Neo4j Configuration
 *
 * Re-exports Neo4jConfig from types for backward compatibility.
 * The type is now defined in src/types/storage.ts with arktype validation.
 */

export type { Neo4jConfig } from "#types/storage"

/**
 * Default Neo4j configuration
 */
export const DEFAULT_NEO4J_CONFIG = {
  uri: "bolt://localhost:7687",
  username: "neo4j",
  password: "memento_password",
  database: "neo4j",
  vectorIndexName: "entity_embeddings",
  vectorDimensions: 1536,
  similarityFunction: "cosine",
} as const satisfies import("#types/storage").Neo4jConfig
