/**
 * Utilities barrel export
 */

export type { ApiError, ApiResponse, FetchConfig } from "#utils/fetch"
// biome-ignore lint/performance/noBarrelFile: single funcion
export { fetchData } from "#utils/fetch"
