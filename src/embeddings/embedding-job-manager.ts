/** biome-ignore-all lint/suspicious/useAwait: functions need to return promises */
import crypto from "node:crypto"
import { raw } from "@takinprofit/sqlite-x"
import { LRUCache } from "lru-cache"
import { v4 as uuidv4 } from "uuid"
import type { SqliteDb } from "#db/sqlite-db"
import type { EmbeddingService } from "#embeddings/embedding-service"
import type {
  CachedEmbedding,
  CacheOptions,
  CountResult,
  EmbeddingJob,
  EmbeddingJobStatus,
  Entity,
  JobProcessResults,
  Logger,
  RateLimiterOptions,
  RateLimiterStatus,
} from "#types"
import {
  CACHE_KEY_PREVIEW_LENGTH,
  createNoOpLogger,
  DAYS_PER_WEEK,
  DEFAULT_CACHE_SIZE,
  DEFAULT_INITIAL_ATTEMPTS,
  DEFAULT_JOB_RATE_LIMIT_TOKENS,
  DEFAULT_MAX_ATTEMPTS,
  HOURS_PER_DAY,
  MILLISECONDS_PER_SECOND,
  MINUTES_PER_HOUR,
  SECONDS_PER_MINUTE,
} from "#types"
import { TimestampSchema } from "#types/validation"

// ============================================================================
// Constants
// ============================================================================

const SECONDS_PER_HOUR = SECONDS_PER_MINUTE * MINUTES_PER_HOUR
const MILLISECONDS_PER_HOUR = SECONDS_PER_HOUR * MILLISECONDS_PER_SECOND
const MILLISECONDS_PER_DAY =
  HOURS_PER_DAY *
  MINUTES_PER_HOUR *
  SECONDS_PER_MINUTE *
  MILLISECONDS_PER_SECOND
const MILLISECONDS_PER_WEEK = DAYS_PER_WEEK * MILLISECONDS_PER_DAY

const DEFAULT_CACHE_TTL_MS = MILLISECONDS_PER_HOUR
const DEFAULT_RATE_LIMIT_INTERVAL_MS =
  SECONDS_PER_MINUTE * MILLISECONDS_PER_SECOND
const DEFAULT_CLEANUP_THRESHOLD_MS = MILLISECONDS_PER_WEEK

/**
 * Return structure for queue status
 */
type QueueStatus = {
  pending: number
  processing: number
  completed: number
  failed: number
  totalJobs: number
}

/**
 * Manages embedding jobs for semantic search
 */
export class EmbeddingJobManager {
  readonly #db
  readonly #database
  readonly #embeddingService
  rateLimiter: {
    tokens: number
    lastRefill: number
    tokensPerInterval: number
    interval: number
  }
  cache: LRUCache<string, CachedEmbedding>
  readonly #cacheOptions: CacheOptions = { size: 1000, ttl: 3_600_000 }
  readonly #logger

  /**
   * Creates a new embedding job manager
   *
   * @param options - Configuration options object
   */
  constructor(options: {
    database: SqliteDb
    embeddingService: EmbeddingService
    rateLimiterOptions?: RateLimiterOptions | null
    cacheOptions?: CacheOptions | null
    logger?: Logger | null
  }) {
    this.#database = options.database
    this.#db = options.database.dbInstance
    this.#embeddingService = options.embeddingService
    this.#logger = options.logger || createNoOpLogger()

    // Setup rate limiter with defaults
    const defaultRateLimiter = {
      tokensPerInterval: DEFAULT_JOB_RATE_LIMIT_TOKENS,
      interval: DEFAULT_RATE_LIMIT_INTERVAL_MS,
    }

    const rateOptions = options.rateLimiterOptions || defaultRateLimiter

    this.rateLimiter = {
      tokens: rateOptions.tokensPerInterval,
      lastRefill: Date.now(),
      tokensPerInterval: rateOptions.tokensPerInterval,
      interval: rateOptions.interval,
    }

    // Setup LRU cache
    if (options.cacheOptions) {
      // Support both API styles (tests use maxItems/ttlHours)
      this.#cacheOptions = {
        size:
          options.cacheOptions.size ||
          options.cacheOptions.maxItems ||
          DEFAULT_CACHE_SIZE,
        ttl:
          options.cacheOptions.ttl ||
          (options.cacheOptions.ttlHours
            ? Math.round(
                options.cacheOptions.ttlHours *
                  SECONDS_PER_HOUR *
                  MILLISECONDS_PER_SECOND
              )
            : DEFAULT_CACHE_TTL_MS),
      }
    }

    this.cache = new LRUCache({
      max: this.#cacheOptions.size,
      ttl: Math.max(1, Math.round(this.#cacheOptions.ttl)),
      updateAgeOnGet: true,
      allowStale: false,
      // Use a ttlAutopurge option to ensure items are purged when TTL expires
      ttlAutopurge: true,
    })

    this.#logger.info("EmbeddingJobManager initialized", {
      cacheSize: this.#cacheOptions.size,
      cacheTtl: this.#cacheOptions.ttl,
      rateLimit: `${this.rateLimiter.tokensPerInterval} per ${this.rateLimiter.interval}ms`,
    })
  }

  /**
   * Get the embedding service instance
   * @returns The embedding service
   */
  getEmbeddingService(): EmbeddingService {
    return this.#embeddingService
  }

  /**
   * Prepare entity text for embedding generation
   * Public wrapper for the private #prepareEntityText method
   * @param entity The entity to prepare text for
   * @returns The prepared text representation
   */
  prepareEntityText(entity: Entity): string {
    return this.#prepareEntityText(entity)
  }

  /**
   * Schedule an entity for embedding generation
   *
   * @param entityName - Name of the entity to generate embedding for
   * @returns Job ID
   */
  async scheduleEntityEmbedding(entityName: string): Promise<string> {
    // Verify entity exists
    const entity = await this.#database.getEntity(entityName)
    if (!entity) {
      const error = `Entity ${entityName} not found`
      this.#logger.error("Failed to schedule embedding", { entityName, error })
      throw new Error(error)
    }

    // Create a job ID
    const jobId = uuidv4()

    // Insert a new job record
    this.#db.sql<{
      id: string
      entity_name: string
      status: string
      created_at: number
      attempts: number
      max_attempts: number
    }>`
      INSERT INTO embedding_jobs (
        id, entity_name, status, created_at, attempts, max_attempts
      ) VALUES (${"$id"}, ${"$entity_name"}, ${"$status"}, ${"$created_at"}, ${"$attempts"}, ${"$max_attempts"})
    `.run({
      id: jobId,
      entity_name: entityName,
      status: "pending",
      created_at: Date.now(),
      attempts: DEFAULT_INITIAL_ATTEMPTS,
      max_attempts: DEFAULT_MAX_ATTEMPTS,
    })

    this.#logger.info("Scheduled embedding job", {
      jobId,
      entityName,
    })

    return jobId
  }

  /**
   * Process a batch of pending embedding jobs
   *
   * @param batchSize - Maximum number of jobs to process
   * @returns Result statistics
   */

  // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: will fix on next refactor
  async processJobs(batchSize = 10): Promise<JobProcessResults> {
    this.#logger.info("Starting job processing", { batchSize })

    // Get pending jobs in FIFO order (oldest first)
    const jobs = this.#db.sql<{ status: string; limit: number }>`
      SELECT * FROM embedding_jobs
      WHERE status = ${"$status"}
      ORDER BY created_at ASC
      LIMIT ${"$limit"}
    `.all<EmbeddingJob>({
      status: "pending",
      limit: batchSize,
    })
    this.#logger.debug("Found pending jobs", { count: jobs.length })

    // Initialize counters
    const result: JobProcessResults = {
      processed: 0,
      successful: 0,
      failed: 0,
    }

    // Process each job
    for (const job of jobs) {
      // Check rate limiter before processing
      const rateLimitCheck = this._checkRateLimiter()
      if (!rateLimitCheck.success) {
        this.#logger.warn("Rate limit reached, pausing job processing", {
          remaining: jobs.length - result.processed,
        })
        break // Stop processing jobs if rate limit is reached
      }

      this.#logger.info("Processing embedding job", {
        jobId: job.id,
        entityName: job.entity_name,
        attempt: job.attempts + 1,
        maxAttempts: job.max_attempts,
      })

      // Update job status to processing
      this.#updateJobStatus(job.id, "processing", job.attempts + 1)

      try {
        // Get the entity
        const entity = await this.#database.getEntity(job.entity_name)

        if (!entity) {
          throw new Error(`Entity ${job.entity_name} not found`)
        }

        // Log entity details for debugging
        this.#logger.debug("Retrieved entity for embedding", {
          entityName: job.entity_name,
          entityType: entity.entityType,
          hasObservations: entity.observations ? "yes" : "no",
          observationsType: entity.observations
            ? typeof entity.observations
            : "undefined",
          observationsLength:
            entity.observations && Array.isArray(entity.observations)
              ? entity.observations.length
              : "n/a",
        })

        // Prepare text for embedding
        const text = this.#prepareEntityText(entity)

        // Try to get from cache or generate new embedding
        this.#logger.debug("Generating embedding for entity", {
          entityName: job.entity_name,
        })
        const embedding = await this._getCachedEmbeddingOrGenerate(text)

        // Get model info for embedding metadata
        const modelInfo = this.#embeddingService.getModelInfo()

        // Store the embedding with the entity
        this.#logger.debug("Storing entity vector", {
          entityName: job.entity_name,
          vectorLength: embedding.length,
          model: modelInfo.name,
        })

        // Store the embedding vector
        await this.#database.updateEntityEmbedding(job.entity_name, {
          vector: embedding,
          model: modelInfo.name,
          lastUpdated: TimestampSchema.parse(Date.now()),
        })

        // Update job status to completed
        this.#updateJobStatus(job.id, "completed")

        this.#logger.info("Successfully processed embedding job", {
          jobId: job.id,
          entityName: job.entity_name,
          model: modelInfo.name,
          dimensions: embedding.length,
        })

        result.successful++
      } catch (error: unknown) {
        // Handle failures
        const errorMessage =
          error instanceof Error ? error.message : String(error)
        const errorStack = error instanceof Error ? error.stack : undefined

        this.#logger.error("Failed to process embedding job", {
          jobId: job.id,
          entityName: job.entity_name,
          error: errorMessage,
          errorStack,
          attempt: job.attempts + 1,
          maxAttempts: job.max_attempts,
        })

        // Determine if we should mark as failed or keep for retry
        if (job.attempts + 1 >= job.max_attempts) {
          this.#updateJobStatus(
            job.id,
            "failed",
            job.attempts + 1,
            errorMessage
          )
        } else {
          this.#updateJobStatus(
            job.id,
            "pending",
            job.attempts + 1,
            errorMessage
          )
        }

        result.failed++
      }

      result.processed++
    }

    // Log job processing results
    const queueStatus = await this.getQueueStatus()
    this.#logger.info("Job processing complete", {
      processed: result.processed,
      successful: result.successful,
      failed: result.failed,
      remaining: queueStatus.pending,
    })

    return result
  }

  /**
   * Get the current status of the job queue
   *
   * @returns Queue statistics
   */

  async getQueueStatus(): Promise<QueueStatus> {
    const getCountForStatus = (status?: string): number => {
      if (status) {
        const result = this.#db.sql<{ status: string }>`
          SELECT COUNT(*) as count FROM embedding_jobs
          WHERE status = ${"$status"}
        `.get<CountResult>({ status })

        return result?.count || 0
      }

      const result = this.#db.sql`
        SELECT COUNT(*) as count FROM embedding_jobs
      `.get<CountResult>()

      return result?.count || 0
    }

    const pending = getCountForStatus("pending")
    const processing = getCountForStatus("processing")
    const completed = getCountForStatus("completed")
    const failed = getCountForStatus("failed")
    const total = getCountForStatus()

    const result = {
      pending,
      processing,
      completed,
      failed,
      totalJobs: total,
    }

    this.#logger.debug("Retrieved queue status", result)

    return result
  }

  /**
   * Retry failed embedding jobs
   *
   * @returns Number of jobs reset for retry
   */
  async retryFailedJobs(): Promise<number> {
    const result = this.#db.sql<{
      new_status: string
      attempts: number
      old_status: string
    }>`
      UPDATE embedding_jobs
      SET status = ${"$new_status"}, attempts = ${"$attempts"}
      WHERE status = ${"$old_status"}
    `.run({
      new_status: "pending",
      attempts: 0,
      old_status: "failed",
    })

    const resetCount = Number(result.changes || 0)

    this.#logger.info("Reset failed jobs for retry", { count: resetCount })

    return resetCount
  }

  /**
   * Clean up old completed jobs
   *
   * @param threshold - Age in milliseconds after which to delete completed jobs, defaults to 7 days
   * @returns Number of jobs cleaned up
   */
  async cleanupJobs(threshold?: number): Promise<number> {
    const cleanupThreshold = threshold || DEFAULT_CLEANUP_THRESHOLD_MS
    const cutoffTime = Date.now() - cleanupThreshold

    const result = this.#db.sql<{
      status: string
      cutoff_time: number
    }>`
      DELETE FROM embedding_jobs
      WHERE status = ${"$status"}
      AND processed_at < ${"$cutoff_time"}
    `.run({
      status: "completed",
      cutoff_time: cutoffTime,
    })

    const deletedCount = Number(result.changes || 0)

    this.#logger.info("Cleaned up old completed jobs", {
      count: deletedCount,
      threshold: cleanupThreshold,
      olderThan: new Date(cutoffTime).toISOString(),
    })

    return deletedCount
  }

  /**
   * Update a job's status in the database
   *
   * @private
   * @param jobId - ID of the job to update
   * @param status - New status
   * @param attempts - Optional attempts count update
   * @param error - Optional error message
   * @returns Database result
   */
  #updateJobStatus(
    jobId: string,
    status: EmbeddingJobStatus,
    attempts?: number,
    error?: string
  ) {
    type Params = {
      status: string
      id: string
      processed_at?: number
      attempts?: number
      error?: string | null
    }

    const params: Params = {
      status,
      id: jobId,
    }

    // Build dynamic SET clause
    const setClauses: string[] = [`status = ${"$status"}`]

    // Add processed_at timestamp for completed/failed statuses
    if (status === "completed" || status === "failed") {
      params.processed_at = Date.now()
      setClauses.push(`processed_at = ${"$processed_at"}`)
    }

    // Update attempts if provided
    if (attempts !== undefined) {
      params.attempts = attempts
      setClauses.push(`attempts = ${"$attempts"}`)
    }

    // Include error message if provided
    if (error !== undefined) {
      params.error = error
      setClauses.push(`error = ${"$error"}`)
    }

    // Compose the UPDATE query with type safety
    const updateStmt = this.#db.sql`UPDATE embedding_jobs`
    const setClause = this.#db.sql<Params>`SET ${raw`${setClauses.join(", ")}`}`
    const whereClause = this.#db.sql<Params>`WHERE id = ${"$id"}`
    const query = this.#db
      .sql<Params>`${updateStmt} ${setClause} ${whereClause}`

    return query.run(params)
  }

  /**
   * Check rate limiter and consume a token if available
   *
   * @private
   * @returns Object with success flag
   */
  _checkRateLimiter(): { success: boolean } {
    // For testing purposes, make it public by removing 'private'
    const now = Date.now()
    const elapsed = now - this.rateLimiter.lastRefill

    // If enough time has passed, refill tokens
    if (elapsed >= this.rateLimiter.interval) {
      // Calculate how many full intervals have passed
      const intervals = Math.floor(elapsed / this.rateLimiter.interval)

      // Completely refill tokens (don't accumulate beyond max)
      this.rateLimiter.tokens = this.rateLimiter.tokensPerInterval

      // Update last refill time, keeping track of remaining time
      this.rateLimiter.lastRefill = now

      this.#logger.debug("Refilled rate limiter tokens", {
        current: this.rateLimiter.tokens,
        max: this.rateLimiter.tokensPerInterval,
        intervals,
      })
    }

    // If we have tokens, consume one and return success
    if (this.rateLimiter.tokens > 0) {
      this.rateLimiter.tokens--

      this.#logger.debug("Consumed rate limiter token", {
        remaining: this.rateLimiter.tokens,
        max: this.rateLimiter.tokensPerInterval,
      })

      return { success: true }
    }

    // No tokens available
    this.#logger.warn("Rate limit exceeded", {
      availableTokens: 0,
      maxTokens: this.rateLimiter.tokensPerInterval,
      nextRefillIn:
        this.rateLimiter.interval - (now - this.rateLimiter.lastRefill),
    })

    return { success: false }
  }

  /**
   * Get the current status of the rate limiter
   *
   * @returns Rate limiter status information
   */
  getRateLimiterStatus(): RateLimiterStatus {
    const now = Date.now()
    const elapsed = now - this.rateLimiter.lastRefill

    // If enough time has passed for a complete refill
    if (elapsed >= this.rateLimiter.interval) {
      return {
        availableTokens: this.rateLimiter.tokensPerInterval,
        maxTokens: this.rateLimiter.tokensPerInterval,
        resetInMs: this.rateLimiter.interval,
      }
    }

    // Otherwise return current state
    return {
      availableTokens: this.rateLimiter.tokens,
      maxTokens: this.rateLimiter.tokensPerInterval,
      resetInMs: this.rateLimiter.interval - elapsed,
    }
  }

  /**
   * Retrieve a cached embedding or generate a new one
   *
   * @param text - Text to generate embedding for
   * @returns Embedding vector
   */
  async _getCachedEmbeddingOrGenerate(text: string): Promise<number[]> {
    const cacheKey = this._generateCacheKey(text)

    // Try to get from cache first
    const cachedValue = this.cache.get(cacheKey)

    if (cachedValue) {
      this.#logger.debug("Cache hit", {
        textHash: cacheKey.substring(0, CACHE_KEY_PREVIEW_LENGTH),
        age: Date.now() - cachedValue.timestamp,
      })
      return cachedValue.embedding
    }

    this.#logger.debug("Cache miss", {
      textHash: cacheKey.substring(0, CACHE_KEY_PREVIEW_LENGTH),
    })

    try {
      // Generate new embedding
      const embedding = await this.#embeddingService.generateEmbedding(text)

      // Store in cache
      this.#cacheEmbedding(text, embedding)

      return embedding
    } catch (error) {
      this.#logger.error("Failed to generate embedding", {
        error,
        textLength: text.length,
      })
      throw error
    }
  }

  /**
   * Store an embedding in the cache
   *
   * @private
   * @param text - Original text
   * @param embedding - Embedding vector
   */
  #cacheEmbedding(text: string, embedding: number[]): void {
    const cacheKey = this._generateCacheKey(text)
    const modelInfo = this.#embeddingService.getModelInfo()

    this.cache.set(cacheKey, {
      embedding,
      timestamp: Date.now(),
      model: modelInfo.name,
    })

    this.#logger.debug("Cached embedding", {
      textHash: cacheKey.substring(0, CACHE_KEY_PREVIEW_LENGTH),
      model: modelInfo.name,
      dimensions: embedding.length,
    })
  }

  /**
   * Generate a deterministic cache key for text
   *
   * @private
   * @param text - Text to hash
   * @returns Cache key
   */
  _generateCacheKey(text: string): string {
    return crypto.createHash("md5").update(text).digest("hex")
  }

  /**
   * Prepare text for embedding from an entity
   *
   * @private
   * @param entity - Entity to prepare text from
   * @returns Processed text ready for embedding
   */
  #prepareEntityText(entity: Entity): string {
    // Create a descriptive text from entity data
    const lines = [
      `Name: ${entity.name}`,
      `Type: ${entity.entityType}`,
      "Observations:",
    ]

    // Add observations, ensuring we handle both string arrays and other formats
    if (entity.observations) {
      // Handle case where observations might be stored as JSON string in some providers
      let observationsArray = entity.observations

      // If observations is a string, try to parse it as JSON
      if (typeof entity.observations === "string") {
        try {
          observationsArray = JSON.parse(entity.observations)
        } catch {
          // If parsing fails, treat it as a single observation
          observationsArray = [entity.observations]
        }
      }

      // Ensure it's an array at this point
      if (!Array.isArray(observationsArray)) {
        observationsArray = [String(observationsArray)]
      }

      // Add each observation to the text
      if (observationsArray.length > 0) {
        lines.push(...observationsArray.map((obs) => `- ${obs}`))
      } else {
        lines.push("  (No observations)")
      }
    } else {
      lines.push("  (No observations)")
    }

    const text = lines.join("\n")

    // Log the prepared text for debugging
    this.#logger.debug("Prepared entity text for embedding", {
      entityName: entity.name,
      entityType: entity.entityType,
      observationCount: Array.isArray(entity.observations)
        ? entity.observations.length
        : 0,
      textLength: text.length,
    })

    return text
  }

  /**
   * Get a cached embedding entry (used for testing)
   *
   * @param key - Cache key
   * @returns Cached embedding or undefined
   */
  getCacheEntry(key: string): CachedEmbedding | undefined {
    return this.cache.get(key)
  }
}
