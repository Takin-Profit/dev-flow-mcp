/**
 * Interface for entities with temporal metadata
 */
import type { Entity } from "#knowledge-graph-manager.ts"

/**
 * Represents an entity with temporal awareness capabilities
 * Extends the base Entity interface with time-based properties
 */
export default interface TemporalEntity extends Entity {
  /**
   * Unique identifier for the entity
   */
  id?: string

  /**
   * Timestamp when the entity was created (milliseconds since epoch)
   */
  createdAt: number

  /**
   * Timestamp when the entity was last updated (milliseconds since epoch)
   */
  updatedAt: number

  /**
   * Optional start time for the validity period (milliseconds since epoch)
   */
  validFrom?: number

  /**
   * Optional end time for the validity period (milliseconds since epoch)
   */
  validTo?: number

  /**
   * Version number, incremented with each update
   */
  version: number

  /**
   * Optional identifier of the system or user that made the change
   */
  changedBy?: string
}

// Add static methods to the TemporalEntity interface for JavaScript tests
// This allows tests to access validation methods directly from the interface
export const TemporalEntity = Object.freeze({
  isTemporalEntity(obj: unknown): boolean {
    return TemporalEntityValidator.isTemporalEntity(obj)
  },

  hasValidTimeRange(obj: unknown): boolean {
    return TemporalEntityValidator.hasValidTimeRange(obj)
  },
})

/**
 * TemporalEntityValidator class with validation methods
 */
export const TemporalEntityValidator = Object.freeze({
  /**
   * Validates if an object conforms to the TemporalEntity interface
   */
  isTemporalEntity(obj: unknown): obj is TemporalEntity {
    // Type guard: ensure obj is an object
    if (!obj || typeof obj !== "object") {
      return false
    }

    const candidate = obj as Record<string, unknown>

    // First ensure it's a valid Entity
    if (
      typeof candidate.name !== "string" ||
      typeof candidate.entityType !== "string" ||
      !Array.isArray(candidate.observations)
    ) {
      return false
    }

    // Then check temporal properties
    if (
      typeof candidate.createdAt !== "number" ||
      typeof candidate.updatedAt !== "number" ||
      typeof candidate.version !== "number"
    ) {
      return false
    }

    // Optional properties type checking
    if (candidate.validFrom !== undefined && typeof candidate.validFrom !== "number") {
      return false
    }

    if (candidate.validTo !== undefined && typeof candidate.validTo !== "number") {
      return false
    }

    if (candidate.changedBy !== undefined && typeof candidate.changedBy !== "string") {
      return false
    }

    return true
  },

  /**
   * Checks if an entity has a valid temporal range
   */
  hasValidTimeRange(obj: unknown): boolean {
    if (!TemporalEntityValidator.isTemporalEntity(obj)) {
      return false
    }

    // obj is now narrowed to TemporalEntity type
    // If both are defined, validFrom must be before validTo
    if (obj.validFrom !== undefined && obj.validTo !== undefined) {
      return obj.validFrom <= obj.validTo
    }

    return true
  },
})
