/**
 * Relation Types with ArkType Runtime Validation
 *
 * This module defines relation types using ArkType for automatic runtime validation.
 * All types have both compile-time TypeScript types and runtime validation.
 *
 * ## Validation Rules
 *
 * ### Entity Names (from/to fields)
 * - See shared.ts for EntityName validation rules
 *
 * ### Relation Type
 * - Must be one of: "implements", "depends_on", "relates_to", "part_of"
 * - These are the only valid relationship types in the system
 *
 * ### Strength (optional)
 * - Must be a number between 0.0 and 1.0 (inclusive)
 * - Represents the intensity/importance of the relationship
 * - Higher values = stronger relationships
 * - Example: 0.95 = very strong, 0.3 = weak
 *
 * ### Confidence (optional)
 * - Must be a number between 0.0 and 1.0 (inclusive)
 * - Represents certainty about the relationship's existence
 * - Useful for inferred or machine-generated relations
 * - Example: 1.0 = certain, 0.6 = moderately confident
 *
 * ### Metadata (optional)
 * - inferredFrom: Array of relation IDs that this relation was derived from
 * - lastAccessed: Unix timestamp (milliseconds) of last access
 * - createdAt: Unix timestamp (milliseconds) when relation was created
 * - updatedAt: Unix timestamp (milliseconds) of last update
 */

import { type } from "arktype"
import { EntityName } from "#types/shared"

/**
 * RelationMetadata with runtime validation
 * Provides additional context and information about relations
 */
export const RelationMetadata = type({
  "inferredFrom?": "string[]",
  "lastAccessed?": "number.integer >= 0",
  createdAt: "number.integer >= 0",
  updatedAt: "number.integer >= 0",
}).narrow((metadata, ctx) => {
  // Ensure updatedAt >= createdAt
  if (metadata.updatedAt < metadata.createdAt) {
    return ctx.reject({
      expected: "updatedAt >= createdAt",
      actual: `updatedAt(${metadata.updatedAt}) < createdAt(${metadata.createdAt})`,
      path: ["updatedAt"],
    })
  }
  return true
})

export type RelationMetadata = typeof RelationMetadata.infer

/**
 * Relation with runtime validation
 * Represents a relationship between two entities in the knowledge graph
 */
export const Relation = type({
  from: EntityName,
  to: EntityName,
  relationType: "'implements' | 'depends_on' | 'relates_to' | 'part_of'",
  "strength?": "0 <= number <= 1",
  "confidence?": "0 <= number <= 1",
  "metadata?": RelationMetadata,
}).narrow((relation, ctx) => {
  // Prevent self-references (entity relating to itself)
  if (relation.from === relation.to) {
    return ctx.reject({
      expected: "from and to to be different entities",
      actual: `both are "${relation.from}"`,
      path: ["to"],
    })
  }
  return true
})

export type Relation = typeof Relation.infer

/**
 * RelationValidator provides validation methods with ArkType
 * Uses frozen object pattern for stateless validation functions
 */
export const RelationValidator = Object.freeze({
  /**
   * Validates if data conforms to the Relation schema
   */
  validate(data: unknown) {
    return Relation(data)
  },

  /**
   * Type guard: validates if data is a Relation
   */
  isRelation(data: unknown): data is Relation {
    const result = Relation(data)
    return !(result instanceof type.errors)
  },

  /**
   * Checks if a relation has a valid strength value
   */
  hasStrength(data: unknown): data is Relation & { strength: number } {
    if (!RelationValidator.isRelation(data)) {
      return false
    }
    return typeof data.strength === "number"
  },

  /**
   * Checks if a relation has a valid confidence value
   */
  hasConfidence(data: unknown): data is Relation & { confidence: number } {
    if (!RelationValidator.isRelation(data)) {
      return false
    }
    return typeof data.confidence === "number"
  },

  /**
   * Checks if a relation has valid metadata
   */
  hasValidMetadata(data: unknown): data is Relation & { metadata: RelationMetadata } {
    if (!RelationValidator.isRelation(data)) {
      return false
    }
    return data.metadata !== undefined
  },

  /**
   * Validates an entity name according to system rules
   */
  isValidEntityName(name: unknown): name is string {
    const result = EntityName(name)
    return !(result instanceof type.errors)
  },
})
