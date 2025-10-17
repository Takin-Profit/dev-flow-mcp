/**
 * Custom Error Classes for DevFlow MCP
 *
 * Provides structured, type-safe error handling with error codes.
 */

import { ErrorCode } from "#types/responses"

/**
 * Base error class for all DevFlow MCP errors
 *
 * All custom errors inherit from this class to provide
 * consistent error structure and behavior.
 */
export class DFMError extends Error {
  /**
   * @param code - Standardized error code
   * @param message - Human-readable error message
   * @param details - Optional additional error details
   */
  constructor(
    public readonly code: ErrorCode,
    message: string,
    public readonly details?: Record<string, unknown>
  ) {
    super(message)
    this.name = "DFMError"
    Error.captureStackTrace(this, this.constructor)
  }

  /**
   * Convert to MCP error message
   * Format: "ERROR_CODE: message (details)"
   */
  toMCPMessage(): string {
    const detailsStr = this.details ? ` (${JSON.stringify(this.details)})` : ""
    return `${this.code}: ${this.message}${detailsStr}`
  }
}

/**
 * Validation error
 *
 * Thrown when input validation fails.
 *
 * @example
 * ```typescript
 * throw new ValidationError("Invalid entity name", { name: "123invalid" })
 * ```
 */
export class ValidationError extends DFMError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(ErrorCode.INVALID_INPUT, message, details)
    this.name = "ValidationError"
  }
}

/**
 * Entity not found error
 *
 * Thrown when an entity doesn't exist in the knowledge graph.
 *
 * @example
 * ```typescript
 * throw new EntityNotFoundError("user123")
 * ```
 */
export class EntityNotFoundError extends DFMError {
  constructor(entityName: string) {
    super(ErrorCode.ENTITY_NOT_FOUND, `Entity not found: ${entityName}`, {
      entityName,
    })
    this.name = "EntityNotFoundError"
  }
}

/**
 * Relation not found error
 *
 * Thrown when a relation doesn't exist in the knowledge graph.
 *
 * @example
 * ```typescript
 * throw new RelationNotFoundError("user123", "service456", "depends_on")
 * ```
 */
export class RelationNotFoundError extends DFMError {
  constructor(from: string, to: string, relationType: string) {
    super(
      ErrorCode.RELATION_NOT_FOUND,
      `Relation not found: ${from} -[${relationType}]-> ${to}`,
      { from, to, relationType }
    )
    this.name = "RelationNotFoundError"
  }
}

/**
 * Entity already exists error
 *
 * Thrown when attempting to create an entity that already exists.
 *
 * @example
 * ```typescript
 * throw new EntityAlreadyExistsError("user123")
 * ```
 */
export class EntityAlreadyExistsError extends DFMError {
  constructor(entityName: string) {
    super(
      ErrorCode.ENTITY_ALREADY_EXISTS,
      `Entity already exists: ${entityName}`,
      {
        entityName,
      }
    )
    this.name = "EntityAlreadyExistsError"
  }
}

/**
 * Database error
 *
 * Thrown when a database operation fails.
 *
 * @example
 * ```typescript
 * try {
 *   await db.query(...)
 * } catch (err) {
 *   throw new DatabaseError("Failed to query database", err)
 * }
 * ```
 */
export class DatabaseError extends DFMError {
  constructor(message: string, cause?: Error) {
    super(ErrorCode.DATABASE_ERROR, message, { cause: cause?.message })
    this.name = "DatabaseError"
  }
}

/**
 * Embedding service error
 *
 * Thrown when embedding generation fails.
 *
 * @example
 * ```typescript
 * try {
 *   await embeddingService.generateEmbedding(text)
 * } catch (err) {
 *   throw new EmbeddingError("Failed to generate embedding", err)
 * }
 * ```
 */
export class EmbeddingError extends DFMError {
  constructor(message: string, cause?: Error) {
    super(ErrorCode.EMBEDDING_ERROR, message, { cause: cause?.message })
    this.name = "EmbeddingError"
  }
}
