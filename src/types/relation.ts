/**
 * Metadata for relations providing additional context and information
 */
export type RelationMetadata = {
  /**
   * Array of relation IDs that this relation was inferred from
   */
  inferredFrom?: string[]

  /**
   * Timestamp when the relation was last accessed/retrieved
   */
  lastAccessed?: number

  /**
   * Timestamp when the relation was created
   */
  createdAt: number

  /**
   * Timestamp when the relation was last updated
   */
  updatedAt: number
}

/**
 * Represents a relationship between two entities in the knowledge graph
 */
export type Relation = {
  /**
   * The source entity name (where the relation starts)
   */
  from: string

  /**
   * The target entity name (where the relation ends)
   */
  to: string

  /**
   * The type of relationship between the entities
   */
  relationType: "implements" | "depends_on" | "relates_to" | "part_of"

  /**
   * Optional strength of the relationship (0.0-1.0)
   * Higher values indicate stronger relationships
   */
  strength?: number

  /**
   * Optional confidence score (0.0-1.0)
   * Represents how confident the system is about this relationship
   * Particularly useful for inferred relations
   */
  confidence?: number

  /**
   * Optional metadata providing additional context about the relation
   */
  metadata?: RelationMetadata
}

/**
 * RelationValidator provides validation methods for Relation objects
 * Uses frozen object pattern instead of namespace or class with static methods
 */
export const RelationValidator = Object.freeze({
  /**
   * Validates if an object conforms to the Relation interface
   */
  isRelation(obj: unknown): obj is Relation {
    // Type guard: ensure obj is an object
    if (!obj || typeof obj !== "object") {
      return false
    }

    const candidate = obj as Record<string, unknown>

    return (
      typeof candidate.from === "string" &&
      typeof candidate.to === "string" &&
      typeof candidate.relationType === "string" &&
      (candidate.strength === undefined ||
        typeof candidate.strength === "number") &&
      (candidate.confidence === undefined ||
        typeof candidate.confidence === "number") &&
      (candidate.metadata === undefined ||
        typeof candidate.metadata === "object")
    )
  },

  /**
   * Checks if a relation has a strength value
   */
  hasStrength(obj: unknown): boolean {
    if (!RelationValidator.isRelation(obj)) {
      return false
    }

    return (
      typeof obj.strength === "number" && obj.strength >= 0 && obj.strength <= 1
    )
  },

  /**
   * Checks if a relation has a confidence value
   */
  hasConfidence(obj: unknown): boolean {
    if (!RelationValidator.isRelation(obj)) {
      return false
    }

    return (
      typeof obj.confidence === "number" &&
      obj.confidence >= 0 &&
      obj.confidence <= 1
    )
  },

  /**
   * Checks if a relation has valid metadata
   */
  hasValidMetadata(obj: unknown): boolean {
    if (!(RelationValidator.isRelation(obj) && obj.metadata)) {
      return false
    }

    const metadata = obj.metadata as Record<string, unknown>

    // Required fields
    if (
      typeof metadata.createdAt !== "number" ||
      typeof metadata.updatedAt !== "number"
    ) {
      return false
    }

    // Optional fields
    if (
      metadata.lastAccessed !== undefined &&
      typeof metadata.lastAccessed !== "number"
    ) {
      return false
    }

    if (metadata.inferredFrom !== undefined) {
      if (!Array.isArray(metadata.inferredFrom)) {
        return false
      }

      // Verify all items in inferredFrom are strings
      for (const id of metadata.inferredFrom) {
        if (typeof id !== "string") {
          return false
        }
      }
    }

    return true
  },
})
