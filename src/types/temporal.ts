/**
 * Temporal Types for Knowledge Graph Versioning
 *
 * This module provides temporal awareness for entities and relations,
 * enabling time-based versioning and validity tracking.
 *
 * Key features:
 * - Version tracking with createdAt/updatedAt timestamps
 * - Validity periods (validFrom/validTo) for time-travel queries
 * - Change attribution (changedBy)
 * - Validation utilities for temporal data
 */

import type { Entity } from "#knowledge-graph-manager"
import { type Relation, RelationValidator } from "./relation"

// ============================================================================
// Temporal Entity
// ============================================================================

/**
 * Entity with temporal versioning metadata
 *
 * Extends base Entity with time-based properties for tracking:
 * - When the entity was created and last modified
 * - Version number for optimistic locking
 * - Optional validity period for temporal queries
 * - Who made the changes
 */
export default interface TemporalEntity extends Entity {
  /** Unique identifier for the entity */
  id?: string

  /** Timestamp when created (milliseconds since epoch) */
  createdAt: number

  /** Timestamp when last updated (milliseconds since epoch) */
  updatedAt: number

  /** Optional validity start time (milliseconds since epoch) */
  validFrom?: number

  /** Optional validity end time (milliseconds since epoch) */
  validTo?: number

  /** Version number, incremented with each update */
  version: number

  /** Optional identifier of who made the change */
  changedBy?: string
}

/**
 * Frozen object with validation methods for TemporalEntity
 */
export const TemporalEntity = Object.freeze({
  isTemporalEntity(obj: unknown): boolean {
    return TemporalEntityValidator.isTemporalEntity(obj)
  },

  hasValidTimeRange(obj: unknown): boolean {
    return TemporalEntityValidator.hasValidTimeRange(obj)
  },
})

/**
 * Validator for TemporalEntity objects
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

// ============================================================================
// Temporal Relation
// ============================================================================

/**
 * Relation with temporal versioning metadata
 *
 * Extends base Relation with time-based properties for tracking:
 * - When the relation was created and last modified
 * - Version number for optimistic locking
 * - Optional validity period for temporal queries
 * - Who made the changes
 */
export interface TemporalRelation extends Relation {
  /** Unique identifier for the relation */
  id?: string

  /** Timestamp when created (milliseconds since epoch) */
  createdAt: number

  /** Timestamp when last updated (milliseconds since epoch) */
  updatedAt: number

  /** Optional validity start time (milliseconds since epoch) */
  validFrom?: number

  /** Optional validity end time (milliseconds since epoch) */
  validTo?: number

  /** Version number, incremented with each update */
  version: number

  /** Optional identifier of who made the change */
  changedBy?: string
}

/**
 * Frozen object with validation methods for TemporalRelation
 */
export const TemporalRelation = Object.freeze({
  isTemporalRelation(obj: unknown): boolean {
    return TemporalRelationValidator.isTemporalRelation(obj)
  },

  hasValidTimeRange(obj: unknown): boolean {
    return TemporalRelationValidator.hasValidTimeRange(obj)
  },

  isCurrentlyValid(obj: unknown, now = Date.now()): boolean {
    return TemporalRelationValidator.isCurrentlyValid(obj, now)
  },
})

/**
 * Validator for TemporalRelation objects
 */
export const TemporalRelationValidator = Object.freeze({
  /**
   * Validates if an object conforms to the TemporalRelation interface
   */
  isTemporalRelation(obj: unknown): obj is TemporalRelation {
    // First ensure it's a valid Relation
    if (!RelationValidator.isRelation(obj)) {
      return false
    }

    const candidate = obj as Record<string, unknown>

    // Then check temporal properties
    if (
      typeof candidate.createdAt !== "number" ||
      typeof candidate.updatedAt !== "number" ||
      typeof candidate.version !== "number"
    ) {
      return false
    }

    // Optional properties type checking
    if (
      candidate.validFrom !== undefined &&
      typeof candidate.validFrom !== "number"
    ) {
      return false
    }

    if (
      candidate.validTo !== undefined &&
      typeof candidate.validTo !== "number"
    ) {
      return false
    }

    if (
      candidate.changedBy !== undefined &&
      typeof candidate.changedBy !== "string"
    ) {
      return false
    }

    return true
  },

  /**
   * Checks if a relation has a valid temporal range
   */
  hasValidTimeRange(obj: unknown): boolean {
    if (!TemporalRelationValidator.isTemporalRelation(obj)) {
      return false
    }

    // obj is now narrowed to TemporalRelation type
    // If both are defined, validFrom must be before validTo
    if (obj.validFrom !== undefined && obj.validTo !== undefined) {
      return obj.validFrom <= obj.validTo
    }

    return true
  },

  /**
   * Checks if a relation is currently valid based on its temporal range
   */
  isCurrentlyValid(obj: unknown, now = Date.now()): boolean {
    if (!TemporalRelationValidator.isTemporalRelation(obj)) {
      return false
    }

    // obj is now narrowed to TemporalRelation type
    // Check if current time is within validity period
    if (obj.validFrom !== undefined && now < obj.validFrom) {
      return false // Before valid period
    }

    if (obj.validTo !== undefined && now > obj.validTo) {
      return false // After valid period
    }

    return true
  },
})
