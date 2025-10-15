import type { KnowledgeGraphManager } from "#knowledge-graph-manager"
import {
  handleAddObservations,
  handleCreateEntities,
  handleCreateRelations,
  handleDeleteEntities,
  handleReadGraph,
} from "#server/handlers/tool-handlers"
import type { Entity, Logger, Relation, TemporalEntityType } from "#types"
import {
  DEFAULT_MIN_SIMILARITY,
  DEFAULT_SEARCH_LIMIT,
  DEFAULT_VECTOR_DIMENSIONS,
} from "#types"

// ============================================================================
// Type Guard Validation Functions
// ============================================================================

/**
 * Validates and narrows an unknown value to a string
 */
function validateString(value: unknown, fieldName: string): string {
  if (typeof value !== "string") {
    throw new Error(`${fieldName} must be a string, got ${typeof value}`)
  }
  return value
}

/**
 * Validates and narrows an unknown value to a number
 */
function validateNumber(value: unknown, fieldName: string): number {
  if (typeof value !== "number") {
    throw new Error(`${fieldName} must be a number, got ${typeof value}`)
  }
  return value
}

/**
 * Validates and narrows an unknown value to a string array
 */
function validateStringArray(value: unknown, fieldName: string): string[] {
  if (!Array.isArray(value)) {
    throw new Error(`${fieldName} must be an array`)
  }
  if (!value.every((item) => typeof item === "string")) {
    throw new Error(`${fieldName} must be an array of strings`)
  }
  return value
}

/**
 * Validates and narrows an unknown value to an array
 */
function validateArray(value: unknown, fieldName: string): unknown[] {
  if (!Array.isArray(value)) {
    throw new Error(`${fieldName} must be an array`)
  }
  return value
}

/**
 * Validates and narrows an unknown value to an object
 */
function validateObject(
  value: unknown,
  fieldName: string
): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${fieldName} must be an object`)
  }
  return value as Record<string, unknown>
}

// ============================================================================
// Constants
// ============================================================================

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// ============================================================================
// Main Handler
// ============================================================================

/**
 * Handles the CallTool request.
 * Delegates to the appropriate tool handler based on the tool name.
 *
 * @param request The CallTool request object
 * @param knowledgeGraphManager The KnowledgeGraphManager instance
 * @param logger Logger instance for structured logging
 * @returns A response object with the result content
 * @throws Error if the tool is unknown or arguments are missing
 */

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: This is a dispatcher function that routes to different tool handlers
export async function handleCallToolRequest(
  request: { params?: { name?: string; arguments?: Record<string, unknown> } },
  knowledgeGraphManager: KnowledgeGraphManager,
  logger: Logger
): Promise<{ content: Array<{ type: string; text: string }> }> {
  if (!request) {
    throw new Error("Invalid request: request is null or undefined")
  }

  if (!request.params) {
    throw new Error("Invalid request: missing params")
  }

  const { name, arguments: args } = request.params

  if (!name) {
    throw new Error("Invalid request: missing tool name")
  }

  if (!args) {
    throw new Error(`No arguments provided for tool: ${name}`)
  }

  switch (name) {
    case "create_entities":
      return await handleCreateEntities(args, knowledgeGraphManager)

    case "read_graph":
      return await handleReadGraph(args, knowledgeGraphManager)

    case "create_relations":
      return await handleCreateRelations(args, knowledgeGraphManager)

    case "add_observations":
      return await handleAddObservations(args, knowledgeGraphManager, logger)

    case "delete_entities":
      return await handleDeleteEntities(args, knowledgeGraphManager)

    case "delete_observations": {
      const deletions = validateArray(args.deletions, "deletions") as Array<{
        entityName: string
        observations: string[]
      }>
      await knowledgeGraphManager.deleteObservations(deletions)
      return {
        content: [{ type: "text", text: "Observations deleted successfully" }],
      }
    }

    case "delete_relations": {
      const relations = validateArray(args.relations, "relations") as Relation[]
      await knowledgeGraphManager.deleteRelations(relations)
      return {
        content: [{ type: "text", text: "Relations deleted successfully" }],
      }
    }

    case "get_relation": {
      const from = validateString(args.from, "from")
      const to = validateString(args.to, "to")
      const relationType = validateString(args.relationType, "relationType")

      const relation = await knowledgeGraphManager.getRelation(
        from,
        to,
        relationType
      )
      if (!relation) {
        return {
          content: [
            {
              type: "text",
              text: `Relation not found: ${args.from} -> ${args.relationType} -> ${args.to}`,
            },
          ],
        }
      }
      return {
        content: [{ type: "text", text: JSON.stringify(relation, null, 2) }],
      }
    }

    case "update_relation": {
      const relation = validateObject(args.relation, "relation") as Relation
      await knowledgeGraphManager.updateRelation(relation)
      return {
        content: [{ type: "text", text: "Relation updated successfully" }],
      }
    }

    case "search_nodes": {
      const query = validateString(args.query, "query")
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              await knowledgeGraphManager.searchNodes(query),
              null,
              2
            ),
          },
        ],
      }
    }

    case "open_nodes": {
      const names = validateStringArray(args.names, "names")
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              await knowledgeGraphManager.openNodes(names),
              null,
              2
            ),
          },
        ],
      }
    }

    case "get_entity_history":
      try {
        const entityName = validateString(args.entityName, "entityName")
        const history = await knowledgeGraphManager.getEntityHistory(entityName)
        return {
          content: [{ type: "text", text: JSON.stringify(history, null, 2) }],
        }
      } catch (error: unknown) {
        const errorMessage =
          error instanceof Error ? error.message : String(error)
        return {
          content: [
            {
              type: "text",
              text: `Error retrieving entity history: ${errorMessage}`,
            },
          ],
        }
      }

    case "get_relation_history":
      try {
        const from = validateString(args.from, "from")
        const to = validateString(args.to, "to")
        const relationType = validateString(args.relationType, "relationType")

        const history = await knowledgeGraphManager.getRelationHistory(
          from,
          to,
          relationType
        )
        return {
          content: [{ type: "text", text: JSON.stringify(history, null, 2) }],
        }
      } catch (error: unknown) {
        const errorMessage =
          error instanceof Error ? error.message : String(error)
        return {
          content: [
            {
              type: "text",
              text: `Error retrieving relation history: ${errorMessage}`,
            },
          ],
        }
      }

    case "get_graph_at_time":
      try {
        const timestamp = validateNumber(args.timestamp, "timestamp")
        const graph = await knowledgeGraphManager.getGraphAtTime(timestamp)
        return {
          content: [{ type: "text", text: JSON.stringify(graph, null, 2) }],
        }
      } catch (error: unknown) {
        const errorMessage =
          error instanceof Error ? error.message : String(error)
        return {
          content: [
            {
              type: "text",
              text: `Error retrieving graph at time: ${errorMessage}`,
            },
          ],
        }
      }

    case "get_decayed_graph":
      try {
        // Note: getDecayedGraph doesn't accept parameters
        // Decay is configured at the storage provider level
        const graph = await knowledgeGraphManager.getDecayedGraph()

        return {
          content: [{ type: "text", text: JSON.stringify(graph, null, 2) }],
        }
      } catch (error: unknown) {
        const errorMessage =
          error instanceof Error ? error.message : String(error)
        return {
          content: [
            {
              type: "text",
              text: `Error retrieving decayed graph: ${errorMessage}`,
            },
          ],
        }
      }

    case "force_generate_embedding": {
      // Validate arguments
      const entityName = validateString(args.entity_name, "entity_name")

      logger.debug("Force generating embedding for entity", {
        entityName,
      })

      try {
        // First determine if the input looks like a UUID
        const isUUID = UUID_PATTERN.test(entityName)

        if (isUUID) {
          logger.debug("Input appears to be a UUID", {
            entityName,
          })
        }

        // Try to get all entities first to locate the correct one
        logger.debug("Trying to find entity by opening all nodes")
        const allEntities = await knowledgeGraphManager.openNodes([])

        let entity: Entity | TemporalEntityType | null = null

        if (allEntities?.entities && allEntities.entities.length > 0) {
          logger.debug("Found entities in total", {
            count: allEntities.entities.length,
          })

          // Try different methods to find the entity
          // 1. Direct match by name
          entity =
            allEntities.entities.find((e: Entity) => e.name === entityName) ??
            null

          // 2. If not found and input is UUID, try matching by ID
          if (!entity && isUUID) {
            entity =
              allEntities.entities.find(
                (e: Entity & { id?: string }) =>
                  // The id property might not be in the Entity interface, but could exist at runtime
                  "id" in e && e.id === entityName
              ) ?? null
            logger.debug("Searching by ID match for UUID", {
              uuid: entityName,
            })
          }

          // Log found entities to help debugging
          if (!entity) {
            logger.debug("Entity not found in list", {
              availableEntities: allEntities.entities.map(
                (e: { name: string; id?: string }) => ({
                  name: e.name,
                  id: e.id,
                })
              ),
            })
          }
        } else {
          logger.debug("No entities found in graph")
        }

        // If still not found, try explicit lookup by name
        if (!entity) {
          logger.debug(
            "Entity not found in list, trying explicit lookup by name"
          )
          const openedEntities = await knowledgeGraphManager.openNodes([
            entityName,
          ])

          if (openedEntities?.entities && openedEntities.entities.length > 0) {
            entity = openedEntities.entities[0] ?? null
            logger.debug("Found entity by name", {
              name: entity?.name,
              id: (entity as Entity & { id?: string }).id || "none",
            })
          }
        }

        // If still not found, check if we can query by ID through the storage provider
        const storageProvider = knowledgeGraphManager.getStorageProvider()
        if (
          !entity &&
          isUUID &&
          storageProvider &&
          storageProvider.getEntityById
        ) {
          try {
            logger.debug("Trying direct database lookup by ID", {
              entityId: entityName,
            })
            entity = await storageProvider.getEntityById(entityName)
            if (entity) {
              logger.debug("Found entity by direct ID lookup", {
                name: entity.name,
                id: (entity as Record<string, unknown>).id || "none",
              })
            }
          } catch (err) {
            logger.debug("Direct ID lookup failed", {
              error: err,
            })
          }
        }

        // Final check
        if (!entity) {
          logger.error("Entity not found after all lookup attempts", {
            entityName,
          })
          throw new Error(`Entity not found: ${entityName}`)
        }

        logger.debug("Successfully found entity", {
          name: entity.name,
          id: (entity as Entity & { id?: string }).id || "none",
        })

        // Check if embedding service and job manager are available
        const embeddingJobManager =
          knowledgeGraphManager.getEmbeddingJobManager()
        if (!embeddingJobManager) {
          logger.error("EmbeddingJobManager not initialized")
          throw new Error("EmbeddingJobManager not initialized")
        }

        logger.debug("EmbeddingJobManager found, proceeding")

        // Directly get the text for the entity
        // Cast to Entity since TemporalEntityType extends Entity and we've already null-checked
        const embeddingText = embeddingJobManager.prepareEntityText(
          entity as Entity
        )
        logger.debug("Prepared entity text for embedding", {
          textLength: embeddingText.length,
        })

        // Generate embedding directly
        const embeddingService = embeddingJobManager.getEmbeddingService()
        if (!embeddingService) {
          logger.error("Embedding service not available")
          throw new Error("Embedding service not available")
        }

        const vector = await embeddingService.generateEmbedding(embeddingText)
        logger.debug("Generated embedding vector", {
          vectorLength: vector.length,
        })

        // Store the embedding with both name and ID for redundancy
        // Validate entity.name is a string
        if (typeof entity.name !== "string") {
          throw new Error(
            `Entity name must be a string, got ${typeof entity.name}`
          )
        }

        logger.debug("Storing embedding for entity", {
          entityName: entity.name,
        })

        if (!storageProvider?.storeEntityVector) {
          throw new Error("Storage provider does not support vector operations")
        }

        await storageProvider.storeEntityVector(entity.name, vector)

        const entityId = (entity as Record<string, unknown>).id
        if (entityId && typeof entityId === "string") {
          logger.debug("Also storing embedding with entity ID", {
            entityId,
          })
          try {
            await storageProvider.storeEntityVector(entityId, vector)
          } catch (idStoreError) {
            logger.warn(
              "Failed to store embedding by ID, but name storage succeeded",
              {
                error: idStoreError,
              }
            )
          }
        }

        logger.debug("Successfully stored embedding", {
          entityName: entity.name,
        })

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  success: true,
                  entity: entity.name,
                  entity_id: (entity as Record<string, unknown>).id,
                  vector_length: vector.length,
                  model: embeddingService.getModelInfo().name,
                },
                null,
                2
              ),
            },
          ],
        }
      } catch (error: unknown) {
        const errorMessage =
          error instanceof Error ? error.message : String(error)
        const errorStack = error instanceof Error ? error.stack : undefined

        logger.error("Failed to force generate embedding", {
          error: errorMessage,
          stack: errorStack,
        })
        return {
          content: [
            {
              type: "text",
              text: `Failed to generate embedding: ${errorMessage}`,
            },
          ],
        }
      }
    }

    case "semantic_search":
      try {
        const query = validateString(args.query, "query")

        // Extract search options from args
        const searchOptions = {
          limit:
            typeof args.limit === "number" ? args.limit : DEFAULT_SEARCH_LIMIT,
          minSimilarity:
            typeof args.min_similarity === "number"
              ? args.min_similarity
              : DEFAULT_MIN_SIMILARITY,
          entityTypes: Array.isArray(args.entity_types)
            ? args.entity_types
            : [],
          hybridSearch:
            typeof args.hybrid_search === "boolean" ? args.hybrid_search : true,
          semanticWeight:
            typeof args.semantic_weight === "number"
              ? args.semantic_weight
              : DEFAULT_MIN_SIMILARITY,
          semanticSearch: true,
        }

        // Call the search method with semantic search options
        const results = await knowledgeGraphManager.search(query, searchOptions)

        return {
          content: [{ type: "text", text: JSON.stringify(results, null, 2) }],
        }
      } catch (error: unknown) {
        const errorMessage =
          error instanceof Error ? error.message : String(error)
        return {
          content: [
            {
              type: "text",
              text: `Error performing semantic search: ${errorMessage}`,
            },
          ],
        }
      }

    case "get_entity_embedding":
      try {
        const entityName = validateString(args.entity_name, "entity_name")

        // Check if entity exists
        const entity = await knowledgeGraphManager.openNodes([entityName])
        if (!entity.entities || entity.entities.length === 0) {
          return {
            content: [
              { type: "text", text: `Entity not found: ${entityName}` },
            ],
          }
        }

        // Access the embedding using appropriate interface
        const storageProvider = knowledgeGraphManager.getStorageProvider()
        if (storageProvider?.getEntityEmbedding) {
          const embedding = await storageProvider.getEntityEmbedding(entityName)

          if (!embedding) {
            return {
              content: [
                {
                  type: "text",
                  text: `No embedding found for entity: ${entityName}`,
                },
              ],
            }
          }

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  {
                    entityName,
                    embedding: embedding.vector,
                    model: embedding.model || "unknown",
                    dimensions: embedding.vector ? embedding.vector.length : 0,
                    lastUpdated: embedding.lastUpdated || Date.now(),
                  },
                  null,
                  2
                ),
              },
            ],
          }
        }
        return {
          content: [
            {
              type: "text",
              text: "Embedding retrieval not supported by this storage provider",
            },
          ],
        }
      } catch (error: unknown) {
        const errorMessage =
          error instanceof Error ? error.message : String(error)
        return {
          content: [
            {
              type: "text",
              text: `Error retrieving entity embedding: ${errorMessage}`,
            },
          ],
        }
      }

    case "debug_embedding_config":
      // Diagnostic tool to check embedding configuration
      try {
        // Check for OpenAI API key
        const hasOpenAIKey = !!process.env.DFM_OPENAI_API_KEY
        const embeddingModel =
          process.env.DFM_OPENAI_EMBEDDING_MODEL || "text-embedding-3-small"

        // Check if embedding job manager is initialized
        const embeddingJobManager =
          knowledgeGraphManager.getEmbeddingJobManager()
        const hasEmbeddingJobManager = !!embeddingJobManager

        // Get storage provider info
        const storageType = process.env.MEMORY_STORAGE_TYPE || "neo4j"
        const storageProvider = knowledgeGraphManager.getStorageProvider()

        // Get Neo4j specific configuration
        const neo4jInfo: {
          uri: string
          username: string
          database: string
          vectorIndex: string
          vectorDimensions: string
          similarityFunction: string
          connectionStatus: string
          vectorStoreStatus?: string
        } = {
          uri: process.env.NEO4J_URI || "default",
          username: process.env.NEO4J_USERNAME
            ? "configured"
            : "not configured",
          database: process.env.NEO4J_DATABASE || "neo4j",
          vectorIndex: process.env.NEO4J_VECTOR_INDEX || "entity_embeddings",
          vectorDimensions:
            process.env.NEO4J_VECTOR_DIMENSIONS ||
            String(DEFAULT_VECTOR_DIMENSIONS),
          similarityFunction: process.env.NEO4J_SIMILARITY_FUNCTION || "cosine",
          connectionStatus: "unknown",
        }

        // Check if Neo4j connection manager is available
        if (
          storageProvider &&
          typeof storageProvider.getConnectionManager === "function"
        ) {
          try {
            const connectionManager = storageProvider.getConnectionManager()
            if (connectionManager) {
              neo4jInfo.connectionStatus = "available"

              // Note: vector store status is implementation-specific
              // We can't check it directly through the interface
              neo4jInfo.vectorStoreStatus = "implementation-specific"
            }
          } catch (error: unknown) {
            const errorMessage =
              error instanceof Error ? error.message : String(error)
            neo4jInfo.connectionStatus = `error: ${errorMessage}`
          }
        }

        // Count entities with embeddings via Neo4j vector store
        let entitiesWithEmbeddings = 0
        if (storageProvider?.countEntitiesWithEmbeddings) {
          try {
            entitiesWithEmbeddings =
              await storageProvider.countEntitiesWithEmbeddings()
          } catch (error) {
            logger.error("Error checking embeddings count", {
              error,
            })
          }
        }

        // Get embedding service information
        let embeddingServiceInfo: Record<string, unknown> | null = null
        if (hasEmbeddingJobManager && embeddingJobManager) {
          try {
            const embeddingService = embeddingJobManager.getEmbeddingService()
            if (embeddingService) {
              embeddingServiceInfo =
                embeddingService.getModelInfo() as unknown as Record<
                  string,
                  unknown
                >
            }
          } catch (error: unknown) {
            const errorMessage =
              error instanceof Error ? error.message : String(error)
            logger.error("Error getting embedding service info", {
              error: errorMessage,
            })
          }
        }

        // Note: Embedding provider info is accessed through job manager
        // StorageProvider doesn't expose embedding service directly
        const embeddingProviderInfo = embeddingServiceInfo

        // Check pending embedding jobs if available
        // Note: EmbeddingJobManager doesn't expose getPendingJobs publicly
        // This would need to be added if needed for diagnostics
        const pendingJobs = 0 // Not available through public API

        // Return diagnostic information with proper formatting
        const diagnosticInfo = {
          storage_type: storageType,
          openai_api_key_present: hasOpenAIKey,
          embedding_model: embeddingModel,
          embedding_job_manager_initialized: hasEmbeddingJobManager,
          embedding_service_initialized: !!embeddingProviderInfo,
          embedding_service_info: embeddingServiceInfo,
          embedding_provider_info: embeddingProviderInfo,
          neo4j_config: neo4jInfo,
          entities_with_embeddings: entitiesWithEmbeddings,
          pending_embedding_jobs: pendingJobs,
          environment_variables: {
            DEBUG: process.env.DEBUG === "true",
            NODE_ENV: process.env.NODE_ENV,
            MEMORY_STORAGE_TYPE: process.env.MEMORY_STORAGE_TYPE || "neo4j",
          },
        }

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(diagnosticInfo, null, 2),
            },
          ],
        }
      } catch (error: unknown) {
        const errorMessage =
          error instanceof Error ? error.message : String(error)
        const errorStack = error instanceof Error ? error.stack : undefined
        logger.error("Error in debug_embedding_config", {
          error: errorMessage,
        })
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  error: errorMessage,
                  stack: errorStack,
                },
                null,
                2
              ),
            },
          ],
        }
      }

    case "diagnose_vector_search": {
      const storageProvider = knowledgeGraphManager.getStorageProvider()
      if (storageProvider?.diagnoseVectorSearch) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                await storageProvider.diagnoseVectorSearch(),
                null,
                2
              ),
            },
          ],
        }
      }
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                error: "Diagnostic method not available",
                storageType: storageProvider
                  ? storageProvider.constructor.name
                  : "unknown",
              },
              null,
              2
            ),
          },
        ],
      }
    }

    default:
      throw new Error(`Unknown tool: ${name}`)
  }
}
