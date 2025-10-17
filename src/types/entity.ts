/**
 * Entity type definitions
 * Re-exports from validation.ts for backward compatibility
 */

export type { Entity, EntityEmbedding, EntityType } from "#types/validation"
export {
  EntityEmbeddingSchema,
  EntitySchema,
  EntityTypeSchema,
} from "#types/validation"

import { type Entity, EntitySchema } from "#types/validation"

/**
 * Entity validator utilities using Zod
 */
export const EntityValidator = Object.freeze({
  /**
   * Type guard: validates if data is an Entity
   */
  isEntity(data: unknown): data is Entity {
    return EntitySchema.safeParse(data).success
  },

  /**
   * Validates if data conforms to Entity schema
   */
  validateEntity(data: unknown) {
    return EntitySchema.safeParse(data)
  },
})
