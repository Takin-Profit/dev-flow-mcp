/**
 * Utilities barrel export
 */

export type { ApiError, ApiResponse, FetchConfig } from "#utils/fetch"
// biome-ignore lint/performance/noBarrelFile: single funcion
export { fetchData } from "#utils/fetch"

// Response builders
export {
  buildErrorResponse,
  buildSuccessResponse,
  buildValidationErrorResponse,
  handleError,
} from "#utils/response-builders"
