/**
 * Tool Handlers for MCP Protocol
 *
 * This module contains all the handler functions for MCP tools.
 * Each handler is a simple wrapper around KnowledgeGraphManager methods.
 */

import { type } from "arktype"
import type { KnowledgeGraphManager } from "#knowledge-graph-manager"
import { Entity, EntityValidator, Relation, RelationValidator } from "#types"
import type { Logger } from "#types"

/**
 * Arktype schemas for runtime validation of tool arguments
 */
const ObservationInputSchema = type({
  entityName: "string",
  "contents": "string[]",
})

const AddObservationsArgsSchema = type({
  "observations": ObservationInputSchema.array(),
})

const CreateEntitiesArgsSchema = type({
  "entities": "unknown[]",
})

const CreateRelationsArgsSchema = type({
  "relations": "unknown[]",
})

const DeleteEntitiesArgsSchema = type({
  "entityNames": "string[]",
})

/**
 * Handles the create_entities tool request
 */
export async function handleCreateEntities(
  args: unknown,
  knowledgeGraphManager: KnowledgeGraphManager
): Promise<{ content: Array<{ type: string; text: string }> }> {
  const validated = CreateEntitiesArgsSchema(args)
  if (validated instanceof type.errors) {
    throw new Error(`Invalid arguments for create_entities: ${validated}`)
  }

  // Validate each entity using ArkType Entity schema
  const entities: typeof Entity.infer[] = []
  for (const rawEntity of validated.entities) {
    const entityResult = Entity(rawEntity)
    if (entityResult instanceof type.errors) {
      throw new Error(`Invalid entity: ${entityResult}`)
    }
    entities.push(entityResult)
  }

  const result = await knowledgeGraphManager.createEntities(entities)
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(result, null, 2),
      },
    ],
  }
}

/**
 * Handles the create_relations tool request
 */
export async function handleCreateRelations(
  args: unknown,
  knowledgeGraphManager: KnowledgeGraphManager
): Promise<{ content: Array<{ type: string; text: string }> }> {
  const validated = CreateRelationsArgsSchema(args)
  if (validated instanceof type.errors) {
    throw new Error(`Invalid arguments for create_relations: ${validated}`)
  }

  // Validate each relation using ArkType Relation schema
  const relations: typeof Relation.infer[] = []
  for (const rawRelation of validated.relations) {
    const relationResult = Relation(rawRelation)
    if (relationResult instanceof type.errors) {
      throw new Error(`Invalid relation: ${relationResult}`)
    }
    relations.push(relationResult)
  }

  const result = await knowledgeGraphManager.createRelations(relations)
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(result, null, 2),
      },
    ],
  }
}

/**
 * Handles the delete_entities tool request
 */
export async function handleDeleteEntities(
  args: unknown,
  knowledgeGraphManager: KnowledgeGraphManager
): Promise<{ content: Array<{ type: string; text: string }> }> {
  const validated = DeleteEntitiesArgsSchema(args)
  if (validated instanceof type.errors) {
    throw new Error(`Invalid arguments for delete_entities: ${validated}`)
  }

  await knowledgeGraphManager.deleteEntities(validated.entityNames)
  return {
    content: [
      {
        type: "text",
        text: "Entities deleted successfully",
      },
    ],
  }
}

/**
 * Handles the read_graph tool request
 */
export async function handleReadGraph(
  _args: Record<string, unknown>,
  knowledgeGraphManager: KnowledgeGraphManager
): Promise<{ content: Array<{ type: string; text: string }> }> {
  const result = await knowledgeGraphManager.readGraph()
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(result, null, 2),
      },
    ],
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
  logger: Logger
): Promise<{ content: Array<{ type: string; text: string }> }> {
  try {
    // Validate arguments with arktype - provides both runtime safety and type narrowing
    const validated = AddObservationsArgsSchema(args)
    if (validated instanceof type.errors) {
      throw new Error(`Invalid arguments for add_observations: ${validated}`)
    }

    // Enhanced logging for debugging
    logger.debug("addObservations handler called", {
      timestamp: new Date().toISOString(),
      observationCount: validated.observations.length,
    })

    // Call knowledgeGraphManager - validated.observations is properly typed
    const result = await knowledgeGraphManager.addObservations(validated.observations)

    logger.debug("addObservations completed successfully", {
      resultCount: result.length,
    })

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              success: true,
              result,
              summary: {
                observationsProcessed: validated.observations.length,
                entitiesAffected: result.length,
              },
            },
            null,
            2
          ),
        },
      ],
    }
  } catch (error) {
    // Proper error type narrowing
    let errorMessage = "Unknown error"
    let errorStack: string | undefined

    if (error instanceof Error) {
      errorMessage = error.message
      errorStack = error.stack
    } else if (typeof error === "string") {
      errorMessage = error
    }

    // Enhanced error logging for debugging
    logger.error("addObservations error", {
      error: errorMessage,
      stack: errorStack || "No stack trace available",
    })

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              success: false,
              error: errorMessage,
              timestamp: Date.now(),
            },
            null,
            2
          ),
        },
      ],
    }
  }
}
