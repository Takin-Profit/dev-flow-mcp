/** biome-ignore-all lint/complexity/useLiteralKeys: accessing private properties for diagnostics */
// TODO: refactor this entire module - reduce complexity.
/** biome-ignore-all lint/complexity/noExcessiveCognitiveComplexity: will refactor in the future */
import { type } from "arktype"
import neo4j from "neo4j-driver"
import { v4 as uuidv4 } from "uuid"
import type { EmbeddingService } from "#embeddings/embedding-service"
import { EmbeddingServiceFactory } from "#embeddings/embedding-service-factory"
import type { Neo4jConfig } from "#storage/neo4j/neo4j-config"
import { DEFAULT_NEO4J_CONFIG } from "#storage/neo4j/neo4j-config"
import { Neo4jConnectionManager } from "#storage/neo4j/neo4j-connection-manager"
import { Neo4jSchemaManager } from "#storage/neo4j/neo4j-schema-manager"
import { Neo4jVectorStore } from "#storage/neo4j/neo4j-vector-store"
import type { StorageProvider } from "#storage/storage-provider"
import type {
  Entity,
  EntityEmbedding,
  ExtendedEntity,
  ExtendedRelation,
  KnowledgeGraph,
  KnowledgeGraphWithDiagnostics,
  Logger,
  Neo4jSemanticSearchOptions,
  SearchOptions,
  TemporalEntityType,
} from "#types"
import {
  createNoOpLogger,
  Neo4jNodeValidator,
  Neo4jRelationshipValidator,
} from "#types"
import type { Relation } from "#types/relation"

// ============================================================================
// Constants
// ============================================================================

/**
 * Default number of days for confidence to decay by half
 */
const DEFAULT_HALF_LIFE_DAYS = 30

/**
 * Default minimum confidence threshold for relations
 */
const DEFAULT_MIN_CONFIDENCE = 0.1

/**
 * Default strength value for relations when not specified
 */
const DEFAULT_RELATION_STRENGTH = 0.9

/**
 * Default confidence value for relations when not specified
 */
const DEFAULT_RELATION_CONFIDENCE = 0.95

/**
 * Default minimum similarity threshold for vector search
 */
const DEFAULT_MIN_SIMILARITY = 0.6

/**
 * Number of sample vector values to include in diagnostics
 */
const DIAGNOSTIC_SAMPLE_SIZE = 3

/**
 * Half-life decay constant (0.5 represents 50% decay at half-life)
 */
const HALF_LIFE_DECAY_CONSTANT = 0.5

/**
 * Time conversion constants
 */
const HOURS_PER_DAY = 24
const MINUTES_PER_HOUR = 60
const SECONDS_PER_MINUTE = 60
const MILLISECONDS_PER_SECOND = 1000

// ============================================================================
// Types
// ============================================================================

/**
 * Configuration options for Neo4j storage provider
 */
export type Neo4jStorageProviderOptions = {
  /**
   * Neo4j connection configuration
   */
  config?: Partial<Neo4jConfig>

  /**
   * Pre-configured connection manager (optional)
   */
  connectionManager?: Neo4jConnectionManager

  /**
   * Configuration for temporal confidence decay
   */
  decayConfig?: {
    /**
     * Whether confidence decay is enabled
     */
    enabled: boolean

    /**
     * Number of days for confidence to decay by half (default: 30)
     */
    halfLifeDays?: number

    /**
     * Minimum confidence threshold below which confidence won't decay (default: 0.1)
     */
    minConfidence?: number
  }

  /**
   * Logger instance for dependency injection
   */
  logger?: Logger
}

/**
 * A storage provider that uses Neo4j to store the knowledge graph
 */
export class Neo4jStorageProvider implements StorageProvider {
  private readonly connectionManager: Neo4jConnectionManager
  private readonly schemaManager: Neo4jSchemaManager
  private readonly config: Neo4jConfig
  private readonly decayConfig: {
    enabled: boolean
    halfLifeDays: number
    minConfidence: number
  }
  private readonly vectorStore: Neo4jVectorStore
  private readonly embeddingService: EmbeddingService | null = null
  private readonly logger: Logger

  /**
   * Create a new Neo4jStorageProvider
   * @param options Configuration options
   */
  constructor(options?: Neo4jStorageProviderOptions) {
    // Set up logger first
    this.logger = options?.logger ?? createNoOpLogger()

    // Set up configuration
    this.config = {
      ...DEFAULT_NEO4J_CONFIG,
      ...(options?.config || {}),
    }

    // Configure decay settings
    this.decayConfig = {
      enabled: options?.decayConfig?.enabled ?? true,
      halfLifeDays:
        options?.decayConfig?.halfLifeDays ?? DEFAULT_HALF_LIFE_DAYS,
      minConfidence:
        options?.decayConfig?.minConfidence ?? DEFAULT_MIN_CONFIDENCE,
    }

    this.logger.debug("Neo4jStorageProvider initialized", {
      decayEnabled: this.decayConfig.enabled,
      vectorIndexName: this.config.vectorIndexName,
    })

    // Set up connection manager
    this.connectionManager =
      options?.connectionManager || new Neo4jConnectionManager(this.config)

    // Set up schema manager with logger injection
    this.schemaManager = new Neo4jSchemaManager(this.connectionManager, {
      config: this.config,
      debug: false,
      logger: this.logger,
    })

    // Set up vector store with logger injection
    this.vectorStore = new Neo4jVectorStore({
      connectionManager: this.connectionManager,
      indexName: this.config.vectorIndexName,
      dimensions: 1536,
      similarityFunction: "cosine",
      entityNodeLabel: "Entity",
      logger: this.logger,
    })

    this.logger.debug("Neo4jStorageProvider: Initializing embedding service")
    try {
      // Set up embedding service with logger injection
      this.embeddingService = EmbeddingServiceFactory.createFromEnvironment(
        this.logger
      )
      this.logger.debug(
        "Neo4jStorageProvider: Embedding service initialized successfully",
        {
          provider: this.embeddingService.getProviderInfo().provider,
          model: this.embeddingService.getProviderInfo().model,
          dimensions: this.embeddingService.getProviderInfo().dimensions,
        }
      )
    } catch (error) {
      this.logger.error(
        "Neo4jStorageProvider: Failed to initialize embedding service",
        error
      )
    }

    // Initialize the schema and vector store
    this.initializeSchema().catch((err) => {
      this.logger.error("Failed to initialize Neo4j schema", err)
    })
  }

  /**
   * Get the connection manager (primarily for testing)
   */
  getConnectionManager(): Neo4jConnectionManager {
    return this.connectionManager
  }

  /**
   * Initialize Neo4j schema
   */
  private async initializeSchema(): Promise<void> {
    try {
      await this.schemaManager.initializeSchema(false)
      this.logger.info("Neo4j schema initialized successfully")

      // Initialize vector store after schema is ready
      try {
        await this.vectorStore.initialize()
        this.logger.info("Neo4j vector store initialized successfully")
      } catch (vectorError) {
        this.logger.error(
          "Failed to initialize Neo4j vector store",
          vectorError
        )
        // Continue even if vector store initialization fails
      }
    } catch (schemaError) {
      this.logger.error("Failed to initialize Neo4j schema", schemaError)
      throw schemaError
    }
  }

  /**
   * Close Neo4j connections
   */
  async close(): Promise<void> {
    try {
      await this.connectionManager.close()
      this.logger.debug("Neo4j connections closed")
    } catch (error) {
      this.logger.error("Error closing Neo4j connections", error)
    }
  }

  /**
   * Convert a Neo4j node to an entity object with validation
   * @param node Neo4j node properties
   * @returns Entity object
   */
  private nodeToEntity(node: Record<string, unknown>): ExtendedEntity {
    // Validate the node data using arktype
    const validationResult = Neo4jNodeValidator(node)

    if (validationResult instanceof type.errors) {
      this.logger.error("Invalid Neo4j node data", undefined, {
        errors: validationResult.summary,
        node,
      })
      throw new Error(`Invalid Neo4j node data: ${validationResult.summary}`)
    }

    // Parse observations from JSON string
    const observations =
      typeof validationResult.observations === "string"
        ? JSON.parse(validationResult.observations)
        : []

    // Return properly typed entity with required temporal fields
    const entity: ExtendedEntity = {
      name: validationResult.name,
      entityType: validationResult.entityType,
      observations,
      id: validationResult.id,
      version: validationResult.version,
      createdAt: validationResult.createdAt,
      updatedAt: validationResult.updatedAt,
      validFrom: validationResult.validFrom,
      validTo: validationResult.validTo,
      changedBy: validationResult.changedBy,
    }

    return entity
  }

  /**
   * Parse a Neo4j relationship into a relation object
   * @param rel Relationship properties
   * @param fromNode From node name
   * @param toNode To node name
   * @returns Relation object
   */
  /**
   * Parse a Neo4j relationship into a relation object
   * @param rel Relationship properties
   * @param fromNode From node name
   * @param toNode To node name
   * @returns Relation object
   */
  /**
   * Parse a Neo4j relationship into a relation object with validation
   * @param rel Relationship properties from Neo4j
   * @param fromNode From node name
   * @param toNode To node name
   * @returns Validated Relation object
   */
  private relationshipToRelation(
    rel: Record<string, unknown>,
    fromNode: string,
    toNode: string
  ): Relation {
    // Validate the relationship data using arktype
    const validationResult = Neo4jRelationshipValidator(rel)

    if (validationResult instanceof type.errors) {
      this.logger.error("Invalid Neo4j relationship data", undefined, {
        errors: validationResult.summary,
        rel,
        fromNode,
        toNode,
      })
      throw new Error(
        `Invalid Neo4j relationship data: ${validationResult.summary}`
      )
    }

    // Use validated data with defaults for required metadata fields
    const now = Date.now()
    const createdAt = validationResult.createdAt || now
    const updatedAt = validationResult.updatedAt || now

    // Create metadata with required fields
    const metadata = {
      createdAt,
      updatedAt,
    }

    // Try to merge any additional metadata from the validated relation
    if (
      validationResult.metadata &&
      typeof validationResult.metadata === "object"
    ) {
      Object.assign(metadata, validationResult.metadata)
    }

    // Create a standard Relation object with proper type handling
    // Convert null to undefined for compatibility with Relation interface
    return {
      from: fromNode,
      to: toNode,
      relationType: validationResult.relationType,
      strength:
        validationResult.strength === null
          ? undefined
          : validationResult.strength,
      confidence:
        validationResult.confidence === null
          ? undefined
          : validationResult.confidence,
      metadata,
    }
  }

  /**
   * Load the complete knowledge graph from Neo4j
   */
  async loadGraph(): Promise<KnowledgeGraph> {
    try {
      const startTime = Date.now()

      // Load entities query
      const entityQuery = `
        MATCH (e:Entity)
        WHERE e.validTo IS NULL
        RETURN e
      `

      // Execute query to get all current entities
      const entityResult = await this.connectionManager.executeQuery(
        entityQuery,
        {}
      )

      // Process entity results
      const entities = entityResult.records.map((record) => {
        const node = record.get("e").properties
        return this.nodeToEntity(node)
      })

      // Load relations query
      const relationQuery = `
        MATCH (from:Entity)-[r]->(to:Entity)
        WHERE type(r) IN $relationTypes AND r.validTo IS NULL
        RETURN from.name AS fromName, to.name AS toName, r
      `

      // Execute query to get all current relations
      const relationResult = await this.connectionManager.executeQuery(
        relationQuery,
        { relationTypes: ["implements", "depends_on", "relates_to", "part_of"] }
      )

      // Process relation results
      const relations = relationResult.records.map((record) => {
        const fromName = record.get("fromName")
        const toName = record.get("toName")
        const rel = record.get("r").properties

        return this.relationshipToRelation(rel, fromName, toName)
      })

      const timeTaken = Date.now() - startTime

      // Return the complete graph
      return {
        entities,
        relations,
        total: entities.length,
        timeTaken,
      }
    } catch (error) {
      this.logger.error("Error loading graph from Neo4j", error)
      throw error
    }
  }

  /**
   * Save a complete knowledge graph to Neo4j (warning: this will overwrite existing data)
   * @param graph The knowledge graph to save
   */
  async saveGraph(graph: KnowledgeGraph): Promise<void> {
    try {
      // Start a new session
      const session = this.connectionManager.getSession()

      try {
        // Begin transaction
        const txc = session.beginTransaction()

        try {
          // Delete all existing data
          await txc.run("MATCH (n) DETACH DELETE n", {})

          // Process entities
          for (const entity of graph.entities) {
            const extendedEntity = entity as ExtendedEntity
            const params = {
              id: extendedEntity.id || uuidv4(),
              name: entity.name,
              entityType: entity.entityType,
              observations: JSON.stringify(entity.observations || []),
              version: extendedEntity.version || 1,
              createdAt: extendedEntity.createdAt || Date.now(),
              updatedAt: extendedEntity.updatedAt || Date.now(),
              validFrom: extendedEntity.validFrom || Date.now(),
              validTo: extendedEntity.validTo || null,
              changedBy: extendedEntity.changedBy || null,
            }

            // Create entity
            await txc.run(
              `
              CREATE (e:Entity {
                id: $id,
                name: $name,
                entityType: $entityType,
                observations: $observations,
                version: $version,
                createdAt: $createdAt,
                updatedAt: $updatedAt,
                validFrom: $validFrom,
                validTo: $validTo,
                changedBy: $changedBy
              })
            `,
              params
            )
          }

          // Process relations
          for (const relation of graph.relations) {
            const extendedRelation = relation as ExtendedRelation
            const params = {
              id: extendedRelation.id || uuidv4(),
              fromName: relation.from,
              toName: relation.to,
              relationType: relation.relationType,
              strength: relation.strength || null,
              confidence: relation.confidence || null,
              metadata: relation.metadata
                ? JSON.stringify(relation.metadata)
                : null,
              version: extendedRelation.version || 1,
              createdAt: extendedRelation.createdAt || Date.now(),
              updatedAt: extendedRelation.updatedAt || Date.now(),
              validFrom: extendedRelation.validFrom || Date.now(),
              validTo: extendedRelation.validTo || null,
              changedBy: extendedRelation.changedBy || null,
            }

            // Create relation
            await txc.run(
              `
              MATCH (from:Entity {name: $fromName})
              MATCH (to:Entity {name: $toName})
              CREATE (from)-[r:RELATES_TO {
                id: $id,
                relationType: $relationType,
                strength: $strength,
                confidence: $confidence,
                metadata: $metadata,
                version: $version,
                createdAt: $createdAt,
                updatedAt: $updatedAt,
                validFrom: $validFrom,
                validTo: $validTo,
                changedBy: $changedBy
              }]->(to)
            `,
              params
            )
          }

          // Commit transaction
          await txc.commit()
          this.logger.info(
            `Saved graph with ${graph.entities.length} entities and ${graph.relations.length} relations to Neo4j`
          )
        } catch (error) {
          // Rollback on error
          await txc.rollback()
          throw error
        }
      } finally {
        // Close session
        await session.close()
      }
    } catch (error) {
      this.logger.error("Error saving graph to Neo4j", error)
      throw error
    }
  }

  /**
   * Search for nodes in the graph that match the query
   * @param query The search query string
   * @param options Optional search parameters
   */
  async searchNodes(
    query: string,
    options: SearchOptions = {}
  ): Promise<KnowledgeGraph> {
    try {
      const startTime = Date.now()

      // Prepare search parameters
      const rawLimit = options.limit || 10
      const parameters: Record<string, unknown> = {
        query: `(?i).*${query}.*`, // Case-insensitive regex pattern
        limit: neo4j.int(Math.floor(rawLimit)),
      }

      // Add entity type filter if provided
      let entityTypeFilter = ""
      if (options.entityTypes && options.entityTypes.length > 0) {
        entityTypeFilter = "AND e.entityType IN $entityTypes"
        parameters.entityTypes = options.entityTypes
      }

      // Build the search query
      const searchQuery = `
        MATCH (e:Entity)
        WHERE (e.name =~ $query OR e.entityType =~ $query OR e.observations =~ $query)
        ${entityTypeFilter}
        AND e.validTo IS NULL
        RETURN e
        LIMIT $limit
      `

      // Execute the search
      const result = await this.connectionManager.executeQuery(
        searchQuery,
        parameters
      )

      // Process entity results
      const entities = result.records.map((record) => {
        const node = record.get("e").properties
        return this.nodeToEntity(node)
      })

      // Get relations between found entities
      const entityNames = entities.map((e) => e.name)
      if (entityNames.length > 0) {
        const relationsQuery = `
          MATCH (from:Entity)-[r:RELATES_TO]->(to:Entity)
          WHERE from.name IN $entityNames
          AND to.name IN $entityNames
          AND r.validTo IS NULL
          RETURN from.name AS fromName, to.name AS toName, r
        `

        const relationsResult = await this.connectionManager.executeQuery(
          relationsQuery,
          {
            entityNames,
          }
        )

        // Process relation results
        const relations = relationsResult.records.map((record) => {
          const fromName = record.get("fromName")
          const toName = record.get("toName")
          const rel = record.get("r").properties

          return this.relationshipToRelation(rel, fromName, toName)
        })

        const timeTaken = Date.now() - startTime

        // Return the search results as a graph
        return {
          entities,
          relations,
          total: entities.length,
          timeTaken,
        }
      }

      const timeTaken = Date.now() - startTime

      // Return just the entities if no relations
      return {
        entities,
        relations: [],
        total: entities.length,
        timeTaken,
      }
    } catch (error) {
      this.logger.error("Error searching nodes in Neo4j", error)
      throw error
    }
  }

  /**
   * Open specific nodes by their exact names
   * @param names Array of node names to open
   */
  async openNodes(names: string[]): Promise<KnowledgeGraph> {
    try {
      const startTime = Date.now()

      if (!names || names.length === 0) {
        return { entities: [], relations: [] }
      }

      // Query for entities by name
      const entityQuery = `
        MATCH (e:Entity)
        WHERE e.name IN $names
        AND e.validTo IS NULL
        RETURN e
      `

      // Execute query to get entities
      const entityResult = await this.connectionManager.executeQuery(
        entityQuery,
        { names }
      )

      // Process entity results
      const entities = entityResult.records.map((record) => {
        const node = record.get("e").properties
        return this.nodeToEntity(node)
      })

      // Get relations between the specified entities
      const relationsQuery = `
        MATCH (from:Entity)-[r:RELATES_TO]->(to:Entity)
        WHERE from.name IN $names
        AND to.name IN $names
        AND r.validTo IS NULL
        RETURN from.name AS fromName, to.name AS toName, r
      `

      // Execute query to get relations
      const relationsResult = await this.connectionManager.executeQuery(
        relationsQuery,
        { names }
      )

      // Process relation results
      const relations = relationsResult.records.map((record) => {
        const fromName = record.get("fromName")
        const toName = record.get("toName")
        const rel = record.get("r").properties

        return this.relationshipToRelation(rel, fromName, toName)
      })

      const timeTaken = Date.now() - startTime

      // Return the entities and their relations
      return {
        entities,
        relations,
        total: entities.length,
        timeTaken,
      }
    } catch (error) {
      this.logger.error("Error opening nodes in Neo4j", error)
      throw error
    }
  }

  /**
   * Create new entities in the knowledge graph
   * @param entities Array of entities to create
   */
  async createEntities(entities: Entity[]): Promise<TemporalEntityType[]> {
    try {
      if (!entities || entities.length === 0) {
        return []
      }

      const session = this.connectionManager.getSession()
      const createdEntities: TemporalEntityType[] = []

      try {
        // Begin transaction
        const txc = session.beginTransaction()

        try {
          for (const entity of entities) {
            // Generate temporal and identity metadata
            const now = Date.now()
            const entityId = uuidv4()

            // Add debug log for embedding generation attempts
            this.logger.debug(
              `Neo4jStorageProvider: Processing embeddings for entity "${entity.name}"`,
              {
                entityType: entity.entityType,
                hasEmbeddingService: !!this.embeddingService,
              }
            )

            // Generate embedding if embedding service is available
            let embedding: number[] | null = null
            if (this.embeddingService) {
              try {
                // Prepare text for embedding
                const text = Array.isArray(entity.observations)
                  ? entity.observations.join("\n")
                  : ""

                // Generate embedding using the instance's embedding service
                embedding = await this.embeddingService.generateEmbedding(text)
                this.logger.info(
                  `Generated embedding for entity: ${entity.name}`
                )
              } catch (error) {
                this.logger.error(
                  `Failed to generate embedding for entity: ${entity.name}`,
                  error
                )
                // Continue without embedding if generation fails
              }
            } else {
              this.logger.warn(
                `Neo4jStorageProvider: Skipping embedding for entity "${entity.name}" - No embedding service available`
              )
            }

            // Create entity with parameters
            const params = {
              id: entityId,
              name: entity.name,
              entityType: entity.entityType,
              observations: JSON.stringify(entity.observations || []),
              version: 1,
              createdAt: now,
              updatedAt: now,
              validFrom: now,
              validTo: null,
              changedBy: null,
              embedding, // Add embedding directly to entity
            }

            // Create entity query
            const createQuery = `
              CREATE (e:Entity {
                id: $id,
                name: $name,
                entityType: $entityType,
                observations: $observations,
                version: $version,
                createdAt: $createdAt,
                updatedAt: $updatedAt,
                validFrom: $validFrom,
                validTo: $validTo,
                changedBy: $changedBy,
                embedding: $embedding
              })
              RETURN e
            `

            // Execute query
            const result = await txc.run(createQuery, params)

            // Get created entity from result
            if (result.records.length > 0) {
              // Type guard for array access
              const firstRecord = result.records[0]
              if (firstRecord) {
                const node = firstRecord.get("e").properties
                const createdEntity = this.nodeToEntity(node)
                createdEntities.push(createdEntity)
                this.logger.info(
                  `Created entity with embedding: ${entity.name}`
                )
              }
            }
          }

          // Commit transaction
          await txc.commit()

          return createdEntities
        } catch (error) {
          // Rollback on error
          await txc.rollback()
          throw error
        }
      } finally {
        // Close session
        await session.close()
      }
    } catch (error) {
      this.logger.error("Error creating entities in Neo4j", error)
      throw error
    }
  }

  /**
   * Create new relations between entities
   * @param relations Array of relations to create
   */
  async createRelations(relations: Relation[]): Promise<Relation[]> {
    try {
      if (!relations || relations.length === 0) {
        return []
      }

      const session = this.connectionManager.getSession()
      const createdRelations: Relation[] = []

      try {
        // Begin transaction
        const txc = session.beginTransaction()

        try {
          for (const relation of relations) {
            // Generate temporal and identity metadata
            const now = Date.now()
            const relationId = uuidv4()

            // Check if entities exist
            const checkQuery = `
              MATCH (from:Entity {name: $fromName})
              MATCH (to:Entity {name: $toName})
              RETURN from, to
            `

            const checkResult = await txc.run(checkQuery, {
              fromName: relation.from,
              toName: relation.to,
            })

            // If either entity doesn't exist, skip this relation
            if (checkResult.records.length === 0) {
              this.logger.warn(
                `Skipping relation creation: One or both entities not found (${relation.from} -> ${relation.to})`
              )
              continue
            }

            // Create relation with parameters
            const extendedRelation = relation as ExtendedRelation
            const params = {
              id: relationId,
              fromName: relation.from,
              toName: relation.to,
              relationType: relation.relationType,
              strength: relation.strength || null,
              confidence: relation.confidence || null,
              metadata: relation.metadata
                ? JSON.stringify(relation.metadata)
                : null,
              version: 1,
              createdAt: extendedRelation.createdAt || now,
              updatedAt: extendedRelation.updatedAt || now,
              validFrom: extendedRelation.validFrom || now,
              validTo: null,
              changedBy: extendedRelation.changedBy || null,
            }

            // Create relation query
            const createQuery = `
              MATCH (from:Entity {name: $fromName})
              MATCH (to:Entity {name: $toName})
              CREATE (from)-[r:RELATES_TO {
                id: $id,
                relationType: $relationType,
                strength: $strength,
                confidence: $confidence,
                metadata: $metadata,
                version: $version,
                createdAt: $createdAt,
                updatedAt: $updatedAt,
                validFrom: $validFrom,
                validTo: $validTo,
                changedBy: $changedBy
              }]->(to)
              RETURN r, from, to
            `

            // Execute query
            const result = await txc.run(createQuery, params)

            // Get created relation from result
            if (result.records.length > 0) {
              // Type guard for array access
              const record = result.records[0]
              if (record) {
                const rel = record.get("r").properties
                const fromNode = record.get("from").properties
                const toNode = record.get("to").properties

                const createdRelation = this.relationshipToRelation(
                  rel,
                  fromNode.name,
                  toNode.name
                )

                createdRelations.push(createdRelation)
              }
            }
          }

          // Commit transaction
          await txc.commit()

          return createdRelations
        } catch (error) {
          // Rollback on error
          await txc.rollback()
          throw error
        }
      } finally {
        // Close session
        await session.close()
      }
    } catch (error) {
      this.logger.error("Error creating relations in Neo4j", error)
      throw error
    }
  }

  /**
   * Add observations to entities
   * @param observations Array of objects with entity name and observation contents
   */
  async addObservations(
    observations: { entityName: string; contents: string[] }[]
  ): Promise<{ entityName: string; addedObservations: string[] }[]> {
    try {
      if (!observations || observations.length === 0) {
        return []
      }

      const session = this.connectionManager.getSession()
      const results: { entityName: string; addedObservations: string[] }[] = []

      try {
        // Begin transaction
        const txc = session.beginTransaction()

        try {
          for (const obs of observations) {
            if (
              !(obs.entityName && obs.contents) ||
              obs.contents.length === 0
            ) {
              continue
            }

            // Step 1: Get the current entity and its relationships
            const getQuery = `
              MATCH (e:Entity {name: $name})
              WHERE e.validTo IS NULL
              OPTIONAL MATCH (e)-[r:RELATES_TO]->(to:Entity)
              WHERE r.validTo IS NULL
              OPTIONAL MATCH (from:Entity)-[r2:RELATES_TO]->(e)
              WHERE r2.validTo IS NULL
              RETURN e, collect(DISTINCT {rel: r, to: to}) as outgoing,
                        collect(DISTINCT {rel: r2, from: from}) as incoming
            `

            const getResult = await txc.run(getQuery, { name: obs.entityName })

            if (getResult.records.length === 0) {
              this.logger.warn(`Entity not found: ${obs.entityName}`)
              continue
            }

            // Type guard for array access
            const firstRecord = getResult.records[0]
            if (!firstRecord) {
              this.logger.warn(`No record found for entity: ${obs.entityName}`)
              continue
            }

            // Get entity properties
            const currentNode = firstRecord.get("e").properties
            const currentObservations = JSON.parse(
              currentNode.observations || "[]"
            )
            const outgoingRels = firstRecord.get("outgoing")
            const incomingRels = firstRecord.get("incoming")

            // Step 2: Create a new version of the entity with updated observations
            const now = Date.now()
            const newVersion = (currentNode.version || 0) + 1
            const newEntityId = uuidv4()

            // Filter out duplicates
            const newObservations = obs.contents.filter(
              (content) => !currentObservations.includes(content)
            )

            // Skip if no new observations
            if (newObservations.length === 0) {
              results.push({
                entityName: obs.entityName,
                addedObservations: [],
              })
              continue
            }

            // Combine observations
            const allObservations = [...currentObservations, ...newObservations]

            // Step 3: Mark the old entity and its relationships as invalid
            const invalidateQuery = `
              MATCH (e:Entity {id: $id})
              SET e.validTo = $now
              WITH e
              OPTIONAL MATCH (e)-[r:RELATES_TO]->()
              WHERE r.validTo IS NULL
              SET r.validTo = $now
              WITH e
              OPTIONAL MATCH ()-[r2:RELATES_TO]->(e)
              WHERE r2.validTo IS NULL
              SET r2.validTo = $now
            `

            await txc.run(invalidateQuery, {
              id: currentNode.id,
              now,
            })

            // Step 4: Create the new version
            const createQuery = `
              CREATE (e:Entity {
                id: $id,
                name: $name,
                entityType: $entityType,
                observations: $observations,
                version: $version,
                createdAt: $createdAt,
                updatedAt: $now,
                validFrom: $now,
                validTo: null,
                changedBy: $changedBy
              })
              RETURN e
            `

            const createParams = {
              id: newEntityId,
              name: currentNode.name,
              entityType: currentNode.entityType,
              observations: JSON.stringify(allObservations),
              version: newVersion,
              createdAt: currentNode.createdAt,
              now,
              changedBy: null,
            }

            await txc.run(createQuery, createParams)

            // Step 5: Recreate relationships for the new version
            for (const outRel of outgoingRels) {
              if (!(outRel.rel && outRel.to)) {
                continue
              }

              const relProps = outRel.rel.properties
              const newRelId = uuidv4()

              const createOutRelQuery = `
                MATCH (from:Entity {id: $fromId})
                MATCH (to:Entity {id: $toId})
                CREATE (from)-[r:RELATES_TO {
                  id: $id,
                  relationType: $relationType,
                  strength: $strength,
                  confidence: $confidence,
                  metadata: $metadata,
                  version: $version,
                  createdAt: $createdAt,
                  updatedAt: $now,
                  validFrom: $now,
                  validTo: null,
                  changedBy: $changedBy
                }]->(to)
              `

              await txc.run(createOutRelQuery, {
                fromId: newEntityId,
                toId: outRel.to.properties.id,
                id: newRelId,
                relationType: relProps.relationType,
                strength:
                  relProps.strength !== undefined
                    ? relProps.strength
                    : DEFAULT_RELATION_STRENGTH,
                confidence:
                  relProps.confidence !== undefined
                    ? relProps.confidence
                    : DEFAULT_RELATION_CONFIDENCE,
                metadata: relProps.metadata || null,
                version: relProps.version || 1,
                createdAt: relProps.createdAt || Date.now(),
                now,
                changedBy: null,
              })
            }

            for (const inRel of incomingRels) {
              if (!(inRel.rel && inRel.from)) {
                continue
              }

              const relProps = inRel.rel.properties
              const newRelId = uuidv4()

              const createInRelQuery = `
                MATCH (from:Entity {id: $fromId})
                MATCH (to:Entity {id: $toId})
                CREATE (from)-[r:RELATES_TO {
                  id: $id,
                  relationType: $relationType,
                  strength: $strength,
                  confidence: $confidence,
                  metadata: $metadata,
                  version: $version,
                  createdAt: $createdAt,
                  updatedAt: $now,
                  validFrom: $now,
                  validTo: null,
                  changedBy: $changedBy
                }]->(to)
              `

              await txc.run(createInRelQuery, {
                fromId: inRel.from.properties.id,
                toId: newEntityId,
                id: newRelId,
                relationType: relProps.relationType,
                strength:
                  relProps.strength !== undefined
                    ? relProps.strength
                    : DEFAULT_RELATION_STRENGTH,
                confidence:
                  relProps.confidence !== undefined
                    ? relProps.confidence
                    : DEFAULT_RELATION_CONFIDENCE,
                metadata: relProps.metadata || null,
                version: relProps.version || 1,
                createdAt: relProps.createdAt || Date.now(),
                now,
                changedBy: null,
              })
            }

            // Step 6: Add result to return array
            results.push({
              entityName: obs.entityName,
              addedObservations: newObservations,
            })
          }

          // Commit transaction
          await txc.commit()

          return results
        } catch (error) {
          // Rollback on error
          await txc.rollback()
          throw error
        }
      } finally {
        // Close session
        await session.close()
      }
    } catch (error) {
      this.logger.error("Error adding observations in Neo4j", error)
      throw error
    }
  }

  /**
   * Delete entities and their relations
   * @param entityNames Array of entity names to delete
   */
  async deleteEntities(entityNames: string[]): Promise<void> {
    try {
      if (!entityNames || entityNames.length === 0) {
        return
      }

      const session = this.connectionManager.getSession()

      try {
        // Begin transaction
        const txc = session.beginTransaction()

        try {
          // Delete entities and their relations
          const deleteQuery = `
            MATCH (e:Entity)
            WHERE e.name IN $names
            DETACH DELETE e
          `

          await txc.run(deleteQuery, { names: entityNames })

          // Commit transaction
          await txc.commit()
        } catch (error) {
          // Rollback on error
          await txc.rollback()
          throw error
        }
      } finally {
        // Close session
        await session.close()
      }
    } catch (error) {
      this.logger.error("Error deleting entities in Neo4j", error)
      throw error
    }
  }

  /**
   * Delete observations from entities
   * @param deletions Array of objects with entity name and observations to delete
   */
  async deleteObservations(
    deletions: { entityName: string; observations: string[] }[]
  ): Promise<void> {
    try {
      if (!deletions || deletions.length === 0) {
        return
      }

      const session = this.connectionManager.getSession()

      try {
        // Begin transaction
        const txc = session.beginTransaction()

        try {
          for (const deletion of deletions) {
            if (
              !(deletion.entityName && deletion.observations) ||
              deletion.observations.length === 0
            ) {
              continue
            }

            // Step 1: Get the current entity
            const getQuery = `
              MATCH (e:Entity {name: $name})
              WHERE e.validTo IS NULL
              RETURN e
            `

            const getResult = await txc.run(getQuery, {
              name: deletion.entityName,
            })

            if (getResult.records.length === 0) {
              this.logger.warn(`Entity not found: ${deletion.entityName}`)
              continue
            }

            // Type guard for array access
            const firstRecord = getResult.records[0]
            if (!firstRecord) {
              this.logger.warn(
                `No record found for entity: ${deletion.entityName}`
              )
              continue
            }

            // Get entity properties
            const currentNode = firstRecord.get("e").properties
            const currentObservations = JSON.parse(
              currentNode.observations || "[]"
            )

            // Step 2: Remove the observations
            const updatedObservations = currentObservations.filter(
              (obs: string) => !deletion.observations.includes(obs)
            )

            // Step 3: Create a new version of the entity with updated observations
            const now = Date.now()
            const newVersion = (currentNode.version || 0) + 1
            const newEntityId = uuidv4()

            // Step 4: Mark the old entity as invalid
            const invalidateQuery = `
              MATCH (e:Entity {id: $id})
              SET e.validTo = $now
            `

            await txc.run(invalidateQuery, {
              id: currentNode.id,
              now,
            })

            // Step 5: Create the new version
            const createQuery = `
              CREATE (e:Entity {
                id: $id,
                name: $name,
                entityType: $entityType,
                observations: $observations,
                version: $version,
                createdAt: $createdAt,
                updatedAt: $now,
                validFrom: $now,
                validTo: null,
                changedBy: $changedBy
              })
              RETURN e
            `

            const createParams = {
              id: newEntityId,
              name: currentNode.name,
              entityType: currentNode.entityType,
              observations: JSON.stringify(updatedObservations),
              version: newVersion,
              createdAt: currentNode.createdAt,
              now,
              changedBy: null,
            }

            await txc.run(createQuery, createParams)
          }

          // Commit transaction
          await txc.commit()
        } catch (error) {
          // Rollback on error
          await txc.rollback()
          throw error
        }
      } finally {
        // Close session
        await session.close()
      }
    } catch (error) {
      this.logger.error("Error deleting observations in Neo4j", error)
      throw error
    }
  }

  /**
   * Delete relations from the graph
   * @param relations Array of relations to delete
   */
  async deleteRelations(relations: Relation[]): Promise<void> {
    try {
      if (!relations || relations.length === 0) {
        return
      }

      const session = this.connectionManager.getSession()

      try {
        // Begin transaction
        const txc = session.beginTransaction()

        try {
          for (const relation of relations) {
            // Delete relation query
            const deleteQuery = `
              MATCH (from:Entity {name: $fromName})-[r:RELATES_TO]->(to:Entity {name: $toName})
              WHERE r.relationType = $relationType
              DELETE r
            `

            await txc.run(deleteQuery, {
              fromName: relation.from,
              toName: relation.to,
              relationType: relation.relationType,
            })
          }

          // Commit transaction
          await txc.commit()
        } catch (error) {
          // Rollback on error
          await txc.rollback()
          throw error
        }
      } finally {
        // Close session
        await session.close()
      }
    } catch (error) {
      this.logger.error("Error deleting relations in Neo4j", error)
      throw error
    }
  }

  /**
   * Get an entity by name
   * @param entityName Name of the entity to retrieve
   */
  async getEntity(entityName: string): Promise<TemporalEntityType | null> {
    try {
      // Query for entity by name
      const query = `
        MATCH (e:Entity {name: $name})
        WHERE e.validTo IS NULL
        RETURN e
      `

      // Execute query
      const result = await this.connectionManager.executeQuery(query, {
        name: entityName,
      })

      // Return null if no entity found
      if (result.records.length === 0) {
        return null
      }

      // Type guard for array access
      const firstRecord = result.records[0]
      if (!firstRecord) {
        this.logger.warn(`No record found for entity: ${entityName}`)
        return null
      }

      // Convert node to entity
      const node = firstRecord.get("e").properties
      return this.nodeToEntity(node)
    } catch (error) {
      this.logger.error(
        `Error retrieving entity ${entityName} from Neo4j`,
        error
      )
      throw error
    }
  }

  /**
   * Get a specific relation by its source, target, and type
   * @param from Source entity name
   * @param to Target entity name
   * @param relationType Relation type
   */
  async getRelation(
    from: string,
    to: string,
    relationType: string
  ): Promise<Relation | null> {
    try {
      // Query for relation
      const query = `
        MATCH (from:Entity {name: $fromName})-[r:RELATES_TO]->(to:Entity {name: $toName})
        WHERE r.relationType = $relationType
        AND r.validTo IS NULL
        RETURN r, from, to
      `

      // Execute query
      const result = await this.connectionManager.executeQuery(query, {
        fromName: from,
        toName: to,
        relationType,
      })

      // Return null if no relation found
      if (result.records.length === 0) {
        return null
      }

      // Type guard for array access
      const record = result.records[0]
      if (!record) {
        this.logger.warn("No record found after checking length", {
          from,
          to,
          type,
        })
        return null
      }

      // Convert relationship to relation
      const rel = record.get("r").properties
      const fromNode = record.get("from").properties
      const toNode = record.get("to").properties

      return this.relationshipToRelation(rel, fromNode.name, toNode.name)
    } catch (error) {
      this.logger.error("Error retrieving relation from Neo4j", error)
      throw error
    }
  }

  /**
   * Update an existing relation with new properties
   * @param relation The relation with updated properties
   */
  async updateRelation(relation: Relation): Promise<void> {
    try {
      const session = this.connectionManager.getSession()

      try {
        // Begin transaction
        const txc = session.beginTransaction()

        try {
          // Step 1: Get the current relation
          const getQuery = `
            MATCH (from:Entity {name: $fromName})-[r:RELATES_TO]->(to:Entity {name: $toName})
            WHERE r.relationType = $relationType
            AND r.validTo IS NULL
            RETURN r
          `

          const getResult = await txc.run(getQuery, {
            fromName: relation.from,
            toName: relation.to,
            relationType: relation.relationType,
          })

          if (getResult.records.length === 0) {
            throw new Error(
              `Relation not found: ${relation.from} -> ${relation.to} (${relation.relationType})`
            )
          }

          // Type guard for array access
          const firstRecord = getResult.records[0]
          if (!firstRecord) {
            throw new Error(
              `No record found for relation: ${relation.from} -> ${relation.to} (${relation.relationType})`
            )
          }

          // Get relation properties
          const currentRel = firstRecord.get("r").properties

          // Step 2: Update the relation with temporal versioning
          const now = Date.now()
          const newVersion = (currentRel.version || 0) + 1
          const newRelationId = uuidv4()

          // Step 3: Mark the old relation as invalid
          const invalidateQuery = `
            MATCH (from:Entity {name: $fromName})-[r:RELATES_TO {id: $id}]->(to:Entity {name: $toName})
            SET r.validTo = $now
          `

          await txc.run(invalidateQuery, {
            fromName: relation.from,
            toName: relation.to,
            id: currentRel.id,
            now,
          })

          // Step 4: Create the new version of the relation
          const createQuery = `
            MATCH (from:Entity {name: $fromName})
            MATCH (to:Entity {name: $toName})
            CREATE (from)-[r:RELATES_TO {
              id: $id,
              relationType: $relationType,
              strength: $strength,
              confidence: $confidence,
              metadata: $metadata,
              version: $version,
              createdAt: $createdAt,
              updatedAt: $now,
              validFrom: $now,
              validTo: null,
              changedBy: $changedBy
            }]->(to)
          `

          const extendedRelation = relation as ExtendedRelation
          const createParams = {
            id: newRelationId,
            fromName: relation.from,
            toName: relation.to,
            relationType: relation.relationType,
            strength:
              relation.strength !== undefined
                ? relation.strength
                : currentRel.strength,
            confidence:
              relation.confidence !== undefined
                ? relation.confidence
                : currentRel.confidence,
            metadata: relation.metadata
              ? JSON.stringify(relation.metadata)
              : currentRel.metadata,
            version: newVersion,
            createdAt: currentRel.createdAt,
            now,
            changedBy: extendedRelation.changedBy || null,
          }

          await txc.run(createQuery, createParams)

          // Commit transaction
          await txc.commit()
        } catch (error) {
          // Rollback on error
          await txc.rollback()
          throw error
        }
      } finally {
        // Close session
        await session.close()
      }
    } catch (error) {
      this.logger.error("Error updating relation in Neo4j", error)
      throw error
    }
  }

  /**
   * Get the history of all versions of an entity
   * @param entityName The name of the entity to retrieve history for
   */
  async getEntityHistory(entityName: string): Promise<TemporalEntityType[]> {
    try {
      // Query for entity history
      const query = `
        MATCH (e:Entity {name: $name})
        RETURN e
        ORDER BY e.validFrom ASC
      `

      // Execute query
      const result = await this.connectionManager.executeQuery(query, {
        name: entityName,
      })

      // Return empty array if no history found
      if (result.records.length === 0) {
        return []
      }

      // Convert nodes to entities
      return result.records.map((record) => {
        const node = record.get("e").properties
        return this.nodeToEntity(node)
      })
    } catch (error) {
      this.logger.error(
        `Error retrieving history for entity ${entityName} from Neo4j`,
        error
      )
      throw error
    }
  }

  /**
   * Get the history of all versions of a relation
   * @param from Source entity name
   * @param to Target entity name
   * @param relationType Type of the relation
   */
  async getRelationHistory(
    from: string,
    to: string,
    relationType: string
  ): Promise<Relation[]> {
    try {
      // Query for relation history
      const query = `
        MATCH (from:Entity {name: $fromName})-[r:RELATES_TO]->(to:Entity {name: $toName})
        WHERE r.relationType = $relationType
        RETURN r, from, to
        ORDER BY r.validFrom ASC
      `

      // Execute query
      const result = await this.connectionManager.executeQuery(query, {
        fromName: from,
        toName: to,
        relationType,
      })

      // Return empty array if no history found
      if (result.records.length === 0) {
        return []
      }

      // Convert relationships to relations
      return result.records.map((record) => {
        const rel = record.get("r").properties
        const fromNode = record.get("from").properties
        const toNode = record.get("to").properties

        return this.relationshipToRelation(rel, fromNode.name, toNode.name)
      })
    } catch (error) {
      this.logger.error("Error retrieving relation history from Neo4j", error)
      throw error
    }
  }

  /**
   * Get the state of the knowledge graph at a specific point in time
   * @param timestamp The timestamp to get the graph state at
   */
  async getGraphAtTime(timestamp: number): Promise<KnowledgeGraph> {
    try {
      const startTime = Date.now()

      // Query for entities valid at timestamp
      const entityQuery = `
        MATCH (e:Entity)
        WHERE e.validFrom <= $timestamp
        AND (e.validTo IS NULL OR e.validTo > $timestamp)
        RETURN e
      `

      // Execute entity query
      const entityResult = await this.connectionManager.executeQuery(
        entityQuery,
        { timestamp }
      )

      // Convert nodes to entities
      const entities = entityResult.records.map((record) => {
        const node = record.get("e").properties
        return this.nodeToEntity(node)
      })

      // Query for relations valid at timestamp
      const relationQuery = `
        MATCH (from:Entity)-[r:RELATES_TO]->(to:Entity)
        WHERE r.validFrom <= $timestamp
        AND (r.validTo IS NULL OR r.validTo > $timestamp)
        RETURN r, from.name AS fromName, to.name AS toName
      `

      // Execute relation query
      const relationResult = await this.connectionManager.executeQuery(
        relationQuery,
        {
          timestamp,
        }
      )

      // Convert relationships to relations
      const relations = relationResult.records.map((record) => {
        const rel = record.get("r").properties
        const fromName = record.get("fromName")
        const toName = record.get("toName")

        return this.relationshipToRelation(rel, fromName, toName)
      })

      const timeTaken = Date.now() - startTime

      // Return the graph state at the timestamp
      return {
        entities,
        relations,
        total: entities.length,
        timeTaken,
      }
    } catch (error) {
      this.logger.error(
        `Error retrieving graph state at timestamp ${timestamp} from Neo4j`,
        error
      )
      throw error
    }
  }

  /**
   * Get the current knowledge graph with confidence decay applied to relations
   * based on their age and the configured decay settings
   */
  async getDecayedGraph(): Promise<KnowledgeGraph> {
    try {
      // If decay is not enabled, just return the regular graph
      if (!this.decayConfig.enabled) {
        return this.loadGraph()
      }

      const startTime = Date.now()

      // Load entities
      const entityQuery = `
        MATCH (e:Entity)
        WHERE e.validTo IS NULL
        RETURN e
      `

      const entityResult = await this.connectionManager.executeQuery(
        entityQuery,
        {}
      )

      const entities = entityResult.records.map((record) => {
        const node = record.get("e").properties
        return this.nodeToEntity(node)
      })

      // Calculate decay factor
      const halfLifeMs =
        this.decayConfig.halfLifeDays *
        HOURS_PER_DAY *
        MINUTES_PER_HOUR *
        SECONDS_PER_MINUTE *
        MILLISECONDS_PER_SECOND
      const decayFactor = Math.log(HALF_LIFE_DECAY_CONSTANT) / halfLifeMs

      // Load relations and apply decay
      const relationQuery = `
        MATCH (from:Entity)-[r:RELATES_TO]->(to:Entity)
        WHERE r.validTo IS NULL
        RETURN r, from.name AS fromName, to.name AS toName
      `

      const relationResult = await this.connectionManager.executeQuery(
        relationQuery,
        {}
      )

      const relations = relationResult.records.map((record) => {
        const rel = record.get("r").properties
        const fromName = record.get("fromName")
        const toName = record.get("toName")

        // Create base relation
        const relation = this.relationshipToRelation(rel, fromName, toName)

        // Apply decay if confidence is present
        if (relation.confidence !== null && relation.confidence !== undefined) {
          const extendedRelation = relation as ExtendedRelation
          const ageDiff =
            startTime -
            (extendedRelation.validFrom ||
              extendedRelation.createdAt ||
              startTime)
          let decayedConfidence =
            relation.confidence * Math.exp(decayFactor * ageDiff)

          // Don't let confidence decay below minimum
          if (decayedConfidence < this.decayConfig.minConfidence) {
            decayedConfidence = this.decayConfig.minConfidence
          }

          relation.confidence = decayedConfidence
        }

        return relation
      })

      const timeTaken = Date.now() - startTime

      // Return the graph with decayed confidence values
      return {
        entities,
        relations,
        total: entities.length,
        timeTaken,
        diagnostics: {
          decay_info: {
            enabled: this.decayConfig.enabled,
            halfLifeDays: this.decayConfig.halfLifeDays,
            minConfidence: this.decayConfig.minConfidence,
            decayFactor,
          },
        },
      }
    } catch (error) {
      this.logger.error("Error getting decayed graph from Neo4j", error)
      throw error
    }
  }

  /**
   * Store or update the embedding vector for an entity
   * @param entityName The name of the entity to update
   * @param embedding The embedding data to store
   */
  async updateEntityEmbedding(
    entityName: string,
    embedding: EntityEmbedding
  ): Promise<void> {
    try {
      // Verify that the entity exists
      const entity = await this.getEntity(entityName)
      if (!entity) {
        throw new Error(`Entity ${entityName} not found`)
      }

      const session = this.connectionManager.getSession()

      try {
        // Begin transaction
        const txc = session.beginTransaction()

        try {
          // Update the entity with the embedding
          const updateQuery = `
            MATCH (e:Entity {name: $name})
            WHERE e.validTo IS NULL
            SET e.embedding = $embedding,
                e.updatedAt = $now
            RETURN e
          `

          await txc.run(updateQuery, {
            name: entityName,
            embedding: embedding.vector,
            now: Date.now(),
          })

          // Commit transaction
          await txc.commit()
        } catch (error) {
          // Rollback on error
          await txc.rollback()
          throw error
        }
      } finally {
        // Close session
        await session.close()
      }
    } catch (error) {
      this.logger.error(
        `Error updating embedding for entity ${entityName} in Neo4j`,
        error
      )
      throw error
    }
  }

  /**
   * Get the embedding vector for an entity
   * @param entityName The name of the entity
   * @returns Promise resolving to the EntityEmbedding or null if not found
   */
  async getEntityEmbedding(
    entityName: string
  ): Promise<EntityEmbedding | null> {
    try {
      // Verify that the entity exists
      const entity = await this.getEntity(entityName)
      if (!entity) {
        this.logger.debug(
          `Entity not found when retrieving embedding: ${entityName}`
        )
        return null
      }

      const session = this.connectionManager.getSession()

      try {
        // Query to get the entity with its embedding
        const query = `
          MATCH (e:Entity {name: $name})
          WHERE e.validTo IS NULL
          RETURN e.embedding AS embedding
        `

        const result = await session.run(query, { name: entityName })

        if (result.records.length === 0) {
          this.logger.debug(`No embedding found for entity: ${entityName}`)
          return null
        }

        // Type guard for array access
        const firstRecord = result.records[0]
        if (!firstRecord?.get("embedding")) {
          this.logger.debug(`No embedding found for entity: ${entityName}`)
          return null
        }

        const embeddingVector = firstRecord.get("embedding")

        // Return the embedding in the expected format
        return {
          vector: embeddingVector,
          model: "unknown", // We don't store the model info in Neo4j
          lastUpdated: entity.updatedAt || Date.now(),
        }
      } finally {
        await session.close()
      }
    } catch (error) {
      this.logger.error(
        `Error retrieving embedding for entity ${entityName} from Neo4j`,
        error
      )
      return null
    }
  }

  /**
   * Find entities similar to a query vector
   * @param queryVector The vector to compare against
   * @param limit Maximum number of results to return
   */
  async findSimilarEntities(
    queryVector: number[],
    limit = 10
  ): Promise<Array<TemporalEntityType & { similarity: number }>> {
    try {
      // Direct vector search implementation using the approach proven to work in our test script
      this.logger.debug(
        `Neo4jStorageProvider: Using direct vector search with ${limit} limit`
      )

      const session = this.connectionManager.getSession()

      try {
        const result = await session.run(
          `
          CALL db.index.vector.queryNodes(
            'entity_embeddings',
            $limit,
            $embedding
          )
          YIELD node, score
          RETURN node.name AS name, node.entityType AS entityType, score
          ORDER BY score DESC
        `,
          {
            limit: neo4j.int(Math.floor(limit)),
            embedding: queryVector,
          }
        )

        const foundResults = result.records.length
        this.logger.debug(
          `Neo4jStorageProvider: Direct vector search found ${foundResults} results`
        )

        if (foundResults > 0) {
          // Convert to entity objects
          const entityPromises = result.records.map(async (record) => {
            const entityName = record.get("name")
            const similarity = record.get("score")
            const entity = await this.getEntity(entityName)
            if (entity) {
              return {
                ...entity,
                similarity,
              }
            }
            return null
          })

          const entities = (await Promise.all(entityPromises)).filter(
            (e): e is TemporalEntityType & { similarity: number } =>
              e !== null && typeof e.similarity === "number"
          )

          // Return only valid entities
          return entities
            .filter((entity) => entity.validTo === null)
            .slice(0, limit)
        }

        this.logger.debug("Neo4jStorageProvider: No results from vector search")
        return []
      } finally {
        await session.close()
      }
    } catch (error) {
      this.logger.error("Error finding similar entities in Neo4j", error)
      return []
    }
  }

  /**
   * Search for entities using semantic search
   * @param query The search query text
   * @param options Search options including semantic search parameters
   */
  async semanticSearch(
    query: string,
    options: SearchOptions & Neo4jSemanticSearchOptions = {}
  ): Promise<KnowledgeGraphWithDiagnostics> {
    try {
      // Create diagnostics object for debugging
      const diagnostics: {
        query: string
        startTime: number
        stepsTaken: Record<string, unknown>[]
        endTime?: number
        [key: string]: unknown
      } = {
        query,
        startTime: Date.now(),
        stepsTaken: [],
      }

      // Log start of semantic search
      diagnostics.stepsTaken.push({
        step: "start",
        timestamp: Date.now(),
        options: {
          query,
          hasQueryVector: !!options.queryVector,
          limit: options.limit,
          entityTypes: options.entityTypes,
          minSimilarity: options.minSimilarity,
        },
      })

      // Enhanced logging for semantic search
      this.logger.debug("Neo4jStorageProvider: Starting semantic search", {
        query,
        hasQueryVector: !!options.queryVector,
        limit: options.limit,
        entityTypes: options.entityTypes,
      })

      // Ensure vector store is initialized
      if (!this.vectorStore["initialized"]) {
        this.logger.info(
          "Neo4jStorageProvider: Vector store not initialized, initializing now"
        )
        diagnostics.stepsTaken.push({
          step: "vectorStoreInitialization",
          timestamp: Date.now(),
          status: "started",
        })

        try {
          await this.vectorStore.initialize()
          this.logger.info(
            "Neo4jStorageProvider: Vector store initialized successfully for semantic search"
          )
          diagnostics.stepsTaken.push({
            step: "vectorStoreInitialization",
            timestamp: Date.now(),
            status: "success",
          })
        } catch (initError) {
          this.logger.error(
            "Neo4jStorageProvider: Failed to initialize vector store for semantic search",
            initError
          )
          diagnostics.stepsTaken.push({
            step: "vectorStoreInitialization",
            timestamp: Date.now(),
            status: "error",
            error:
              initError instanceof Error
                ? initError.message
                : String(initError),
          })
          // We'll continue but might fail if the vector operations are called
        }
      }

      // If no embedding service, log a warning
      if (this.embeddingService) {
        diagnostics.stepsTaken.push({
          step: "embeddingServiceCheck",
          timestamp: Date.now(),
          status: "available",
          model: this.embeddingService.getProviderInfo().model,
          dimensions: this.embeddingService.getProviderInfo().dimensions,
        })
      } else {
        this.logger.warn(
          "Neo4jStorageProvider: No embedding service available for semantic search"
        )
        diagnostics.stepsTaken.push({
          step: "embeddingServiceCheck",
          timestamp: Date.now(),
          status: "unavailable",
        })
      }

      // Generate query vector if not provided and embedding service is available
      if (!options.queryVector && this.embeddingService) {
        try {
          this.logger.debug(
            "Neo4jStorageProvider: Generating query vector for semantic search"
          )
          diagnostics.stepsTaken.push({
            step: "generateQueryEmbedding",
            timestamp: Date.now(),
            status: "started",
          })

          options.queryVector =
            await this.embeddingService.generateEmbedding(query)

          diagnostics.stepsTaken.push({
            step: "generateQueryEmbedding",
            timestamp: Date.now(),
            status: "success",
            vectorLength: options.queryVector.length,
            sampleValues: options.queryVector.slice(0, DIAGNOSTIC_SAMPLE_SIZE),
          })

          this.logger.debug(
            "Neo4jStorageProvider: Query vector generated successfully",
            {
              vectorLength: options.queryVector.length,
            }
          )
        } catch (embedError) {
          diagnostics.stepsTaken.push({
            step: "generateQueryEmbedding",
            timestamp: Date.now(),
            status: "error",
            error:
              embedError instanceof Error
                ? embedError.message
                : String(embedError),
          })

          this.logger.error(
            "Neo4jStorageProvider: Failed to generate query vector for semantic search",
            embedError
          )
        }
      } else if (options.queryVector) {
        diagnostics.stepsTaken.push({
          step: "searchMethod",
          timestamp: Date.now(),
          method: "vectorOnly",
        })

        const searchLimit = Math.floor(options.limit || 10)
        const minSimilarity = options.minSimilarity || DEFAULT_MIN_SIMILARITY

        diagnostics.stepsTaken.push({
          step: "vectorSearch",
          timestamp: Date.now(),
          status: "started",
          limit: searchLimit,
          minSimilarity,
        })

        // DIRECT VECTOR SEARCH IMPLEMENTATION
        // Instead of using findSimilarEntities - which isn't working in the MCP context
        // we'll directly use the working technique from our test script
        try {
          const session = this.connectionManager.getSession()

          try {
            const vectorResult = await session.run(
              `
              CALL db.index.vector.queryNodes(
                'entity_embeddings',
                $limit,
                $embedding
              )
              YIELD node, score
              WHERE score >= $minScore
              RETURN node.name AS name, node.entityType AS entityType, score
              ORDER BY score DESC
            `,
              {
                limit: neo4j.int(searchLimit),
                embedding: options.queryVector,
                minScore: minSimilarity,
              }
            )

            const foundResults = vectorResult.records.length
            this.logger.debug(
              `Neo4jStorageProvider: Direct vector search found ${foundResults} results`
            )

            if (foundResults > 0) {
              // Convert to EntityData objects
              const entityPromises = vectorResult.records.map((record) => {
                const entityName = record.get("name")
                return this.getEntity(entityName)
              })

              const entities = (await Promise.all(entityPromises)).filter(
                (e): e is TemporalEntityType => e !== null
              )

              diagnostics.stepsTaken.push({
                step: "vectorSearch",
                timestamp: Date.now(),
                status: "completed",
                resultsCount: entities.length,
              })

              // If no entities found after filtering, return empty result
              if (entities.length === 0) {
                diagnostics.endTime = Date.now()
                diagnostics.totalTimeTaken =
                  diagnostics.endTime - diagnostics.startTime

                // Only include diagnostics if DEBUG is enabled
                const result: KnowledgeGraphWithDiagnostics = {
                  entities: [],
                  relations: [],
                }
                if (process.env.DEBUG === "true") {
                  result.diagnostics = diagnostics
                }

                return result
              }

              // Get related relations
              const entityNames = entities.map((e) => e.name)
              const finalGraph = await this.openNodes(entityNames)

              diagnostics.endTime = Date.now()
              diagnostics.totalTimeTaken =
                diagnostics.endTime - diagnostics.startTime

              // Only include diagnostics if DEBUG is enabled
              if (process.env.DEBUG === "true") {
                return {
                  ...finalGraph,
                  diagnostics,
                }
              }

              return finalGraph
            }
            // No results from vector search
            diagnostics.stepsTaken.push({
              step: "vectorSearch",
              timestamp: Date.now(),
              status: "completed",
              resultsCount: 0,
            })

            diagnostics.endTime = Date.now()
            diagnostics.totalTimeTaken =
              diagnostics.endTime - diagnostics.startTime

            // Only include diagnostics if DEBUG is enabled
            const result: KnowledgeGraphWithDiagnostics = {
              entities: [],
              relations: [],
            }
            if (process.env.DEBUG === "true") {
              result.diagnostics = diagnostics
            }

            return result
          } catch (error) {
            this.logger.error(
              `Neo4jStorageProvider: Direct vector search error: ${error instanceof Error ? error.message : String(error)}`
            )
            diagnostics.stepsTaken.push({
              step: "vectorSearch",
              timestamp: Date.now(),
              status: "error",
              error: error instanceof Error ? error.message : String(error),
            })
          } finally {
            await session.close()
          }
        } catch (error) {
          this.logger.error(
            `Neo4jStorageProvider: Direct vector search session error: ${error instanceof Error ? error.message : String(error)}`
          )
        }

        // If we get here, the direct approach failed, fall back to original implementation
        const results = await this.findSimilarEntities(
          options.queryVector,
          searchLimit * 2 // findSimilarEntities will handle neo4j.int conversion
        )

        // Filter by min similarity and entity types
        const filteredResults = results
          .filter((result) => result.similarity >= minSimilarity)
          .filter((result) => {
            if (!options.entityTypes || options.entityTypes.length === 0) {
              return true
            }
            return options.entityTypes.includes(result.entityType)
          })
          .slice(0, searchLimit)

        diagnostics.stepsTaken.push({
          step: "filterResults",
          timestamp: Date.now(),
          status: "completed",
          filteredResultsCount: filteredResults.length,
        })

        // If no results, return empty graph
        if (filteredResults.length === 0) {
          diagnostics.stepsTaken.push({
            step: "finalResult",
            timestamp: Date.now(),
            status: "empty",
          })

          diagnostics.endTime = Date.now()
          diagnostics.totalTimeTaken =
            diagnostics.endTime - diagnostics.startTime

          // Only include diagnostics if DEBUG is enabled
          const result: KnowledgeGraphWithDiagnostics = {
            entities: [],
            relations: [],
          }
          if (process.env.DEBUG === "true") {
            result.diagnostics = diagnostics
          }

          return result
        }

        // Get the entities and relations
        const entityNames = filteredResults.map((r) => r.name)

        diagnostics.stepsTaken.push({
          step: "openNodes",
          timestamp: Date.now(),
          status: "started",
          entityNames,
        })

        const finalGraph = await this.openNodes(entityNames)

        diagnostics.stepsTaken.push({
          step: "openNodes",
          timestamp: Date.now(),
          status: "completed",
          entitiesCount: finalGraph.entities.length,
          relationsCount: finalGraph.relations.length,
        })

        diagnostics.endTime = Date.now()
        diagnostics.totalTimeTaken = diagnostics.endTime - diagnostics.startTime

        // Only include diagnostics if DEBUG is enabled
        if (process.env.DEBUG === "true") {
          return {
            ...finalGraph,
            diagnostics,
          }
        }

        return finalGraph
      }

      // If no query vector provided, fall back to text search
      diagnostics.stepsTaken.push({
        step: "searchMethod",
        timestamp: Date.now(),
        method: "textOnly",
        reason: "No query vector available",
      })

      const textSearchLimit = Math.floor(options.limit || 10)

      diagnostics.stepsTaken.push({
        step: "textSearch",
        timestamp: Date.now(),
        status: "started",
        limit: textSearchLimit,
      })

      const textResults = await this.searchNodes(query, {
        ...options,
        limit: textSearchLimit,
      })

      diagnostics.stepsTaken.push({
        step: "textSearch",
        timestamp: Date.now(),
        status: "completed",
        resultsCount: textResults.entities.length,
        timeTaken: textResults.timeTaken,
      })

      diagnostics.endTime = Date.now()
      diagnostics.totalTimeTaken = diagnostics.endTime - diagnostics.startTime

      // Only include diagnostics if DEBUG is enabled
      if (process.env.DEBUG === "true") {
        return {
          ...textResults,
          diagnostics,
        }
      }

      return textResults
    } catch (error) {
      this.logger.error("Error performing semantic search in Neo4j", error)
      throw error
    }
  }

  /**
   * Direct diagnostic method to check Neo4j vector embeddings
   * Bypasses all abstractions to query the database directly
   */
  async diagnoseVectorSearch(): Promise<Record<string, unknown>> {
    try {
      // First, make sure vector store is initialized
      if (!this.vectorStore["initialized"]) {
        try {
          await this.vectorStore.initialize()
        } catch {
          // Continue even if initialization fails
        }
      }

      // Check if we can access the diagnostic method
      if (
        typeof (
          this.vectorStore as unknown as {
            diagnosticGetEntityEmbeddings?: () => Promise<
              Record<string, unknown>
            >
          }
        ).diagnosticGetEntityEmbeddings === "function"
      ) {
        return await (
          this.vectorStore as unknown as {
            diagnosticGetEntityEmbeddings: () => Promise<
              Record<string, unknown>
            >
          }
        ).diagnosticGetEntityEmbeddings()
      }
      return {
        error: "Diagnostic method not available",
        vectorStoreType: this.vectorStore.constructor.name,
      }
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : String(error),
      }
    }
  }
}
