import type {
  Entity,
  KnowledgeGraph,
  Relation,
  SearchOptions,
  TemporalEntityType,
} from "#types"
import type { StorageProvider } from "../storage-provider.js"
import type { PostgresConfig } from "./postgres-config.js"
import { PostgresConnectionManager } from "./postgres-connection-manager.js"

const DEFAULT_SEARCH_LIMIT = 50
const DEFAULT_RELATION_STRENGTH = 1.0
const DEFAULT_RELATION_CONFIDENCE = 1.0
import { PostgresSchemaManager } from "./postgres-schema-manager.js"

/**
 * PostgreSQL storage provider using Apache AGE for graph operations and pgvector for embeddings
 */
export class PostgresStorageProvider implements StorageProvider {
  private readonly connectionManager: PostgresConnectionManager
  private readonly schemaManager: PostgresSchemaManager

  constructor(config: PostgresConfig) {
    this.config = config
    this.connectionManager = new PostgresConnectionManager(config)
    this.schemaManager = new PostgresSchemaManager(
      this.connectionManager,
      config
    )
  }

  /**
   * Initialize the storage provider
   */
  async initialize(): Promise<void> {
    const isInitialized = await this.schemaManager.isSchemaInitialized()
    if (!isInitialized) {
      await this.schemaManager.initializeSchema()
    }
  }

  async loadGraph(): Promise<KnowledgeGraph> {
    // Load all entities
    const entityRows = await this.connectionManager.query<{
      name: string
      entity_type: string
      observations: string[]
      created_at: string
      updated_at: string
    }>(`
      SELECT name, entity_type, observations, created_at, updated_at
      FROM entities 
      WHERE valid_to IS NULL
      ORDER BY name
    `)

    const entities: TemporalEntityType[] = entityRows.map((row) => ({
      name: row.name,
      entityType: row.entity_type,
      observations: row.observations || [],
      createdAt: new Date(row.created_at).getTime(),
      updatedAt: new Date(row.updated_at).getTime(),
    }))

    // Load all relations
    const relationRows = await this.connectionManager.query<{
      from_entity: string
      to_entity: string
      relation_type: string
      strength: number
      confidence: number
      metadata: Record<string, unknown>
      created_at: string
      updated_at: string
    }>(`
      SELECT from_entity, to_entity, relation_type, strength, confidence, metadata, created_at, updated_at
      FROM relations 
      WHERE valid_to IS NULL
      ORDER BY from_entity, to_entity, relation_type
    `)

    const relations: Relation[] = relationRows.map((row) => ({
      from: row.from_entity,
      to: row.to_entity,
      relationType: row.relation_type,
      strength: row.strength,
      confidence: row.confidence,
      metadata: row.metadata || {},
      createdAt: new Date(row.created_at).getTime(),
      updatedAt: new Date(row.updated_at).getTime(),
    }))

    return { entities, relations }
  }

  async saveGraph(graph: KnowledgeGraph): Promise<void> {
    // This is a bulk operation - for now, we'll implement it as individual operations
    // In a production implementation, you'd want to use transactions and bulk operations

    if (graph.entities.length > 0) {
      await this.createEntities(graph.entities)
    }

    if (graph.relations.length > 0) {
      await this.createRelations(graph.relations)
    }
  }

  async searchNodes(
    query: string,
    options?: SearchOptions
  ): Promise<KnowledgeGraph> {
    // Simple text search implementation
    const searchPattern = `%${query.toLowerCase()}%`

    const entityRows = await this.connectionManager.query<{
      name: string
      entity_type: string
      observations: string[]
      created_at: string
      updated_at: string
    }>(
      `
      SELECT name, entity_type, observations, created_at, updated_at
      FROM entities 
      WHERE valid_to IS NULL
        AND (
          LOWER(name) LIKE $1 
          OR LOWER(entity_type) LIKE $1
          OR EXISTS (
            SELECT 1 FROM unnest(observations) AS obs 
            WHERE LOWER(obs) LIKE $1
          )
        )
      ORDER BY name
      LIMIT $2
    `,
      [searchPattern, options?.limit || DEFAULT_SEARCH_LIMIT]
    )

    const entities: TemporalEntityType[] = entityRows.map((row) => ({
      name: row.name,
      entityType: row.entity_type,
      observations: row.observations || [],
      createdAt: new Date(row.created_at).getTime(),
      updatedAt: new Date(row.updated_at).getTime(),
    }))

    // Get relations for found entities
    const entityNames = entities.map((e) => e.name)
    const relations =
      entityNames.length > 0
        ? await this.getRelationsForEntities(entityNames)
        : []

    return { entities, relations }
  }

  async openNodes(names: string[]): Promise<KnowledgeGraph> {
    if (names.length === 0) {
      return { entities: [], relations: [] }
    }

    const placeholders = names.map((_, i) => `$${i + 1}`).join(",")

    const entityRows = await this.connectionManager.query<{
      name: string
      entity_type: string
      observations: string[]
      created_at: string
      updated_at: string
    }>(
      `
      SELECT name, entity_type, observations, created_at, updated_at
      FROM entities 
      WHERE valid_to IS NULL AND name IN (${placeholders})
      ORDER BY name
    `,
      names
    )

    const entities: TemporalEntityType[] = entityRows.map((row) => ({
      name: row.name,
      entityType: row.entity_type,
      observations: row.observations || [],
      createdAt: new Date(row.created_at).getTime(),
      updatedAt: new Date(row.updated_at).getTime(),
    }))

    const relations = await this.getRelationsForEntities(names)

    return { entities, relations }
  }

  async createEntities(entities: Entity[]): Promise<TemporalEntityType[]> {
    const results: TemporalEntityType[] = []

    for (const entity of entities) {
      const now = new Date()

      const rows = await this.connectionManager.query<{
        name: string
        entity_type: string
        observations: string[]
        created_at: string
        updated_at: string
      }>(
        `
        INSERT INTO entities (name, entity_type, observations, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $4)
        ON CONFLICT (name) DO UPDATE SET
          entity_type = EXCLUDED.entity_type,
          observations = EXCLUDED.observations,
          updated_at = EXCLUDED.updated_at
        RETURNING name, entity_type, observations, created_at, updated_at
      `,
        [entity.name, entity.entityType, entity.observations, now]
      )

      if (rows.length > 0) {
        const row = rows[0]
        results.push({
          name: row.name,
          entityType: row.entity_type,
          observations: row.observations || [],
          createdAt: new Date(row.created_at).getTime(),
          updatedAt: new Date(row.updated_at).getTime(),
        })
      }
    }

    return results
  }

  async createRelations(relations: Relation[]): Promise<Relation[]> {
    const results: Relation[] = []

    for (const relation of relations) {
      const now = new Date()

      const rows = await this.connectionManager.query<{
        from_entity: string
        to_entity: string
        relation_type: string
        strength: number
        confidence: number
        metadata: Record<string, unknown>
        created_at: string
        updated_at: string
      }>(
        `
        INSERT INTO relations (from_entity, to_entity, relation_type, strength, confidence, metadata, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $7)
        ON CONFLICT (from_entity, to_entity, relation_type, valid_from) DO UPDATE SET
          strength = EXCLUDED.strength,
          confidence = EXCLUDED.confidence,
          metadata = EXCLUDED.metadata,
          updated_at = EXCLUDED.updated_at
        RETURNING from_entity, to_entity, relation_type, strength, confidence, metadata, created_at, updated_at
      `,
        [
          relation.from,
          relation.to,
          relation.relationType,
          relation.strength || DEFAULT_RELATION_STRENGTH,
          relation.confidence || DEFAULT_RELATION_CONFIDENCE,
          JSON.stringify(relation.metadata || {}),
          now,
        ]
      )

      if (rows.length > 0) {
        const row = rows[0]
        results.push({
          from: row.from_entity,
          to: row.to_entity,
          relationType: row.relation_type,
          strength: row.strength,
          confidence: row.confidence,
          metadata: row.metadata || {},
          createdAt: new Date(row.created_at).getTime(),
          updatedAt: new Date(row.updated_at).getTime(),
        })
      }
    }

    return results
  }

  async addObservations(
    observations: { entityName: string; contents: string[] }[]
  ): Promise<{ entityName: string; addedObservations: string[] }[]> {
    const results: { entityName: string; addedObservations: string[] }[] = []

    for (const { entityName, contents } of observations) {
      // Get current observations
      const currentRows = await this.connectionManager.query<{
        observations: string[]
      }>(
        "SELECT observations FROM entities WHERE name = $1 AND valid_to IS NULL",
        [entityName]
      )

      if (currentRows.length === 0) {
        throw new Error(`Entity '${entityName}' not found`)
      }

      const currentObservations = currentRows[0].observations || []
      const newObservations = [...currentObservations, ...contents]

      await this.connectionManager.query(
        "UPDATE entities SET observations = $1, updated_at = NOW() WHERE name = $2 AND valid_to IS NULL",
        [newObservations, entityName]
      )

      results.push({
        entityName,
        addedObservations: contents,
      })
    }

    return results
  }

  async deleteEntities(entityNames: string[]): Promise<void> {
    if (entityNames.length === 0) {
      return
    }

    const placeholders = entityNames.map((_, i) => `$${i + 1}`).join(",")

    // Soft delete by setting valid_to
    await this.connectionManager.query(
      `UPDATE entities SET valid_to = NOW() WHERE name IN (${placeholders}) AND valid_to IS NULL`,
      entityNames
    )

    // Also soft delete related relations
    await this.connectionManager.query(
      `UPDATE relations SET valid_to = NOW() 
       WHERE (from_entity IN (${placeholders}) OR to_entity IN (${placeholders})) 
       AND valid_to IS NULL`,
      [...entityNames, ...entityNames]
    )
  }

  async deleteObservations(
    deletions: { entityName: string; observations: string[] }[]
  ): Promise<void> {
    for (const { entityName, observations } of deletions) {
      // Get current observations
      const currentRows = await this.connectionManager.query<{
        observations: string[]
      }>(
        "SELECT observations FROM entities WHERE name = $1 AND valid_to IS NULL",
        [entityName]
      )

      if (currentRows.length === 0) {
        continue // Entity not found, skip
      }

      const currentObservations = currentRows[0].observations || []
      const filteredObservations = currentObservations.filter(
        (obs) => !observations.includes(obs)
      )

      await this.connectionManager.query(
        "UPDATE entities SET observations = $1, updated_at = NOW() WHERE name = $2 AND valid_to IS NULL",
        [filteredObservations, entityName]
      )
    }
  }

  async deleteRelations(relations: Relation[]): Promise<void> {
    for (const relation of relations) {
      await this.connectionManager.query(
        `UPDATE relations 
         SET valid_to = NOW() 
         WHERE from_entity = $1 AND to_entity = $2 AND relation_type = $3 AND valid_to IS NULL`,
        [relation.from, relation.to, relation.relationType]
      )
    }
  }

  async getEntity(entityName: string): Promise<TemporalEntityType | null> {
    const rows = await this.connectionManager.query<{
      name: string
      entity_type: string
      observations: string[]
      created_at: string
      updated_at: string
    }>(
      `
      SELECT name, entity_type, observations, created_at, updated_at
      FROM entities 
      WHERE name = $1 AND valid_to IS NULL
    `,
      [entityName]
    )

    if (rows.length === 0) {
      return null
    }

    const row = rows[0]
    return {
      name: row.name,
      entityType: row.entity_type,
      observations: row.observations || [],
      createdAt: new Date(row.created_at).getTime(),
      updatedAt: new Date(row.updated_at).getTime(),
    }
  }

  /**
   * Helper method to get relations for specific entities
   */
  private async getRelationsForEntities(
    entityNames: string[]
  ): Promise<Relation[]> {
    if (entityNames.length === 0) {
      return []
    }

    const placeholders = entityNames.map((_, i) => `$${i + 1}`).join(",")

    const relationRows = await this.connectionManager.query<{
      from_entity: string
      to_entity: string
      relation_type: string
      strength: number
      confidence: number
      metadata: Record<string, unknown>
      created_at: string
      updated_at: string
    }>(
      `
      SELECT from_entity, to_entity, relation_type, strength, confidence, metadata, created_at, updated_at
      FROM relations 
      WHERE valid_to IS NULL 
        AND (from_entity IN (${placeholders}) OR to_entity IN (${placeholders}))
      ORDER BY from_entity, to_entity, relation_type
    `,
      [...entityNames, ...entityNames]
    )

    return relationRows.map((row) => ({
      from: row.from_entity,
      to: row.to_entity,
      relationType: row.relation_type,
      strength: row.strength,
      confidence: row.confidence,
      metadata: row.metadata || {},
      createdAt: new Date(row.created_at).getTime(),
      updatedAt: new Date(row.updated_at).getTime(),
    }))
  }

  /**
   * Get connection manager for diagnostics
   */
  getConnectionManager(): PostgresConnectionManager {
    return this.connectionManager
  }

  /**
   * Close the storage provider
   */
  async close(): Promise<void> {
    await this.connectionManager.close()
  }
}
