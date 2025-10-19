/**
 * Response Builder Utilities
 *
 * Standardized functions for building MCP tool responses and error handling.
 * Updated to match MCP specification with isError flag and structuredContent.
 */

import type { ZodError } from "zod"
import { fromZodError, isValidationErrorLike } from "zod-validation-error"
import { DFMError } from "#errors"
import type { Logger, MCPToolResponse } from "#types"

/**
 * Build a successful MCP tool response
 *
 * @param data - The response data
 * @returns MCP-formatted tool response with structured content
 *
 * @example
 * ```typescript
 * return buildSuccessResponse({
 *   created: 1,
 *   entities: [entity]
 * })
 * ```
 */
export function buildSuccessResponse<T>(data: T): MCPToolResponse {
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(data, null, 2),
      },
    ],
    structuredContent: data as Record<string, unknown>,
  }
}

/**
 * Build an error MCP tool response
 *
 * @param message - Human-readable error message
 * @returns MCP-formatted error response
 *
 * @example
 * ```typescript
 * return buildErrorResponse("Entity 'User' not found")
 * ```
 */
export function buildErrorResponse(message: string): MCPToolResponse {
  return {
    isError: true,
    content: [
      {
        type: "text",
        text: message,
      },
    ],
  }
}

/**
 * Build error response from Zod validation failure
 *
 * @param zodError - The Zod validation error
 * @returns MCP-formatted error response
 *
 * @example
 * ```typescript
 * const result = EntitySchema.safeParse(data)
 * if (!result.success) {
 *   return buildValidationErrorResponse(result.error)
 * }
 * ```
 */
export function buildValidationErrorResponse(
  zodError: ZodError<unknown>
): MCPToolResponse {
  const validationError = fromZodError(zodError, {
    prefix: "Validation failed",
    prefixSeparator: ": ",
    includePath: true,
    maxIssuesInMessage: 5,
  })

  return buildErrorResponse(validationError.message)
}

// ============================================================================
// Error Handling
// ============================================================================

/**
 * Type guard to check if error is a Zod error
 * Uses instanceof check since ZodError extends Error
 */
// biome-ignore lint/suspicious/noExplicitAny: ZodError generic compatibility
function isZodError(error: unknown): error is ZodError<any> {
  return (
    error instanceof Error && "issues" in error && Array.isArray(error.issues)
  )
}

/**
 * Convert any error to a standard MCP error response
 *
 * @param error - Unknown error object
 * @param logger - Logger instance for error logging
 * @returns MCP-formatted error response
 */
export function handleError(error: unknown, logger?: Logger): MCPToolResponse {
  // Log full error internally
  logger?.error("Tool error", error)

  // Handle custom DFM errors
  if (error instanceof DFMError) {
    return buildErrorResponse(error.toMCPMessage())
  }

  // Handle Zod validation errors
  if (isZodError(error)) {
    return buildValidationErrorResponse(error)
  }

  // Handle zod-validation-error ValidationError
  if (isValidationErrorLike(error)) {
    return buildErrorResponse(error.message)
  }

  // Handle standard Error
  if (error instanceof Error) {
    return buildErrorResponse(error.message)
  }

  // Unknown error type
  return buildErrorResponse("An unexpected error occurred")
}
