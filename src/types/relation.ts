/**
 * Relation type definitions
 * Re-exports from validation.ts for backward compatibility
 */

export type {
  Relation,
  RelationMetadata,
  RelationType,
} from "#types/validation"
export {
  RelationMetadataSchema,
  RelationSchema,
  RelationTypeSchema,
} from "#types/validation"

import { type Relation, RelationSchema } from "#types/validation"

/**
 * Relation validator utilities using Zod
 */
export const RelationValidator = Object.freeze({
  /**
   * Type guard: validates if data is a Relation
   */
  isRelation(data: unknown): data is Relation {
    return RelationSchema.safeParse(data).success
  },

  /**
   * Validates if data conforms to Relation schema
   */
  validateRelation(data: unknown) {
    return RelationSchema.safeParse(data)
  },
})
