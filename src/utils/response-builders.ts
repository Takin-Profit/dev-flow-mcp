/**
 * Response Builder Utilities
 *
 * Standardized functions for building MCP tool responses.
 * Updated to match MCP specification with isError flag and structuredContent.
 */

import type { ZodError } from "zod"
import { fromZodError } from "zod-validation-error"
import type { MCPToolResponse } from "#types/responses"

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
  // biome-ignore lint/suspicious/noExplicitAny: ZodError compatibility
  zodError: ZodError<any>
): MCPToolResponse {
  const validationError = fromZodError(zodError, {
    prefix: "Validation failed",
    prefixSeparator: ": ",
    includePath: true,
    maxIssuesInMessage: 5,
  })

  return buildErrorResponse(validationError.message)
}
