// Copyright 2025 Takin Profit. All rights reserved.
/** biome-ignore-all lint/suspicious/useAwait: will be converted to async once nodejs implements the async api */
// SQLite implementation of StorageProvider interface

import { randomUUID } from "node:crypto"
import type { DB } from "@takinprofit/sqlite-x"
import { raw } from "@takinprofit/sqlite-x"
import type {
  Entity,
  EntityEmbedding,
  ExtendedEntity,
  ExtendedRelation,
  KnowledgeGraph,
  Logger,
  Relation,
  SearchOptions,
  SemanticSearchOptions,
  TemporalEntityType,
} from "#types"
import {
  DEFAULT_HALF_LIFE_DAYS,
  DEFAULT_MIN_CONFIDENCE,
  DEFAULT_RELATION_CONFIDENCE,
  DEFAULT_RELATION_STRENGTH,
  HALF_LIFE_DECAY_CONSTANT,
  HOURS_PER_DAY,
  MILLISECONDS_PER_SECOND,
  MINUTES_PER_HOUR,
  SECONDS_PER_MINUTE,
  SQLITE_DEFAULT_SEARCH_LIMIT,
  SQLITE_DEFAULT_TRAVERSAL_DEPTH,
} from "#types/constants"
import type { StorageProvider } from "#types/storage"
import { SqliteVectorStore } from "#db/sqlite-vector-store"

// Add at top of class or as module function
function generateUUID(): string {
  return randomUUID()
}

type EntityRow = {
  id: string // ADD: UUID
  name: string
  entity_type: "feature" | "task" | "decision" | "component" | "test"
  observations: string // JSON string
  embedding: string | null // ADD: JSON string of number array
  version: number // ADD
  created_at: number
  updated_at: number
  valid_from: number // ADD
  valid_to: number | null // ADD
  changed_by: string | null // ADD
}

type RelationRow = {
  id: string // UUID
  from_entity_id: string // References entities.id
  to_entity_id: string // References entities.id
  from_entity_name: string // Denormalized for performance
  to_entity_name: string // Denormalized for performance
  relation_type: "implements" | "depends_on" | "relates_to" | "part_of"
  strength: number
  confidence: number
  metadata: string // JSON string
  version: number
  created_at: number
  updated_at: number
  valid_from: number
  valid_to: number | null
  changed_by: string | null
}

export class SqliteDb implements StorageProvider {
  private readonly db: DB
  private readonly logger: Logger
  private readonly vectorStore: SqliteVectorStore
  private vectorStoreInitialized: boolean = false
  private readonly decayConfig: {
    enabled: boolean
    halfLifeDays: number
    minConfidence: number
  }

  constructor(
    db: DB,
    logger: Logger,
    options?: {
      decayConfig?: {
        enabled: boolean
        halfLifeDays?: number
        minConfidence?: number
      }
      vectorDimensions?: number
    }
  ) {
    this.db = db
    this.logger = logger

    // Initialize vector store
    this.vectorStore = new SqliteVectorStore({
      db,
      dimensions: options?.vectorDimensions ?? 1536,
      logger,
    })

    // Configure decay settings
    this.decayConfig = {
      enabled: options?.decayConfig?.enabled ?? true,
      halfLifeDays: options?.decayConfig?.halfLifeDays ?? DEFAULT_HALF_LIFE_DAYS,
      minConfidence: options?.decayConfig?.minConfidence ?? DEFAULT_MIN_CONFIDENCE,
    }
  }

  /**
   * Ensure vector store is initialized before use
   */
  private async ensureVectorStoreInitialized(): Promise<void> {
    if (!this.vectorStoreInitialized) {
      await this.vectorStore.initialize()
      this.vectorStoreInitialized = true
    }
  }

  /**
   * Resolves entity name to current entity ID
   * @param name - Entity name to resolve
   * @returns Current entity ID or null if not found
   */
  private resolveEntityNameToCurrentId(name: string): string | null {
    const result = this.db.sql<{ name: string }>`
      SELECT id FROM entities
      WHERE name = ${"$name"} AND valid_to IS NULL
    `.get<{ id: string }>({ name })

    return result?.id ?? null
  }

  /**
   * Batch resolves entity names to current IDs
   * @param names - Array of entity names
   * @returns Map of name -> id (excludes not found)
   */
  private resolveEntityNamesToIds(names: string[]): Map<string, string> {
    if (names.length === 0) return new Map()

    const uniqueNames = [...new Set(names)]

    // For each unique name, query the database
    const results: Array<{ name: string; id: string }> = []
    for (const name of uniqueNames) {
      const result = this.db.sql<{ name: string }>`
        SELECT name, id FROM entities
        WHERE name = ${"$name"} AND valid_to IS NULL
      `.get<{ name: string; id: string }>({ name })

      if (result) {
        results.push(result)
      }
    }

    return new Map(results.map(r => [r.name, r.id]))
  }

  /**
   * Updates denormalized entity names in relations when entity is renamed
   * @param entityId - Entity ID (doesn't change)
   * @param newName - New entity name
   */
  private updateRelationEntityNames(entityId: string, newName: string): void {
    const now = Date.now()

    // Update all current relations where this entity appears as source
    this.db.sql<{ name: string; id: string; updated_at: number }>`
      UPDATE relations
      SET from_entity_name = ${"$name"}, updated_at = ${"$updated_at"}
      WHERE from_entity_id = ${"$id"} AND valid_to IS NULL
    `.run({ name: newName, id: entityId, updated_at: now })

    // Update all current relations where this entity appears as target
    this.db.sql<{ name: string; id: string; updated_at: number }>`
      UPDATE relations
      SET to_entity_name = ${"$name"}, updated_at = ${"$updated_at"}
      WHERE to_entity_id = ${"$id"} AND valid_to IS NULL
    `.run({ name: newName, id: entityId, updated_at: now })
  }

  async loadGraph(): Promise<KnowledgeGraph> {
    this.logger.info("Loading entire knowledge graph from SQLite")

    try {
      // Load all CURRENT entities (valid_to IS NULL)
      const entityRows = this.db.sql`
      SELECT * FROM entities WHERE valid_to IS NULL
    `.all<EntityRow>()

      // Load all CURRENT relations (valid_to IS NULL)
      const relationRows = this.db.sql`
      SELECT * FROM relations WHERE valid_to IS NULL
    `.all<RelationRow>()

      // Convert rows to domain types
      const entities = entityRows.map((row) => this.rowToEntity(row))
      const relations = relationRows.map((row) => this.rowToRelation(row))

      this.logger.info("Loaded knowledge graph", {
        entityCount: entities.length,
        relationCount: relations.length,
      })

      return { entities, relations }
    } catch (error) {
      this.logger.error("Failed to load knowledge graph", { error })
      throw error
    }
  }

  async saveGraph(graph: KnowledgeGraph): Promise<void> {
    this.logger.info("Saving knowledge graph to SQLite", {
      entityCount: graph.entities.length,
      relationCount: graph.relations.length,
    })

    try {
      // Clear existing data
      this.db.exec("DELETE FROM relations")
      this.db.exec("DELETE FROM entities")

      const now = Date.now()

      // Insert entities in batches
      if (graph.entities.length > 0) {
        const entityRows = graph.entities.map((entity) => {
          const extendedEntity = entity as ExtendedEntity
          return {
            id: extendedEntity.id || generateUUID(),
            name: entity.name,
            entity_type: entity.entityType,
            observations: JSON.stringify(entity.observations || []),
            embedding: null, // Will be populated separately via updateEntityEmbedding
            version: extendedEntity.version || 1,
            created_at: extendedEntity.createdAt || now,
            updated_at: extendedEntity.updatedAt || now,
            valid_from: extendedEntity.validFrom || now,
            valid_to: extendedEntity.validTo || null,
            changed_by: extendedEntity.changedBy || null,
          }
        })

        this.db.sql<EntityRow>`
        INSERT INTO entities ${{ values: ["*", { batch: true }] }}
      `.run(entityRows)
      }

      // Insert relations in batches
      if (graph.relations.length > 0) {
        // Collect all entity names from relations
        const allNames = new Set<string>()
        for (const rel of graph.relations) {
          allNames.add(rel.from)
          allNames.add(rel.to)
        }

        // Batch resolve names to current entity IDs
        const nameToIdMap = this.resolveEntityNamesToIds([...allNames])

        const relationRows = graph.relations.map((relation) => {
          const extendedRelation = relation as ExtendedRelation
          return {
            id: extendedRelation.id || generateUUID(),
            from_entity_id: nameToIdMap.get(relation.from) || generateUUID(),
            to_entity_id: nameToIdMap.get(relation.to) || generateUUID(),
            from_entity_name: relation.from,
            to_entity_name: relation.to,
            relation_type: relation.relationType,
            strength: relation.strength ?? DEFAULT_RELATION_STRENGTH,
            confidence: relation.confidence ?? DEFAULT_RELATION_CONFIDENCE,
            metadata: JSON.stringify(relation.metadata || {}),
            version: extendedRelation.version || 1,
            created_at: extendedRelation.createdAt || now,
            updated_at: extendedRelation.updatedAt || now,
            valid_from: extendedRelation.validFrom || now,
            valid_to: extendedRelation.validTo || null,
            changed_by: extendedRelation.changedBy || null,
          }
        })

        this.db.sql<RelationRow>`
        INSERT INTO relations ${{ values: ["*", { batch: true }] }}
      `.run(relationRows)
      }

      this.logger.info("Knowledge graph saved successfully")
    } catch (error) {
      this.logger.error("Failed to save knowledge graph", { error })
      throw error
    }
  }

  async searchNodes(
    query: string,
    options?: SearchOptions
  ): Promise<KnowledgeGraph> {
    this.logger.info("Searching nodes", { query, options })

    try {
      const limit = options?.limit ?? SQLITE_DEFAULT_SEARCH_LIMIT

      // Get all CURRENT entities (valid_to IS NULL)
      const allEntities = this.db.sql`
      SELECT * FROM entities WHERE valid_to IS NULL
    `.all<EntityRow>()

      // Filter based on search pattern
      let filteredEntities = allEntities.filter((entity) => {
        const nameMatch = entity.name
          .toLowerCase()
          .includes(query.toLowerCase())
        const obsMatch = entity.observations
          .toLowerCase()
          .includes(query.toLowerCase())
        return nameMatch || obsMatch
      })

      // Filter by entity type if provided
      if (options?.entityTypes && options.entityTypes.length > 0) {
        const typeSet = new Set(options.entityTypes)
        filteredEntities = filteredEntities.filter((entity) =>
          typeSet.has(entity.entity_type)
        )
      }

      // Apply limit
      const entityRows = filteredEntities.slice(0, limit)
      const entityNames = entityRows.map((row) => row.name)

      // If no entities found, return empty graph
      if (entityNames.length === 0) {
        return { entities: [], relations: [] }
      }

      // Get CURRENT relations connected to found entities
      const namesList = entityNames.map((n) => `'${n}'`).join(",")
      const relationRows = this.db.sql`
      SELECT * FROM relations
      WHERE valid_to IS NULL
        AND (from_entity_name IN (${raw`${namesList}`})
         OR to_entity_name IN (${raw`${namesList}`}))
    `.all<RelationRow>()

      const entities = entityRows.map((row) => this.rowToEntity(row))
      const relations = relationRows.map((row) => this.rowToRelation(row))

      this.logger.info("Search completed", {
        entityCount: entities.length,
        relationCount: relations.length,
      })

      return { entities, relations }
    } catch (error) {
      this.logger.error("Failed to search nodes", { error })
      throw error
    }
  }

  async openNodes(names: string[]): Promise<KnowledgeGraph> {
    this.logger.info("Opening nodes by name", { names })

    try {
      if (names.length === 0) {
        return { entities: [], relations: [] }
      }

      // Get specified CURRENT entities
      const namesList = names.map((n) => `'${n}'`).join(",")

      const entityRows = this.db.sql`
      SELECT * FROM entities
      WHERE name IN (${raw`${namesList}`})
        AND valid_to IS NULL
    `.all<EntityRow>()

      // Get CURRENT relations between these entities
      const relationRows = this.db.sql`
      SELECT * FROM relations
      WHERE valid_to IS NULL
        AND (from_entity_name IN (${raw`${namesList}`})
         OR to_entity_name IN (${raw`${namesList}`}))
    `.all<RelationRow>()

      const entities = entityRows.map((row) => this.rowToEntity(row))
      const relations = relationRows.map((row) => this.rowToRelation(row))

      this.logger.info("Nodes opened", {
        requestedCount: names.length,
        foundCount: entities.length,
        relationCount: relations.length,
      })

      return { entities, relations }
    } catch (error) {
      this.logger.error("Failed to open nodes", { error })
      throw error
    }
  }

  async createEntities(entities: Entity[]): Promise<ExtendedEntity[]> {
    this.logger.info("Creating entities", { count: entities.length })

    try {
      if (entities.length === 0) {
        return []
      }

      const now = Date.now()
      const entityRows = entities.map((entity) => ({
        id: generateUUID(),
        name: entity.name,
        entity_type: entity.entityType,
        observations: JSON.stringify(entity.observations || []),
        embedding: null, // Will be set via updateEntityEmbedding if needed
        version: 1,
        created_at: now,
        updated_at: now,
        valid_from: now,
        valid_to: null, // Current version
        changed_by: null,
      }))

      // Insert entities in batch
      // Use plain INSERT (not INSERT OR REPLACE) to avoid foreign key issues
      // If an entity with the same name exists, this will throw an error
      this.db.sql<EntityRow>`
      INSERT INTO entities ${{ values: ["*", { batch: true }] }}
    `.run(entityRows)

      // Return entities with temporal metadata
      const result: ExtendedEntity[] = entityRows.map((row) => ({
        name: row.name,
        entityType: row.entity_type,
        observations: JSON.parse(row.observations) as string[],
        id: row.id,
        version: row.version,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        validFrom: row.valid_from,
        validTo: row.valid_to ?? undefined,
        changedBy: row.changed_by ?? undefined,
      }))

      this.logger.info("Entities created successfully", {
        count: result.length,
      })
      return result
    } catch (error) {
      this.logger.error("Failed to create entities", { error })
      throw error
    }
  }

  async createRelations(relations: Relation[]): Promise<Relation[]> {
    if (relations.length === 0) return []

    this.logger.info("Creating relations", { count: relations.length })

    try {
      const now = Date.now()

      // Collect all entity names that need resolution
      const allNames = new Set<string>()
      for (const rel of relations) {
        allNames.add(rel.from)
        allNames.add(rel.to)
      }

      // Batch resolve names to current entity IDs
      const nameToIdMap = this.resolveEntityNamesToIds([...allNames])

      // Validate all entities exist
      const missingEntities: string[] = []
      for (const name of allNames) {
        if (!nameToIdMap.has(name)) {
          missingEntities.push(name)
        }
      }

      if (missingEntities.length > 0) {
        throw new Error(
          `Cannot create relations: entities not found: ${missingEntities.join(", ")}`
        )
      }

      // Build relation rows with both IDs and names
      const relationRows: RelationRow[] = relations.map(rel => ({
        id: generateUUID(),
        from_entity_id: nameToIdMap.get(rel.from)!,
        to_entity_id: nameToIdMap.get(rel.to)!,
        from_entity_name: rel.from,
        to_entity_name: rel.to,
        relation_type: rel.relationType,
        strength: rel.strength ?? DEFAULT_RELATION_STRENGTH,
        confidence: rel.confidence ?? DEFAULT_RELATION_CONFIDENCE,
        metadata: JSON.stringify(rel.metadata ?? {}),
        version: 1,
        created_at: now,
        updated_at: now,
        valid_from: now,
        valid_to: null,
        changed_by: null,
      }))

      // Insert using sqlite-x type-safe batch insert
      for (const row of relationRows) {
        this.db.sql<RelationRow>`
          INSERT INTO relations (
            id, from_entity_id, to_entity_id, from_entity_name, to_entity_name,
            relation_type, strength, confidence, metadata,
            version, created_at, updated_at, valid_from, valid_to, changed_by
          ) VALUES (
            ${"$id"}, ${"$from_entity_id"}, ${"$to_entity_id"}, ${"$from_entity_name"}, ${"$to_entity_name"},
            ${"$relation_type"}, ${"$strength"}, ${"$confidence"}, ${"$metadata"},
            ${"$version"}, ${"$created_at"}, ${"$updated_at"}, ${"$valid_from"}, ${"$valid_to"}, ${"$changed_by"}
          )
        `.run(row)
      }

      this.logger.info("Relations created successfully", { count: relations.length })
      return relations

    } catch (error) {
      this.logger.error("Failed to create relations", { error })
      throw error
    }
  }

  async addObservations(
    observations: { entityName: string; contents: string[] }[]
  ): Promise<{ entityName: string; addedObservations: string[] }[]> {
    this.logger.info("Adding observations", { count: observations.length })

    const results: { entityName: string; addedObservations: string[] }[] = []

    try {
      for (const { entityName, contents } of observations) {
        // Get current entity version
        const entity = this.db.sql<{ name: string }>`
        SELECT * FROM entities
        WHERE name = ${"$name"} AND valid_to IS NULL
      `.get<EntityRow>({ name: entityName })

        if (!entity) {
          this.logger.warn("Entity not found when adding observations", {
            entityName,
          })
          continue
        }

        // Parse existing observations
        const currentObservations = JSON.parse(entity.observations) as string[]

        // Filter out duplicates
        const newObservations = contents.filter(
          (content) => !currentObservations.includes(content)
        )

        if (newObservations.length === 0) {
          results.push({
            entityName,
            addedObservations: [],
          })
          continue
        }

        // Combine observations
        const updatedObservations = [...currentObservations, ...newObservations]

        const now = Date.now()
        const newVersion = entity.version + 1
        const newId = generateUUID()

        // Mark old version as invalid
        this.db.sql<{ valid_to: number; id: string }>`
        UPDATE entities
        SET valid_to = ${"$valid_to"}
        WHERE id = ${"$id"}
      `.run({
          valid_to: now,
          id: entity.id,
        })

        // Insert new version
        this.db.sql<EntityRow>`
        INSERT INTO entities (
          id, name, entity_type, observations, embedding,
          version, created_at, updated_at, valid_from, valid_to, changed_by
        ) VALUES (
          ${"$id"}, ${"$name"}, ${"$entity_type"}, ${"$observations"}, ${"$embedding"},
          ${"$version"}, ${"$created_at"}, ${"$updated_at"}, ${"$valid_from"}, ${"$valid_to"}, ${"$changed_by"}
        )
      `.run({
          id: newId,
          name: entity.name,
          entity_type: entity.entity_type,
          observations: JSON.stringify(updatedObservations),
          embedding: entity.embedding,
          version: newVersion,
          created_at: entity.created_at,
          updated_at: now,
          valid_from: now,
          valid_to: null,
          changed_by: null,
        })

        results.push({
          entityName,
          addedObservations: newObservations,
        })
      }

      this.logger.info("Observations added successfully", {
        count: results.length,
      })
      return results
    } catch (error) {
      this.logger.error("Failed to add observations", { error })
      throw error
    }
  }

  async deleteEntities(entityNames: string[]): Promise<void> {
    this.logger.info("Deleting entities", { count: entityNames.length })

    try {
      if (entityNames.length === 0) {
        return
      }

      const now = Date.now()
      const namesList = entityNames.map((n) => `'${n}'`).join(",")

      // Soft delete: Mark all versions as invalid
      this.db.exec(`
      UPDATE entities
      SET valid_to = ${now}
      WHERE name IN (${namesList}) AND valid_to IS NULL
    `)

      // Also soft delete related relations
      this.db.exec(`
      UPDATE relations
      SET valid_to = ${now}
      WHERE (from_entity_name IN (${namesList}) OR to_entity_name IN (${namesList}))
        AND valid_to IS NULL
    `)

      // Remove vectors from vector store for deleted entities
      if (this.vectorStore) {
        await this.ensureVectorStoreInitialized()
        for (const entityName of entityNames) {
          await this.vectorStore.removeVector(entityName)
        }
      }

      this.logger.info("Entities deleted successfully")
    } catch (error) {
      this.logger.error("Failed to delete entities", { error })
      throw error
    }
  }

  async deleteObservations(
    deletions: { entityName: string; observations: string[] }[]
  ): Promise<void> {
    this.logger.info("Deleting observations", { count: deletions.length })

    try {
      for (const { entityName, observations: toDelete } of deletions) {
        // Get current entity version
        const entity = this.db.sql<{ name: string }>`
        SELECT * FROM entities
        WHERE name = ${"$name"} AND valid_to IS NULL
      `.get<EntityRow>({ name: entityName })

        if (!entity) {
          this.logger.warn("Entity not found when deleting observations", {
            entityName,
          })
          continue
        }

        // Parse existing observations
        const currentObservations = JSON.parse(entity.observations) as string[]

        // Filter out observations to delete
        const updatedObservations = currentObservations.filter(
          (obs) => !toDelete.includes(obs)
        )

        const now = Date.now()
        const newVersion = entity.version + 1
        const newId = generateUUID()

        // Mark old version as invalid
        this.db.sql<{ valid_to: number; id: string }>`
        UPDATE entities
        SET valid_to = ${"$valid_to"}
        WHERE id = ${"$id"}
      `.run({
          valid_to: now,
          id: entity.id,
        })

        // Insert new version
        this.db.sql<EntityRow>`
        INSERT INTO entities (
          id, name, entity_type, observations, embedding,
          version, created_at, updated_at, valid_from, valid_to, changed_by
        ) VALUES (
          ${"$id"}, ${"$name"}, ${"$entity_type"}, ${"$observations"}, ${"$embedding"},
          ${"$version"}, ${"$created_at"}, ${"$updated_at"}, ${"$valid_from"}, ${"$valid_to"}, ${"$changed_by"}
        )
      `.run({
          id: newId,
          name: entity.name,
          entity_type: entity.entity_type,
          observations: JSON.stringify(updatedObservations),
          embedding: entity.embedding,
          version: newVersion,
          created_at: entity.created_at,
          updated_at: now,
          valid_from: now,
          valid_to: null,
          changed_by: null,
        })
      }

      this.logger.info("Observations deleted successfully")
    } catch (error) {
      this.logger.error("Failed to delete observations", { error })
      throw error
    }
  }

  async deleteRelations(relations: Relation[]): Promise<void> {
    if (relations.length === 0) return

    this.logger.info("Deleting relations", { count: relations.length })

    try {
      const now = Date.now()

      for (const rel of relations) {
        // Mark relation as invalid using denormalized names
        this.db.sql<{ from: string; to: string; type: string; valid_to: number }>`
        UPDATE relations
        SET valid_to = ${"$valid_to"}
        WHERE from_entity_name = ${"$from"}
          AND to_entity_name = ${"$to"}
          AND relation_type = ${"$type"}
          AND valid_to IS NULL
      `.run({
          from: rel.from,
          to: rel.to,
          type: rel.relationType,
          valid_to: now,
        })
      }

      this.logger.info("Relations deleted successfully", { count: relations.length })

    } catch (error) {
      this.logger.error("Failed to delete relations", { error })
      throw error
    }
  }

  async getRelation(
    from: string,
    to: string,
    relationType: string
  ): Promise<Relation | null> {
    this.logger.debug("Getting relation", { from, to, relationType })

    try {
      const row = this.db.sql<{ from: string; to: string; type: string }>`
      SELECT * FROM relations
      WHERE from_entity_name = ${"$from"}
        AND to_entity_name = ${"$to"}
        AND relation_type = ${"$type"}
        AND valid_to IS NULL
    `.get<RelationRow>({
        from,
        to,
        type: relationType,
      })

      if (!row) {
        return null
      }

      return this.rowToRelation(row)
    } catch (error) {
      this.logger.error("Failed to get relation", { error })
      throw error
    }
  }

  async updateRelation(relation: Relation): Promise<void> {
    this.logger.info("Updating relation", { relation })

    try {
      // Get current relation version using denormalized names
      const current = this.db.sql<{ from: string; to: string; type: string }>`
      SELECT * FROM relations
      WHERE from_entity_name = ${"$from"}
        AND to_entity_name = ${"$to"}
        AND relation_type = ${"$type"}
        AND valid_to IS NULL
    `.get<RelationRow>({
        from: relation.from,
        to: relation.to,
        type: relation.relationType,
      })

      if (!current) {
        throw new Error(
          `Relation not found: ${relation.from} -> ${relation.to} (${relation.relationType})`
        )
      }

      const now = Date.now()
      const newVersion = current.version + 1
      const newId = generateUUID()

      // Mark old version as invalid
      this.db.sql<{ valid_to: number; id: string }>`
      UPDATE relations
      SET valid_to = ${"$valid_to"}
      WHERE id = ${"$id"}
    `.run({
        valid_to: now,
        id: current.id,
      })

      // Insert new version (IDs stay the same, data changes)
      const newRelation: RelationRow = {
        id: newId,
        from_entity_id: current.from_entity_id,      // Same ID
        to_entity_id: current.to_entity_id,          // Same ID
        from_entity_name: current.from_entity_name,  // Same name
        to_entity_name: current.to_entity_name,      // Same name
        relation_type: current.relation_type,
        strength: relation.strength ?? current.strength,
        confidence: relation.confidence ?? current.confidence,
        metadata: JSON.stringify(relation.metadata ?? JSON.parse(current.metadata)),
        version: newVersion,
        created_at: current.created_at,
        updated_at: now,
        valid_from: now,
        valid_to: null,
        changed_by: null,
      }

      this.db.sql<RelationRow>`
      INSERT INTO relations (
        id, from_entity_id, to_entity_id, from_entity_name, to_entity_name,
        relation_type, strength, confidence, metadata,
        version, created_at, updated_at, valid_from, valid_to, changed_by
      ) VALUES (
        ${"$id"}, ${"$from_entity_id"}, ${"$to_entity_id"}, ${"$from_entity_name"}, ${"$to_entity_name"},
        ${"$relation_type"}, ${"$strength"}, ${"$confidence"}, ${"$metadata"},
        ${"$version"}, ${"$created_at"}, ${"$updated_at"}, ${"$valid_from"}, ${"$valid_to"}, ${"$changed_by"}
      )
    `.run(newRelation)

      this.logger.info("Relation updated successfully")

    } catch (error) {
      this.logger.error("Failed to update relation", { error })
      throw error
    }
  }

  async getEntity(entityName: string): Promise<TemporalEntityType | null> {
    this.logger.debug("Getting entity", { entityName })

    try {
      const row = this.db.sql<{ name: string }>`
      SELECT * FROM entities
      WHERE name = ${"$name"} AND valid_to IS NULL
    `.get<EntityRow>({ name: entityName })

      if (!row) {
        return null
      }

      return this.rowToEntity(row)
    } catch (error) {
      this.logger.error("Failed to get entity", { error })
      throw error
    }
  }

  async getDecayedGraph(): Promise<KnowledgeGraph> {
    this.logger.info("Getting graph with confidence decay")

    try {
      // If decay is not enabled, just return the regular graph
      if (!this.decayConfig.enabled) {
        return this.loadGraph()
      }

      const now = Date.now()

      // Load current entities (no decay needed)
      const entityRows = this.db.sql`
      SELECT * FROM entities WHERE valid_to IS NULL
    `.all<EntityRow>()

      const entities = entityRows.map((row) => this.rowToEntity(row))

      // Load current relations
      const relationRows = this.db.sql`
      SELECT * FROM relations WHERE valid_to IS NULL
    `.all<RelationRow>()

      // Calculate decay factor
      const halfLifeMs =
        this.decayConfig.halfLifeDays *
        HOURS_PER_DAY *
        MINUTES_PER_HOUR *
        SECONDS_PER_MINUTE *
        MILLISECONDS_PER_SECOND

      const decayFactor = Math.log(HALF_LIFE_DECAY_CONSTANT) / halfLifeMs

      // Apply decay to each relation
      const relations = relationRows.map((row) => {
        const relation = this.rowToRelation(row)

        // Calculate age since relation became valid
        const age = now - row.valid_from

        // Apply exponential decay
        let decayedConfidence = relation.confidence! * Math.exp(decayFactor * age)

        // Don't let confidence decay below minimum
        if (decayedConfidence < this.decayConfig.minConfidence) {
          decayedConfidence = this.decayConfig.minConfidence
        }

        // Return relation with decayed confidence
        return {
          ...relation,
          confidence: decayedConfidence,
        }
      })

      this.logger.info("Graph with decay calculated", {
        entityCount: entities.length,
        relationCount: relations.length,
        decayConfig: this.decayConfig,
      })

      return { entities, relations }
    } catch (error) {
      this.logger.error("Failed to get decayed graph", { error })
      throw error
    }
  }

  async getEntityHistory(entityName: string): Promise<TemporalEntityType[]> {
    this.logger.debug("Getting entity history", { entityName })

    try {
      const rows = this.db.sql<{ name: string }>`
      SELECT * FROM entities
      WHERE name = ${"$name"}
      ORDER BY valid_from ASC
    `.all<EntityRow>({ name: entityName })

      return rows.map((row) => ({
        name: row.name,
        entityType: row.entity_type,
        observations: JSON.parse(row.observations) as string[],
        id: row.id,
        version: row.version,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        validFrom: row.valid_from,
        validTo: row.valid_to ?? undefined,
        changedBy: row.changed_by ?? undefined,
      }))
    } catch (error) {
      this.logger.error("Failed to get entity history", { error })
      throw error
    }
  }

  async getRelationHistory(
    from: string,
    to: string,
    relationType: string
  ): Promise<Relation[]> {
    this.logger.debug("Getting relation history", { from, to, relationType })

    try {
      const rows = this.db.sql<{ from: string; to: string; type: string }>`
      SELECT * FROM relations
      WHERE from_entity_name = ${"$from"}
        AND to_entity_name = ${"$to"}
        AND relation_type = ${"$type"}
      ORDER BY valid_from ASC
    `.all<RelationRow>({
        from,
        to,
        type: relationType,
      })

      return rows.map((row) => this.rowToRelation(row))
    } catch (error) {
      this.logger.error("Failed to get relation history", { error })
      throw error
    }
  }

  async getGraphAtTime(timestamp: number): Promise<KnowledgeGraph> {
    this.logger.info("Getting graph at time", { timestamp })

    try {
      // Get entities valid at the timestamp
      const entityRows = this.db.sql<{ timestamp: number }>`
      SELECT * FROM entities
      WHERE valid_from <= ${"$timestamp"}
        AND (valid_to IS NULL OR valid_to > ${"$timestamp"})
    `.all<EntityRow>({ timestamp })

      // Get relations valid at the timestamp
      const relationRows = this.db.sql<{ timestamp: number }>`
      SELECT * FROM relations
      WHERE valid_from <= ${"$timestamp"}
        AND (valid_to IS NULL OR valid_to > ${"$timestamp"})
    `.all<RelationRow>({ timestamp })

      const entities = entityRows.map((row) => this.rowToEntity(row))
      const relations = relationRows.map((row) => this.rowToRelation(row))

      this.logger.info("Graph at time retrieved", {
        timestamp,
        entityCount: entities.length,
        relationCount: relations.length,
      })

      return { entities, relations }
    } catch (error) {
      this.logger.error("Failed to get graph at time", { error })
      throw error
    }
  }

  async updateEntityEmbedding(
    entityName: string,
    embedding: EntityEmbedding
  ): Promise<void> {
    this.logger.debug("Updating entity embedding", { entityName })

    try {
      // Ensure vector store is initialized
      await this.ensureVectorStoreInitialized()

      // Get current entity version
      const entity = await this.getEntity(entityName)

      if (!entity) {
        throw new Error(`Entity ${entityName} not found`)
      }

      // Store embedding as JSON string in the entity
      const embeddingJson = JSON.stringify(embedding.vector)

      const result = this.db.sql`
      UPDATE entities
      SET embedding = ${'$embedding'},
          updated_at = ${'$updated_at'}
      WHERE name = ${'$name'} AND valid_to IS NULL
    `.run({
        embedding: embeddingJson,
        updated_at: Date.now(),
        name: entityName,
      })

      // Also update the vector store for semantic search
      // Each observation gets its own embedding entry
      const observations = entity.observations || []
      for (let i = 0; i < observations.length; i++) {
        await this.vectorStore.addVector(entityName, embedding.vector, {
          observationIndex: i,
        })
      }

      this.logger.info("Entity embedding updated", { 
        entityName, 
        changes: result.changes,
        vectorStoreUpdated: true,
      })
    } catch (error) {
      this.logger.error("Failed to update entity embedding", { error })
      throw error
    }
  }

  async getEntityEmbedding(
    entityName: string
  ): Promise<EntityEmbedding | null> {
    this.logger.debug("Getting entity embedding", { entityName })

    try {
      const row = this.db.sql<{ name: string }>`
      SELECT embedding, updated_at FROM entities
      WHERE name = ${"$name"} AND valid_to IS NULL
    `.get<{ embedding: string | null; updated_at: number }>({ name: entityName })

      if (!row || !row.embedding) {
        return null
      }

      const vector = JSON.parse(row.embedding) as number[]

      return {
        vector,
        model: "unknown", // We don't store model info separately in SQLite
        lastUpdated: row.updated_at,
      }
    } catch (error) {
      this.logger.error("Failed to get entity embedding", { error })
      return null
    }
  }

  async findSimilarEntities(
    queryVector: number[],
    limit = 10
  ): Promise<Array<TemporalEntityType & { similarity: number }>> {
    this.logger.debug("Finding similar entities", { limit })

    try {
      // Ensure vector store is initialized
      await this.ensureVectorStoreInitialized()

      // Check if we have any embeddings
      const hasEmbeddings = this.db.sql`
        SELECT COUNT(*) as count FROM embeddings
      `.get<{ count: number }>()

      if (!hasEmbeddings || hasEmbeddings.count === 0) {
        this.logger.warn("No entity embeddings found for similarity search")
        return []
      }

      // Use SqliteVectorStore for vector similarity search
      const vectorResults = await this.vectorStore.search(queryVector, {
        limit,
        minSimilarity: 0.0,
      })

      // Map vector search results to entities
      const results: Array<TemporalEntityType & { similarity: number }> = []
      
      for (const result of vectorResults) {
        const entityName = typeof result.id === 'string' ? result.id : String(result.id)
        const entity = await this.getEntity(entityName)
        if (entity) {
          results.push({
            ...entity,
            similarity: result.similarity,
          })
        }
      }

      this.logger.info("Found similar entities", { count: results.length })
      return results
    } catch (error) {
      this.logger.error("Failed to find similar entities", { error })
      return []
    }
  }

  async semanticSearch(
    query: string,
    options?: SemanticSearchOptions
  ): Promise<KnowledgeGraph> {
    this.logger.info("Performing semantic search", { query, options })

    try {
      // Ensure vector store is initialized
      await this.ensureVectorStoreInitialized()

      // For semantic search, we need a query embedding
      // This should come from an EmbeddingService via queryVector option
      
      if (!options?.queryVector) {
        this.logger.warn(
          "No query vector provided for semantic search, falling back to text search"
        )
        return this.searchNodes(query, {
          limit: options?.limit as number | undefined,
        })
      }

      // Perform vector-based semantic search
      const similarEntities = await this.findSimilarEntities(
        options.queryVector,
        options.limit ?? 10
      )

      // Convert temporal entities to Entity type for KnowledgeGraph
      const entities: Entity[] = similarEntities.map(entity => ({
        name: entity.name,
        entityType: entity.entityType,
        observations: entity.observations,
      }))

      // Build minimal knowledge graph with entities only
      // Relations can be fetched separately if needed
      const entityNames = new Set(entities.map(e => e.name))
      const relations: Relation[] = []

      // Query for relations between found entities
      if (entityNames.size > 0) {
        // Get all current relations and filter in memory
        // (sql-x doesn't support dynamic IN clauses well in templates)
        const allRelationRows = this.db.sql`
          SELECT * FROM relations
          WHERE valid_to IS NULL
        `.all<RelationRow>()
        
        for (const row of allRelationRows) {
          if (entityNames.has(row.from_entity_name) && entityNames.has(row.to_entity_name)) {
            relations.push(this.rowToRelation(row))
          }
        }
      }

      this.logger.info("Semantic search completed", {
        entitiesFound: entities.length,
        relationsFound: relations.length,
      })

      return { entities, relations }
    } catch (error) {
      this.logger.error("Failed to perform semantic search", { error })
      // Fall back to text search on error
      return this.searchNodes(query, {
        limit: options?.limit as number | undefined,
      })
    }
  }

  /**
   * Traverse the graph starting from a given entity, following relationships
   * up to a specified depth. Inspired by simple-graph's recursive CTE approach.
   *
   * @param startEntityName The entity to start traversal from
   * @param options Traversal options
   * @returns KnowledgeGraph containing all entities and relations along the path
   */
  async traverseGraph(
    startEntityName: string,
    options?: {
      maxDepth?: number
      direction?: "outbound" | "inbound" | "both"
      relationTypes?: string[]
    }
  ): Promise<KnowledgeGraph> {
    const maxDepth = options?.maxDepth ?? SQLITE_DEFAULT_TRAVERSAL_DEPTH
    const direction = options?.direction ?? "both"
    const relationTypes = options?.relationTypes

    this.logger.info("Traversing graph", {
      startEntityName,
      maxDepth,
      direction,
      relationTypes,
    })

    try {
      // Build the recursive CTE based on direction
      let relationTypeFilter = ""
      if (relationTypes && relationTypes.length > 0) {
        const types = relationTypes.map((t) => `'${t}'`).join(",")
        relationTypeFilter = `AND relation_type IN (${types})`
      }

      // Recursive CTE to traverse the graph
      const traversalQuery = `
        WITH RECURSIVE traverse(entity_name, depth) AS (
          -- Base case: start with the initial entity
          SELECT name, 0 FROM entities WHERE name = '${startEntityName}'

          UNION

          -- Recursive case: follow relationships
          SELECT DISTINCT
            ${direction === "inbound" || direction === "both" ? "from_entity_name" : "to_entity_name"} as entity_name,
            depth + 1
          FROM relations
          JOIN traverse ON ${direction === "inbound" || direction === "both" ? "to_entity_name" : "from_entity_name"} = traverse.entity_name
          WHERE depth < ${maxDepth} ${relationTypeFilter}

          ${
            direction === "both"
              ? `
          UNION

          SELECT DISTINCT
            to_entity_name as entity_name,
            depth + 1
          FROM relations
          JOIN traverse ON from_entity_name = traverse.entity_name
          WHERE depth < ${maxDepth} ${relationTypeFilter}
          `
              : ""
          }
        )
        SELECT DISTINCT entity_name FROM traverse
      `

      // Execute traversal to get all entity names
      type TraversalResult = { entity_name: string }
      const traversalResults = this.db
        .sql`${raw`${traversalQuery}`}`.all<TraversalResult>()

      if (traversalResults.length === 0) {
        return { entities: [], relations: [] }
      }

      const entityNameRows = traversalResults.map((row) => row.entity_name)

      // Fetch all entities found during traversal
      const namesList = entityNameRows.map((n) => `'${n}'`).join(",")
      const entityRows = this.db.sql`
        SELECT * FROM entities
        WHERE name IN (${raw`${namesList}`})
      `.all<EntityRow>()

      // Fetch all relations between these entities
      const relationRows = this.db.sql`
        SELECT * FROM relations
        WHERE from_entity_name IN (${raw`${namesList}`})
          AND to_entity_name IN (${raw`${namesList}`})
          ${relationTypeFilter ? raw`${relationTypeFilter}` : raw``}
      `.all<RelationRow>()

      const entities = entityRows.map((row) => this.rowToEntity(row))
      const relations = relationRows.map((row) => this.rowToRelation(row))

      this.logger.info("Graph traversal completed", {
        entityCount: entities.length,
        relationCount: relations.length,
      })

      return { entities, relations }
    } catch (error) {
      this.logger.error("Failed to traverse graph", { error })
      throw error
    }
  }

  async diagnoseVectorSearch(): Promise<Record<string, unknown>> {
    this.logger.debug("Diagnosing vector search")

    try {
      // Count entities with embeddings
      const allEntities = this.db.sql`
      SELECT * FROM entities
      WHERE valid_to IS NULL
    `.all<EntityRow>()
      const entitiesWithEmbeddings = allEntities.filter(e => e.embedding != null).length

      // Check if sqlite-vec extension is available
      let vecExtensionAvailable = false
      try {
        // Try to query the embeddings virtual table
        this.db.sql`SELECT COUNT(*) as count FROM embeddings`.get()
        vecExtensionAvailable = true
      } catch {
        vecExtensionAvailable = false
      }

      // Sample a few embeddings for inspection
      const sampleEmbeddings = this.db.sql`
      SELECT name, embedding FROM entities
      WHERE embedding IS NOT NULL AND valid_to IS NULL
      LIMIT 3
    `.all<{ name: string; embedding: string }>()

      const samples = sampleEmbeddings.map((row) => {
        const vector = JSON.parse(row.embedding) as number[]
        return {
          entityName: row.name,
          dimensions: vector.length,
          sampleValues: vector.slice(0, 5),
        }
      })

      return {
        vectorSearchAvailable: vecExtensionAvailable,
        entitiesWithEmbeddings: entitiesWithEmbeddings,
        totalEntities: allEntities.length,
        sampleEmbeddings: samples,
        storageType: "SQLite",
        features: {
          temporalVersioning: true,
          embeddingStorage: true,
          vectorSimilaritySearch: vecExtensionAvailable,
          confidenceDecay: this.decayConfig.enabled,
        },
      }
    } catch (error) {
      this.logger.error("Failed to diagnose vector search", { error })
      return {
        error: error instanceof Error ? error.message : String(error),
      }
    }
  }

  // Helper methods to convert between domain types and database rows

  private rowToEntity(row: EntityRow): ExtendedEntity {
    return {
      name: row.name,
      entityType: row.entity_type,
      observations: JSON.parse(row.observations) as string[],
      embedding: row.embedding ? JSON.parse(row.embedding) : null,
      id: row.id,
      version: row.version,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      validFrom: row.valid_from,
      validTo: row.valid_to ?? undefined,
      changedBy: row.changed_by ?? undefined,
    }
  }

  private rowToRelation(row: RelationRow): Relation {
    const metadata = JSON.parse(row.metadata) as {
      createdAt?: number
      updatedAt?: number
      inferredFrom?: string[]
      lastAccessed?: number
    }

    return {
      from: row.from_entity_name,
      to: row.to_entity_name,
      relationType: row.relation_type,
      strength: row.strength,
      confidence: row.confidence,
      metadata: {
        createdAt: metadata.createdAt ?? row.created_at,
        updatedAt: metadata.updatedAt ?? row.updated_at,
        inferredFrom: metadata.inferredFrom,
        lastAccessed: metadata.lastAccessed,
      },
    }
  }

}
