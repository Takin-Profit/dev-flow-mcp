/**
 * Generic type-safe fetch utility
 * Provides type-safe HTTP requests with validation using Zod
 */

import type { z } from "#config"

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
 * Generic type-safe fetch function with Zod validation
 * @param url - The URL to fetch from
 * @param validator - Zod schema for the response data
 * @param config - Optional fetch configuration
 * @returns Promise resolving to ApiResponse with validated data or error
 */

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: justified
export async function fetchData<T>(
  url: string,
  validator: z.ZodType<T>,
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

    // Validate with Zod
    const validationResult = validator.safeParse(rawData)

    if (!validationResult.success) {
      return {
        error: {
          message: `Validation error: ${validationResult.error.message}`,
          status: response.status,
        },
      }
    }

    return { data: validationResult.data }
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
