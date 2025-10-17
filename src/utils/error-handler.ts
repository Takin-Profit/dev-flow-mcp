/**
 * Error Handler Utilities
 *
 * Centralized error handling for consistent error responses.
 * Simplified to match MCP specification.
 */

import type { ZodError } from "zod"
import { isValidationErrorLike } from "zod-validation-error"
import { DFMError } from "#errors"
import type { Logger } from "#types/logger"
import type { MCPToolResponse } from "#types/responses"
import {
  buildErrorResponse,
  buildValidationErrorResponse,
} from "#utils/response-builders"

/**
 * Type guard to check if error is a Zod error
 */
// biome-ignore lint/suspicious/noExplicitAny: Type guard compatibility
function isZodError(error: unknown): error is ZodError<any> {
  return (
    typeof error === "object" &&
    error !== null &&
    "issues" in error &&
    // biome-ignore lint/suspicious/noExplicitAny: Type guard requires any
    Array.isArray((error as any).issues)
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
