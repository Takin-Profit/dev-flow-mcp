/**
 * Entity Types with ArkType Runtime Validation
 *
 * This module defines entity types using ArkType for automatic runtime validation.
 * All types have both compile-time TypeScript types and runtime validation.
 *
 * ## Validation Rules
 *
 * ### Entity Name
 * - See shared.ts for EntityName validation rules
 *
 * ### Entity Type
 * - Must be one of: "feature", "task", "decision", "component"
 * - These represent the semantic category of the entity
 * - Examples:
 *   - "feature": A product feature or capability
 *   - "task": A work item or action item
 *   - "decision": An architectural or design decision
 *   - "component": A code component, module, or service
 *
 * ### Observations
 * - Must be an array of non-empty strings (see shared.ts for Observation rules)
 * - Each observation is a fact or note about the entity
 * - Observations are atomic pieces of information
 * - No nested structures allowed
 *
 * ### Embedding (optional)
 * - vector: Array of numbers representing the semantic embedding
 * - model: String identifier of the embedding model used
 * - lastUpdated: Unix timestamp (milliseconds) when embedding was generated
 */

import { type } from "arktype"
import { EntityName, Observation } from "#types/shared"

/**
 * Maximum vector dimensions supported by the system
 * Common embedding models use: 384 (MiniLM), 768 (BERT), 1536 (OpenAI)
 */
const MAX_VECTOR_DIMENSIONS = 10_000

/**
 * Entity embedding for semantic search
 */
export const EntityEmbedding = type({
  vector: "number[]",
  model: "string",
  lastUpdated: "number.integer >= 0",
}).narrow((embedding, ctx) => {
  // Validate vector has reasonable dimensions (typically 384, 768, 1536, etc.)
  if (embedding.vector.length === 0) {
    return ctx.reject({
      expected: "a non-empty vector",
      actual: "an empty array",
      path: ["vector"],
    })
  }
  if (embedding.vector.length > MAX_VECTOR_DIMENSIONS) {
    return ctx.reject({
      expected: `a vector with at most ${MAX_VECTOR_DIMENSIONS} dimensions`,
      actual: `${embedding.vector.length} dimensions`,
      path: ["vector"],
    })
  }
  // Ensure all vector values are finite numbers
  for (let i = 0; i < embedding.vector.length; i++) {
    const value = embedding.vector[i]
    if (!Number.isFinite(value)) {
      return ctx.reject({
        expected: "all vector values to be finite numbers",
        actual: `found ${value} at index ${i}`,
        path: ["vector", i],
      })
    }
  }
  return true
})

export type EntityEmbedding = typeof EntityEmbedding.infer

/**
 * Entity in the knowledge graph
 */
export const Entity = type({
  name: EntityName,
  entityType: "'feature' | 'task' | 'decision' | 'component'",
  observations: Observation.array(),
  "embedding?": EntityEmbedding,
})

export type Entity = typeof Entity.infer

/**
 * EntityValidator provides validation methods with ArkType
 * Uses frozen object pattern for stateless validation functions
 */
export const EntityValidator = Object.freeze({
  /**
   * Validates if data conforms to the Entity schema
   * Returns the validated data or an ArkErrors instance
   */
  validate(data: unknown) {
    return Entity(data)
  },

  /**
   * Type guard: validates if data is an Entity
   */
  isEntity(data: unknown): data is Entity {
    const result = Entity(data)
    return !(result instanceof type.errors)
  },

  /**
   * Checks if an entity has a valid embedding
   */
  hasEmbedding(data: unknown): data is Entity & { embedding: EntityEmbedding } {
    if (!EntityValidator.isEntity(data)) {
      return false
    }
    return data.embedding !== undefined
  },

  /**
   * Validates an entity name according to system rules
   */
  isValidEntityName(name: unknown): name is string {
    const result = EntityName(name)
    return !(result instanceof type.errors)
  },

  /**
   * Validates an observation string
   */
  isValidObservation(obs: unknown): obs is string {
    const result = Observation(obs)
    return !(result instanceof type.errors)
  },
})
