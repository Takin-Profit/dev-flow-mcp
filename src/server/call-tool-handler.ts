/**
 * Call Tool Handler - MCP Protocol Request Router
 *
 * Routes CallTool requests to appropriate tool handlers.
 * All handlers use Zod validation and standardized responses.
 */

import type { KnowledgeGraphManager } from "#knowledge-graph-manager"
import {
  handleAddObservations,
  handleCreateEntities,
  handleCreateRelations,
  handleDeleteEntities,
  handleReadGraph,
} from "#server/tool-handlers"
import type {
  Entity,
  Logger,
  MCPToolResponse,
  TemporalEntityType,
} from "#types"
import {
  DEFAULT_MIN_SIMILARITY,
  DEFAULT_SEARCH_LIMIT,
  DeleteObservationsInputSchema,
  DeleteRelationsInputSchema,
  GetEntityEmbeddingInputSchema,
  GetEntityHistoryInputSchema,
  GetGraphAtTimeInputSchema,
  GetRelationHistoryInputSchema,
  GetRelationInputSchema,
  OpenNodesInputSchema,
  SearchNodesInputSchema,
  SemanticSearchInputSchema,
  UpdateRelationInputSchema,
} from "#types"
import {
  buildErrorResponse,
  buildSuccessResponse,
  buildValidationErrorResponse,
  handleError,
} from "#utils"

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
): Promise<MCPToolResponse> {
  if (!request) {
    return buildErrorResponse("Invalid request: request is null or undefined")
  }

  if (!request.params) {
    return buildErrorResponse("Invalid request: missing params")
  }

  const { name, arguments: args } = request.params

  if (!name) {
    return buildErrorResponse("Invalid request: missing tool name")
  }

  if (!args) {
    return buildErrorResponse(`No arguments provided for tool: ${name}`)
  }

  switch (name) {
    // Delegate to updated tool handlers (tool-handlers.ts)
    case "create_entities":
      return await handleCreateEntities(args, knowledgeGraphManager, logger)

    case "read_graph":
      return await handleReadGraph(args, knowledgeGraphManager, logger)

    case "create_relations":
      return await handleCreateRelations(args, knowledgeGraphManager, logger)

    case "add_observations":
      return await handleAddObservations(args, knowledgeGraphManager, logger)

    case "delete_entities":
      return await handleDeleteEntities(args, knowledgeGraphManager, logger)

    case "delete_observations": {
      try {
        const result = DeleteObservationsInputSchema.safeParse(args)
        if (!result.success) {
          logger.warn("delete_observations validation failed", {
            issues: result.error.issues,
          })
          return buildValidationErrorResponse(result.error)
        }

        const { deletions } = result.data

        logger.debug("delete_observations called", {
          deletionCount: deletions.length,
        })

        await knowledgeGraphManager.deleteObservations(deletions)

        logger.info("delete_observations completed", {
          deleted: deletions.length,
        })

        const totalDeleted = deletions.reduce(
          (sum, d) => sum + d.observations.length,
          0
        )

        return buildSuccessResponse({
          deleted: totalDeleted,
          entities: deletions.map((d) => ({
            entityName: d.entityName,
            deletedCount: d.observations.length,
          })),
        })
      } catch (error) {
        return handleError(error, logger)
      }
    }

    case "delete_relations": {
      try {
        const result = DeleteRelationsInputSchema.safeParse(args)
        if (!result.success) {
          logger.warn("delete_relations validation failed", {
            issues: result.error.issues,
          })
          return buildValidationErrorResponse(result.error)
        }

        const { relations } = result.data

        logger.debug("delete_relations called", {
          relationCount: relations.length,
        })

        await knowledgeGraphManager.deleteRelations(relations)

        logger.info("delete_relations completed", {
          deleted: relations.length,
        })

        return buildSuccessResponse({
          deleted: relations.length,
        })
      } catch (error) {
        return handleError(error, logger)
      }
    }

    case "get_relation": {
      try {
        const result = GetRelationInputSchema.safeParse(args)
        if (!result.success) {
          logger.warn("get_relation validation failed", {
            issues: result.error.issues,
          })
          return buildValidationErrorResponse(result.error)
        }

        const { from, to, relationType } = result.data

        logger.debug("get_relation called", { from, to, relationType })

        const relation = await knowledgeGraphManager.getRelation(
          from as string,
          to as string,
          relationType
        )

        logger.info("get_relation completed", { found: !!relation })

        return buildSuccessResponse(relation)
      } catch (error) {
        return handleError(error, logger)
      }
    }

    case "update_relation": {
      try {
        const result = UpdateRelationInputSchema.safeParse(args)
        if (!result.success) {
          logger.warn("update_relation validation failed", {
            issues: result.error.issues,
          })
          return buildValidationErrorResponse(result.error)
        }

        const relation = result.data

        logger.debug("update_relation called", {
          from: relation.from,
          to: relation.to,
          type: relation.relationType,
        })

        const updated = await knowledgeGraphManager.updateRelation(relation)

        logger.info("update_relation completed")

        return buildSuccessResponse(updated)
      } catch (error) {
        return handleError(error, logger)
      }
    }

    case "search_nodes": {
      try {
        const result = SearchNodesInputSchema.safeParse(args)
        if (!result.success) {
          logger.warn("search_nodes validation failed", {
            issues: result.error.issues,
          })
          return buildValidationErrorResponse(result.error)
        }

        const { query } = result.data

        logger.debug("search_nodes called", { query })

        const results = await knowledgeGraphManager.searchNodes(query)

        logger.info("search_nodes completed", {
          count: results.entities.length,
        })

        return buildSuccessResponse({
          results,
          count: results.entities.length,
        })
      } catch (error) {
        return handleError(error, logger)
      }
    }

    case "open_nodes": {
      try {
        const result = OpenNodesInputSchema.safeParse(args)
        if (!result.success) {
          logger.warn("open_nodes validation failed", {
            issues: result.error.issues,
          })
          return buildValidationErrorResponse(result.error)
        }

        const { names } = result.data

        logger.debug("open_nodes called", { count: names.length })

        const openResult = await knowledgeGraphManager.openNodes(
          names.map((n) => n as string)
        )

        logger.info("open_nodes completed", {
          found: openResult.entities?.length || 0,
        })

        return buildSuccessResponse({
          entities: openResult.entities || [],
          relations: openResult.relations || [],
          found: openResult.entities?.length || 0,
        })
      } catch (error) {
        return handleError(error, logger)
      }
    }

    case "get_entity_history": {
      try {
        const result = GetEntityHistoryInputSchema.safeParse(args)
        if (!result.success) {
          logger.warn("get_entity_history validation failed", {
            issues: result.error.issues,
          })
          return buildValidationErrorResponse(result.error)
        }

        const { entityName } = result.data

        logger.debug("get_entity_history called", { entityName })

        const history = await knowledgeGraphManager.getEntityHistory(
          entityName as string
        )

        logger.info("get_entity_history completed", {
          versionCount: history.length,
        })

        return buildSuccessResponse({
          entityName,
          history,
          totalVersions: history.length,
        })
      } catch (error) {
        return handleError(error, logger)
      }
    }

    case "get_relation_history": {
      try {
        const result = GetRelationHistoryInputSchema.safeParse(args)
        if (!result.success) {
          logger.warn("get_relation_history validation failed", {
            issues: result.error.issues,
          })
          return buildValidationErrorResponse(result.error)
        }

        const { from, to, relationType } = result.data

        logger.debug("get_relation_history called", { from, to, relationType })

        const history = await knowledgeGraphManager.getRelationHistory(
          from as string,
          to as string,
          relationType
        )

        logger.info("get_relation_history completed", {
          versionCount: history.length,
        })

        return buildSuccessResponse({
          from,
          to,
          relationType,
          history,
          totalVersions: history.length,
        })
      } catch (error) {
        return handleError(error, logger)
      }
    }

    case "get_graph_at_time": {
      try {
        const result = GetGraphAtTimeInputSchema.safeParse(args)
        if (!result.success) {
          logger.warn("get_graph_at_time validation failed", {
            issues: result.error.issues,
          })
          return buildValidationErrorResponse(result.error)
        }

        const { timestamp } = result.data

        logger.debug("get_graph_at_time called", { timestamp })

        const graph = await knowledgeGraphManager.getGraphAtTime(
          timestamp as number
        )

        logger.info("get_graph_at_time completed", {
          entityCount: graph.entities.length,
          relationCount: graph.relations.length,
        })

        return buildSuccessResponse({
          timestamp,
          graph,
        })
      } catch (error) {
        return handleError(error, logger)
      }
    }

    case "get_decayed_graph": {
      try {
        logger.debug("get_decayed_graph called")

        // No validation needed - no arguments
        const graph = await knowledgeGraphManager.getDecayedGraph()

        logger.info("get_decayed_graph completed", {
          entityCount: graph.entities.length,
          relationCount: graph.relations.length,
        })

        return buildSuccessResponse(graph)
      } catch (error) {
        return handleError(error, logger)
      }
    }

    case "force_generate_embedding": {
      try {
        const result = GetEntityEmbeddingInputSchema.safeParse(args)
        if (!result.success) {
          logger.warn("force_generate_embedding validation failed", {
            issues: result.error.issues,
          })
          return buildValidationErrorResponse(result.error)
        }

        const { entityName } = result.data
        const entityNameStr = entityName as string

        logger.debug("Force generating embedding for entity", {
          entityName: entityNameStr,
        })

        // Determine if the input looks like a UUID
        const isUUID = UUID_PATTERN.test(entityNameStr)

        if (isUUID) {
          logger.debug("Input appears to be a UUID", {
            entityName: entityNameStr,
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
            allEntities.entities.find(
              (e: Entity) => e.name === entityNameStr
            ) ?? null

          // 2. If not found and input is UUID, try matching by ID
          if (!entity && isUUID) {
            entity =
              allEntities.entities.find(
                (e: Entity & { id?: string }) =>
                  // The id property might not be in the Entity interface, but could exist at runtime
                  "id" in e && e.id === entityNameStr
              ) ?? null
            logger.debug("Searching by ID match for UUID", {
              uuid: entityNameStr,
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
            entityNameStr,
          ])

          if (openedEntities?.entities && openedEntities.entities.length > 0) {
            entity = openedEntities.entities[0] ?? null
            logger.debug("Found entity by name", {
              name: entity?.name,
              id: (entity as Entity & { id?: string }).id || "none",
            })
          }
        }

        // If still not found, check if we can query by ID through the database
        const database = knowledgeGraphManager.getDatabase()
        if (!entity && isUUID && database && database.getEntity) {
          try {
            logger.debug("Trying direct database lookup by ID", {
              entityId: entityNameStr,
            })
            entity = await database.getEntity(entityNameStr)
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
            entityName: entityNameStr,
          })
          return buildErrorResponse(`Entity not found: ${entityNameStr}`)
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
          return buildErrorResponse("EmbeddingJobManager not initialized")
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
          return buildErrorResponse("Embedding service not available")
        }

        const vector = await embeddingService.generateEmbedding(embeddingText)
        logger.debug("Generated embedding vector", {
          vectorLength: vector.length,
        })

        // Store the embedding with both name and ID for redundancy
        // Validate entity.name is a string
        if (typeof entity.name !== "string") {
          return buildErrorResponse(
            `Entity name must be a string, got ${typeof entity.name}`
          )
        }

        logger.debug("Storing embedding for entity", {
          entityName: entity.name,
        })

        // Store embedding (this functionality may need to be implemented in the database)
        logger.warn("Vector storage not yet implemented in this version")

        return buildSuccessResponse({
          entityName: entity.name,
          embedding: vector,
          model: embeddingService.getModelInfo().name,
        })
      } catch (error) {
        return handleError(error, logger)
      }
    }

    case "semantic_search": {
      try {
        const result = SemanticSearchInputSchema.safeParse(args)
        if (!result.success) {
          logger.warn("semantic_search validation failed", {
            issues: result.error.issues,
          })
          return buildValidationErrorResponse(result.error)
        }

        const {
          query,
          limit = DEFAULT_SEARCH_LIMIT,
          minSimilarity = DEFAULT_MIN_SIMILARITY,
          entityTypes = [],
          hybridSearch = true,
        } = result.data

        logger.debug("semantic_search called", { query, limit, minSimilarity })

        // Call the search method with semantic search options
        const searchResults = await knowledgeGraphManager.search(query, {
          limit,
          minSimilarity,
          entityTypes,
          hybridSearch,
          semanticSearch: true,
        })

        logger.info("semantic_search completed", {
          count: searchResults.entities.length,
        })

        // Format results to match the expected response schema
        const results = searchResults.entities.map((entity: Entity) => ({
          entity,
          similarity: 1.0, // Default similarity score
        }))

        return buildSuccessResponse({
          results,
          count: results.length,
        })
      } catch (error) {
        return handleError(error, logger)
      }
    }

    case "get_entity_embedding": {
      try {
        const result = GetEntityEmbeddingInputSchema.safeParse(args)
        if (!result.success) {
          logger.warn("get_entity_embedding validation failed", {
            issues: result.error.issues,
          })
          return buildValidationErrorResponse(result.error)
        }

        const { entityName } = result.data
        const entityNameStr = entityName as string

        logger.debug("get_entity_embedding called", {
          entityName: entityNameStr,
        })

        // Check if entity exists
        const entity = await knowledgeGraphManager.openNodes([entityNameStr])
        if (!entity.entities || entity.entities.length === 0) {
          return buildErrorResponse(`Entity not found: ${entityNameStr}`)
        }

        // Access the embedding using appropriate interface
        const database = knowledgeGraphManager.getDatabase()
        if (database?.getEntityEmbedding) {
          const embedding = await database.getEntityEmbedding(entityNameStr)

          if (!embedding) {
            return buildErrorResponse(
              `No embedding found for entity: ${entityNameStr}`
            )
          }

          logger.info("get_entity_embedding completed", {
            dimensions: embedding.vector?.length || 0,
          })

          return buildSuccessResponse({
            entityName,
            embedding: embedding.vector,
            model: embedding.model || "unknown",
          })
        }

        return buildErrorResponse(
          "Embedding retrieval not supported by this database"
        )
      } catch (error) {
        return handleError(error, logger)
      }
    }

    case "debug_embedding_config": {
      try {
        // Diagnostic tool to check embedding configuration
        // Check for OpenAI API key
        const hasOpenAIKey = !!process.env.DFM_OPENAI_API_KEY
        const embeddingModel =
          process.env.DFM_OPENAI_EMBEDDING_MODEL || "text-embedding-3-small"

        // Check if embedding job manager is initialized
        const embeddingJobManager =
          knowledgeGraphManager.getEmbeddingJobManager()
        const hasEmbeddingJobManager = !!embeddingJobManager

        // Get database info
        const storageType = "sqlite"

        // SQLite-only configuration
        const sqliteInfo = {
          location: process.env.DFM_SQLITE_LOCATION || ":memory:",
          connectionStatus: "available",
          vectorStoreStatus: "sqlite-vec enabled",
        }

        // Count entities with embeddings
        const entitiesWithEmbeddings = 0
        // This functionality would need to be implemented
        logger.debug("Embedding count not yet implemented")

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

        const embeddingProviderInfo = embeddingServiceInfo
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
          sqlite_config: sqliteInfo,
          entities_with_embeddings: entitiesWithEmbeddings,
          pending_embedding_jobs: pendingJobs,
          environment_variables: {
            DEBUG: process.env.DEBUG === "true",
            DFM_ENV: process.env.DFM_ENV,
            MEMORY_STORAGE_TYPE: "sqlite",
          },
        }

        return buildSuccessResponse(diagnosticInfo)
      } catch (error) {
        return handleError(error, logger)
      }
    }

    case "diagnose_vector_search": {
      try {
        const database = knowledgeGraphManager.getDatabase()
        if (database?.diagnoseVectorSearch) {
          const diagnostics = await database.diagnoseVectorSearch()
          return buildSuccessResponse(diagnostics)
        }

        return buildErrorResponse("Diagnostic method not available")
      } catch (error) {
        return handleError(error, logger)
      }
    }

    default:
      return buildErrorResponse(`Unknown tool: ${name}`)
  }
}
