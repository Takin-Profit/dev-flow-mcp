/**
 * Generic type-safe fetch utility
 * Provides type-safe HTTP requests with validation using ArkType
 */

import type { Type } from "arktype"
import { type } from "arktype"

/**
 * Custom error type for API errors
 */
export type ApiError = {
  message: string
  status?: number
}

/**
 * Response structure for API calls
 */
export type ApiResponse<T> = {
  data?: T
  error?: ApiError
}

/**
 * Configuration for fetch requests
 */
export type FetchConfig = {
  method?: "GET" | "POST" | "PUT" | "DELETE"
  headers?: Record<string, string>
  body?: unknown
  queryParams?: Record<string, string | number>
  timeout?: number
}

/**
 * Generic type-safe fetch function with ArkType validation
 * @param url - The URL to fetch from
 * @param validator - ArkType validator for the response data
 * @param config - Optional fetch configuration
 * @returns Promise resolving to ApiResponse with validated data or error
 */

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: justified
export async function fetchData<T>(
  url: string,
  validator: Type<T>,
  config: FetchConfig = {}
): Promise<ApiResponse<T>> {
  let timeoutId: NodeJS.Timeout | undefined
  const controller = new AbortController()

  try {
    // Construct URL with query parameters
    let finalUrl = url
    if (config.queryParams) {
      const params = new URLSearchParams()
      for (const [key, value] of Object.entries(config.queryParams)) {
        params.append(key, value.toString())
      }
      finalUrl = `${url}?${params.toString()}`
    }

    // Set up timeout if specified
    if (config.timeout) {
      timeoutId = setTimeout(() => controller.abort(), config.timeout)
    }

    // Make fetch request
    const response = await fetch(finalUrl, {
      method: config.method ?? "GET",
      headers: config.headers,
      body: config.body ? JSON.stringify(config.body) : undefined,
      signal: controller.signal,
    })

    // Clear timeout on success
    if (timeoutId) {
      clearTimeout(timeoutId)
    }

    // Check for HTTP errors
    if (!response.ok) {
      return {
        error: {
          message: `HTTP error: ${response.statusText}`,
          status: response.status,
        },
      }
    }

    // Parse response
    const rawData: unknown = await response.json()

    // Validate with ArkType
    const validationResult = validator(rawData)

    // Check if validation failed using arktype's error type
    if (validationResult instanceof type.errors) {
      return {
        error: {
          message: `Validation error: ${validationResult.summary}`,
          status: response.status,
        },
      }
    }

    // Type assertion is safe here because arktype validates the structure
    return { data: validationResult as T }
  } catch (error) {
    // Clear timeout on error
    if (timeoutId) {
      clearTimeout(timeoutId)
    }

    // Handle abort/timeout errors
    if (error instanceof Error && error.name === "AbortError") {
      return {
        error: {
          message: "Request timed out",
        },
      }
    }

    // Handle network or other errors
    return {
      error: {
        message:
          error instanceof Error ? error.message : "Unknown error occurred",
      },
    }
  }
}
