/**
 * Tool Handlers for MCP Protocol
 *
 * This module contains all the handler functions for MCP tools.
 * Each handler validates inputs with Zod and returns standardized MCP responses.
 */

import type { KnowledgeGraphManager } from "#knowledge-graph-manager"
import type { Logger, MCPToolResponse } from "#types"
import {
  AddObservationsInputSchema,
  CreateEntitiesInputSchema,
  CreateRelationsInputSchema,
  DeleteEntitiesInputSchema,
} from "#types/validation"
import {
  buildErrorResponse,
  buildSuccessResponse,
  buildValidationErrorResponse,
  handleError,
} from "#utils/response-builders"

/**
 * Handles the create_entities tool request
 */
export async function handleCreateEntities(
  args: unknown,
  knowledgeGraphManager: KnowledgeGraphManager,
  logger?: Logger
): Promise<MCPToolResponse> {
  try {
    // 1. Validate input with Zod
    const result = CreateEntitiesInputSchema.safeParse(args)
    if (!result.success) {
      logger?.warn("create_entities validation failed", {
        issues: result.error.issues,
      })
      return buildValidationErrorResponse(result.error)
    }

    const { entities } = result.data

    logger?.debug("create_entities called", {
      entityCount: entities.length,
    })

    // 2. Perform operation
    const created = await knowledgeGraphManager.createEntities(entities)

    logger?.info("create_entities completed", {
      created: created.length,
    })

    // 3. Build response (simplified!)
    return buildSuccessResponse({
      created: created.length,
      entities: created,
    })
  } catch (error) {
    return handleError(error, logger)
  }
}

/**
 * Handles the create_relations tool request
 */
export async function handleCreateRelations(
  args: unknown,
  knowledgeGraphManager: KnowledgeGraphManager,
  logger?: Logger
): Promise<MCPToolResponse> {
  try {
    // 1. Validate input with Zod
    const result = CreateRelationsInputSchema.safeParse(args)
    if (!result.success) {
      logger?.warn("create_relations validation failed", {
        issues: result.error.issues,
      })
      return buildValidationErrorResponse(result.error)
    }

    const { relations } = result.data

    logger?.debug("create_relations called", {
      relationCount: relations.length,
    })

    // 2. Perform operation
    const created = await knowledgeGraphManager.createRelations(relations)

    logger?.info("create_relations completed", {
      created: created.length,
    })

    // 3. Build response (simplified!)
    return buildSuccessResponse({
      created: created.length,
      relations: created,
    })
  } catch (error) {
    return handleError(error, logger)
  }
}

/**
 * Handles the delete_entities tool request
 */
export async function handleDeleteEntities(
  args: unknown,
  knowledgeGraphManager: KnowledgeGraphManager,
  logger?: Logger
): Promise<MCPToolResponse> {
  try {
    // 1. Validate input with Zod
    const result = DeleteEntitiesInputSchema.safeParse(args)
    if (!result.success) {
      logger?.warn("delete_entities validation failed", {
        issues: result.error.issues,
      })
      return buildValidationErrorResponse(result.error)
    }

    const { entityNames } = result.data

    logger?.debug("delete_entities called", {
      entityCount: entityNames.length,
    })

    // 2. Perform operation
    await knowledgeGraphManager.deleteEntities(
      entityNames.map((name) => name as string)
    )

    logger?.info("delete_entities completed", {
      deleted: entityNames.length,
    })

    // 3. Build response (simplified!)
    return buildSuccessResponse({
      deleted: entityNames.length,
      entityNames,
    })
  } catch (error) {
    return handleError(error, logger)
  }
}

/**
 * Handles the read_graph tool request
 */
export async function handleReadGraph(
  _args: unknown,
  knowledgeGraphManager: KnowledgeGraphManager,
  logger?: Logger
): Promise<MCPToolResponse> {
  try {
    logger?.debug("read_graph called")

    // No validation needed - read_graph takes no arguments
    const graph = await knowledgeGraphManager.readGraph()

    logger?.info("read_graph completed", {
      entityCount: graph.entities.length,
      relationCount: graph.relations.length,
    })

    // Build response (simplified!)
    return buildSuccessResponse(graph)
  } catch (error) {
    return handleError(error, logger)
  }
}

/**
 * Handles the add_observations tool request
 *
 * Note: Observations only support entityName and contents fields.
 * Strength, confidence, and metadata are NOT supported on observations.
 * Use relations for those features.
 */
export async function handleAddObservations(
  args: unknown,
  knowledgeGraphManager: KnowledgeGraphManager,
  logger?: Logger
): Promise<MCPToolResponse> {
  try {
    // 1. Validate input with Zod
    const result = AddObservationsInputSchema.safeParse(args)
    if (!result.success) {
      logger?.warn("add_observations validation failed", {
        issues: result.error.issues,
      })
      return buildValidationErrorResponse(result.error)
    }

    const { entityName, contents } = result.data

    logger?.debug("add_observations called", {
      entityName,
      observationCount: contents.length,
    })

    // 2. Perform operation
    const results = await knowledgeGraphManager.addObservations([
      { entityName, contents },
    ])

    logger?.info("add_observations completed", {
      entitiesAffected: results.length,
    })

    // 3. Build response
    const firstResult = results[0]
    if (!firstResult) {
      return buildErrorResponse("Failed to add observations")
    }

    return buildSuccessResponse({
      entityName: firstResult.entityName,
      addedObservations: firstResult.addedObservations,
      count: firstResult.addedObservations.length,
    })
  } catch (error) {
    return handleError(error, logger)
  }
}
