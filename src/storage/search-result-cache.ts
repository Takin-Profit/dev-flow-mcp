/**
 * Cache system for search results to improve performance for repeated queries
 */
/** biome-ignore-all lint/style/noMagicNumbers: overzealous */

// ============================================================================
// Constants
// ============================================================================

/** Default cache size: 100MB in bytes */
const DEFAULT_MAX_CACHE_SIZE = 100 * 1024 * 1024

/** Default TTL: 5 minutes in milliseconds */
const DEFAULT_TTL_MS = 5 * 60 * 1000

/** Size of a Float64 number in bytes */
const FLOAT64_BYTES = 8

/** Size of a UTF-16 character in bytes */
const UTF16_CHAR_BYTES = 2

/** Overhead for objects in bytes */
const OBJECT_OVERHEAD_BYTES = 100

/** Default object size estimate in bytes */
const DEFAULT_OBJECT_SIZE_BYTES = 1024

// ============================================================================
// Types
// ============================================================================

/**
 * Cache entry with TTL and LRU tracking
 */
type CacheEntry<T> = {
  /** The cached data */
  data: T

  /** Expiration timestamp */
  expiration: number

  /** When the entry was created */
  created: number

  /** Last time the entry was accessed (for LRU) */
  lastAccessed: number

  /** Size of the entry in bytes (approximate) */
  size: number
}

/**
 * Cache configuration
 */
export type SearchCacheConfig = {
  /** Maximum cache size in bytes */
  maxSize?: number

  /** Default TTL in milliseconds */
  defaultTtl?: number

  /** Enable cache statistics */
  enableStats?: boolean
}

/**
 * Cache statistics
 */
export type CacheStats = {
  // Total number of cache hits
  hits: number

  // Total number of cache misses
  misses: number

  // Hit rate (0-1)
  hitRate: number

  // Current size in bytes
  currentSize: number

  // Maximum size in bytes
  maxSize: number

  // Current number of entries
  entryCount: number

  // Number of evictions
  evictions: number

  // Average lookup time (ms)
  averageLookupTime: number
}

/**
 * A memory-efficient cache for search results
 */
export class SearchResultCache<T> {
  private readonly cache: Map<string, CacheEntry<T>> = new Map()
  private readonly maxSize: number
  private currentSize = 0
  private readonly defaultTtl: number
  private readonly enableStats: boolean

  // Statistics
  private hits = 0
  private misses = 0
  private evictions = 0
  private totalLookupTime = 0
  private totalLookups = 0

  /**
   * Create a new SearchResultCache
   * @param config Configuration options
   */
  constructor(config?: SearchCacheConfig) {
    this.maxSize = config?.maxSize ?? DEFAULT_MAX_CACHE_SIZE
    this.defaultTtl = config?.defaultTtl ?? DEFAULT_TTL_MS
    this.enableStats = config?.enableStats !== false
  }

  /**
   * Estimate the size of an object in bytes
   * @param obj The object to measure
   * @returns Approximate size in bytes
   */
  private estimateSize(obj: unknown): number {
    if (obj === null || obj === undefined) {
      return 0
    }

    // For arrays of numbers (vectors), use more precise calculation
    if (Array.isArray(obj) && obj.length > 0 && typeof obj[0] === "number") {
      return obj.length * FLOAT64_BYTES
    }

    // For strings, use character count * UTF-16 byte size
    if (typeof obj === "string") {
      return obj.length * UTF16_CHAR_BYTES
    }

    // For simple objects with a 'data' property containing a string
    if (obj && typeof obj === "object") {
      const candidate = obj as Record<string, unknown>
      if (typeof candidate.data === "string") {
        return candidate.data.length * UTF16_CHAR_BYTES + OBJECT_OVERHEAD_BYTES
      }
    }

    // Use JSON stringification as an approximation for complex objects
    // Add overhead to account for object structure
    try {
      const json = JSON.stringify(obj)
      return json
        ? json.length * UTF16_CHAR_BYTES + OBJECT_OVERHEAD_BYTES
        : OBJECT_OVERHEAD_BYTES
    } catch {
      // If stringification fails, use a reasonable default
      return DEFAULT_OBJECT_SIZE_BYTES
    }
  }

  /**
   * Generate a cache key from a query and parameters
   * @param query Original query string
   * @param params Optional parameters that affect the query
   * @returns A cache key string
   */
  private generateKey(query: string, params?: Record<string, unknown>): string {
    if (!params) {
      return query
    }

    // Sort keys for consistent key generation regardless of parameter order
    const sortedParams = Object.keys(params)
      .sort()
      .map((key) => `${key}:${JSON.stringify(params[key])}`)
      .join(",")

    return `${query}|${sortedParams}`
  }

  /**
   * Evict least recently used entries to free up space
   * Uses LRU (Least Recently Used) strategy for better cache hit rates
   * @param requiredSpace The amount of space needed
   */
  private evictEntries(requiredSpace: number): void {
    if (this.cache.size === 0) {
      return
    }

    // Sort by last accessed time (LRU - evict least recently used first)
    const entries = Array.from(this.cache.entries()).sort(
      (a, b) => a[1].lastAccessed - b[1].lastAccessed
    )

    let freedSpace = 0

    // Evict entries until we have enough space
    for (const [key, entry] of entries) {
      if (freedSpace >= requiredSpace) {
        break
      }

      this.cache.delete(key)
      freedSpace += entry.size
      this.currentSize -= entry.size
      this.evictions++
    }
  }

  /**
   * Set a cache entry
   * @param query The original query
   * @param data The data to cache
   * @param params Optional parameters that affect the results
   * @param ttl Optional time-to-live in milliseconds
   */
  set(
    query: string,
    data: T,
    params?: Record<string, unknown>,
    ttl?: number
  ): void {
    const key = this.generateKey(query, params)
    const size = this.estimateSize(data)

    // Skip if item is too large for the entire cache
    if (size > this.maxSize) {
      return
    }

    const now = Date.now()

    // If updating existing entry, subtract old size first
    const existingEntry = this.cache.get(key)
    if (existingEntry) {
      this.currentSize -= existingEntry.size
    }

    // Check if we need to make space (after accounting for replaced entry)
    const requiredSpace = this.currentSize + size - this.maxSize
    if (requiredSpace > 0) {
      this.evictEntries(requiredSpace)
    }

    // Create cache entry
    this.cache.set(key, {
      data,
      expiration: now + (ttl ?? this.defaultTtl),
      created: now,
      lastAccessed: now,
      size,
    })

    this.currentSize += size
  }

  /**
   * Get a value from the cache
   * @param query The original query
   * @param params Optional parameters that affect the results
   * @returns The cached data or undefined if not found or expired
   */
  get(query: string, params?: Record<string, unknown>): T | undefined {
    const startTime = this.enableStats ? performance.now() : 0
    const key = this.generateKey(query, params)
    const entry = this.cache.get(key)

    // Track stats
    if (this.enableStats) {
      this.totalLookupTime += performance.now() - startTime
      this.totalLookups++
    }

    // Entry doesn't exist
    if (!entry) {
      this.misses++
      return
    }

    const now = Date.now()

    // Entry is expired - lazy deletion
    if (entry.expiration < now) {
      this.cache.delete(key)
      this.currentSize -= entry.size
      this.misses++
      return
    }

    // Valid cache hit - update LRU timestamp
    entry.lastAccessed = now
    this.hits++

    return entry.data
  }

  /**
   * Remove all expired entries from the cache
   */
  removeExpired(): void {
    const now = Date.now()
    let removedSize = 0

    for (const [key, entry] of this.cache.entries()) {
      if (entry.expiration < now) {
        this.cache.delete(key)
        removedSize += entry.size
      }
    }

    this.currentSize -= removedSize
  }

  /**
   * Clear the entire cache
   */
  clear(): void {
    this.cache.clear()
    this.currentSize = 0
  }

  /**
   * Get cache statistics
   * @returns Cache statistics
   */
  getStats(): CacheStats {
    // Calculate hit rate
    const totalRequests = this.hits + this.misses
    const hitRate = totalRequests > 0 ? this.hits / totalRequests : 0

    // Calculate average lookup time
    const averageLookupTime =
      this.totalLookups > 0 ? this.totalLookupTime / this.totalLookups : 0

    return {
      hits: this.hits,
      misses: this.misses,
      hitRate,
      currentSize: this.currentSize,
      maxSize: this.maxSize,
      entryCount: this.cache.size,
      evictions: this.evictions,
      averageLookupTime,
    }
  }

  /**
   * Get the current number of entries in the cache
   * @returns Number of entries
   */
  size(): number {
    return this.cache.size
  }

  /**
   * Check if the cache contains a specific key
   * @param query The original query
   * @param params Optional parameters that affect the results
   * @returns True if the key exists and is not expired
   */
  has(query: string, params?: Record<string, unknown>): boolean {
    // Reuse get() logic - it handles expiration and stats
    return this.get(query, params) !== undefined
  }
}
