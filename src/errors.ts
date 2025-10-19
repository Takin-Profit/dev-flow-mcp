/**
 * Custom Error Classes for DevFlow MCP
 *
 * Provides structured, type-safe error handling with error codes.
 */

import { isNodeSqliteError } from "@takinprofit/sqlite-x"
import type { Logger } from "#types"

/**
 * Standardized error codes for tool responses
 */
export type ErrorCode =
  // Validation errors (4xx equivalent)
  | "INVALID_INPUT"
  | "INVALID_ENTITY_NAME"
  | "INVALID_ENTITY_TYPE"
  | "INVALID_RELATION_TYPE"
  | "INVALID_OBSERVATIONS"
  | "INVALID_STRENGTH"
  | "INVALID_CONFIDENCE"
  | "EMPTY_ARRAY"
  // Not found errors (404 equivalent)
  | "ENTITY_NOT_FOUND"
  | "RELATION_NOT_FOUND"
  // Conflict errors (409 equivalent)
  | "ENTITY_ALREADY_EXISTS"
  | "RELATION_ALREADY_EXISTS"
  // Internal errors (5xx equivalent)
  | "DATABASE_ERROR"
  | "EMBEDDING_ERROR"
  | "INTERNAL_ERROR"

/**
 * Base error class for all DevFlow MCP errors
 *
 * All custom errors inherit from this class to provide
 * consistent error structure and behavior.
 */
export class DFMError extends Error {
  readonly code: ErrorCode
  readonly details?: Record<string, unknown>

  /**
   * @param code - Standardized error code
   * @param message - Human-readable error message
   * @param details - Optional additional error details
   */
  constructor(
    code: ErrorCode,
    message: string,
    details?: Record<string, unknown>
  ) {
    super(message)
    this.name = "DFMError"
    this.code = code
    this.details = details
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
 * '''
 */
export class ValidationError extends DFMError {
  constructor(message: string, details?: Record<string, unknown>) {
    super("INVALID_INPUT", message, details)
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
 * '''
 */
export class EntityNotFoundError extends DFMError {
  constructor(entityName: string) {
    super("ENTITY_NOT_FOUND", `Entity not found: ${entityName}`, {
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
 * '''
 */
export class RelationNotFoundError extends DFMError {
  constructor(from: string, to: string, relationType: string) {
    super(
      "RELATION_NOT_FOUND",
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
 * '''
 */
export class EntityAlreadyExistsError extends DFMError {
  constructor(entityName: string) {
    super("ENTITY_ALREADY_EXISTS", `Entity already exists: ${entityName}`, {
      entityName,
    })
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
 * '''
 */
export class DatabaseError extends DFMError {
  constructor(message: string, cause?: Error) {
    super("DATABASE_ERROR", message, { cause: cause?.message })
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
 * '''
 */
export class EmbeddingError extends DFMError {
  constructor(message: string, cause?: Error) {
    super("EMBEDDING_ERROR", message, { cause: cause?.message })
    this.name = "EmbeddingError"
  }
}

/**
 * Handles SQLite errors with better error messages and structured error types.
 * @param error The error to handle
 * @param logger Optional logger to log detailed error information
 * @returns A DFMError (usually a DatabaseError) with a user-friendly message.
 */
export function handleSqliteError(error: unknown, logger?: Logger): Error {
  if (isNodeSqliteError(error)) {
    logger?.error("SQLite error occurred", {
      errorType: error.errorType,
      code: error.code,
      errcode: error.errcode,
      message: error.message,
    })

    switch (error.errorType) {
      case "CONSTRAINT_VIOLATION":
        return new DatabaseError(
          `Database constraint violation: ${error.message}`,
          error
        )
      case "DATABASE_LOCKED":
      case "DATABASE_BUSY":
        return new DatabaseError(
          "Database is locked or busy, please try again.",
          error
        )
      case "DATABASE_CORRUPT":
        return new DatabaseError("Database corruption detected.", error)
      case "DATABASE_READONLY":
        return new DatabaseError("Cannot write to a read-only database.", error)
      case "CANNOT_OPEN":
        return new DatabaseError("Failed to open the database file.", error)
      case "IO_ERROR":
        return new DatabaseError("A file I/O error occurred.", error)
      case "DATABASE_FULL":
        return new DatabaseError("The database is full.", error)
      case "LIBRARY_MISUSE":
        return new DFMError(
          "INTERNAL_ERROR",
          "An internal error occurred due to incorrect database API usage.",
          { cause: error.message }
        )
      default:
        return new DatabaseError(
          `An unexpected database error occurred: ${error.message}`,
          error
        )
    }
  }

  if (error instanceof Error) {
    return error
  }

  return new DFMError(
    "INTERNAL_ERROR",
    `An unknown error occurred: ${String(error)}`
  )
}
