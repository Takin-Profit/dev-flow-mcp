/**
 * Application-wide Constants
 * Centralized location for magic numbers and reusable constants
 */

// ============================================================================
// Time Constants
// ============================================================================

/**
 * Milliseconds per second
 */
export const MILLISECONDS_PER_SECOND = 1000

/**
 * Seconds per minute
 */
export const SECONDS_PER_MINUTE = 60

/**
 * Minutes per hour
 */
export const MINUTES_PER_HOUR = 60

/**
 * Hours per day
 */
export const HOURS_PER_DAY = 24

/**
 * Days per week
 */
export const DAYS_PER_WEEK = 7

/**
 * Milliseconds per day (24 * 60 * 60 * 1000)
 */
export const MILLISECONDS_PER_DAY =
  HOURS_PER_DAY *
  MINUTES_PER_HOUR *
  SECONDS_PER_MINUTE *
  MILLISECONDS_PER_SECOND

/**
 * Thirty days in milliseconds
 */

// biome-ignore lint/style/noMagicNumbers: this is fine
export const THIRTY_DAYS_MS = 30 * MILLISECONDS_PER_DAY

// ============================================================================
// Embedding Constants
// ============================================================================

/**
 * Default vector dimensions for OpenAI text-embedding-3-small model
 */
export const DEFAULT_VECTOR_DIMENSIONS = 1536

/**
 * Vector dimensions for mock/test embeddings (MiniLM-based)
 */
export const DFM_MOCK_DIMENSIONS = 384

/**
 * Maximum allowed vector dimensions for validation
 */
export const MAX_VECTOR_DIMENSIONS = 10_000

/**
 * Number of characters to show in debug log text previews
 */
export const TEXT_PREVIEW_LENGTH = 50

/**
 * Random seed multiplier for deterministic mock embeddings
 */
export const RANDOM_SEED_MULTIPLIER = 10_000

/**
 * Bit shift amount for hash function
 */
export const HASH_BIT_SHIFT = 5

// ============================================================================
// Rate Limiting Constants
// ============================================================================

/**
 * Default rate limit tokens per interval for OpenAI API (150k tokens)
 */
export const DEFAULT_RATE_LIMIT_TOKENS = 150_000

/**
 * Default rate limit interval in milliseconds (60 seconds)
 */
export const DEFAULT_RATE_LIMIT_INTERVAL = 60_000

/**
 * Default rate limit tokens for embedding job manager
 * (lower than API limit to be conservative)
 */
export const DEFAULT_JOB_RATE_LIMIT_TOKENS = 60

// ============================================================================
// Cache Constants
// ============================================================================

/**
 * Default maximum number of items in embedding cache
 */
export const DEFAULT_CACHE_SIZE = 1000

/**
 * Number of characters to preview in cache key logs
 */
export const CACHE_KEY_PREVIEW_LENGTH = 8

// ============================================================================
// Job Processing Constants
// ============================================================================

/**
 * Maximum number of retry attempts for failed jobs
 */
export const DEFAULT_MAX_ATTEMPTS = 3

/**
 * Initial attempt count for new jobs
 */
export const DEFAULT_INITIAL_ATTEMPTS = 0

// ============================================================================
// Search Constants
// ============================================================================

/**
 * Default maximum number of search results
 */
export const DEFAULT_SEARCH_LIMIT = 10

/**
 * Default minimum similarity threshold for general searches
 */
export const DEFAULT_MIN_SIMILARITY = 0.6

/**
 * Knowledge graph manager minimum similarity threshold
 */
export const KG_MANAGER_MIN_SIMILARITY = 0.7

/**
 * Fallback threshold for knowledge graph searches
 */
export const KG_MANAGER_FALLBACK_THRESHOLD = 0.5

// ============================================================================
// Validation Constants
// ============================================================================

/**
 * Maximum length for entity names
 */
export const MAX_ENTITY_NAME_LENGTH = 200

/**
 * Maximum length for observation strings
 */
export const MAX_OBSERVATION_LENGTH = 5000

// ============================================================================
// Neo4j Storage Constants
// ============================================================================

/**
 * Default half-life for temporal decay calculations (days)
 */
export const DEFAULT_HALF_LIFE_DAYS = 30

/**
 * Minimum confidence value for relations
 */
export const DEFAULT_MIN_CONFIDENCE = 0.1

/**
 * Default strength value for new relations
 */
export const DEFAULT_RELATION_STRENGTH = 0.9

/**
 * Default confidence value for new relations
 */
export const DEFAULT_RELATION_CONFIDENCE = 0.95

/**
 * Number of items to sample for diagnostics
 */
export const DIAGNOSTIC_SAMPLE_SIZE = 3

/**
 * Half-life decay constant (ln(2) / half-life)
 */
export const HALF_LIFE_DECAY_CONSTANT = 0.5

// ============================================================================
// HTTP Timeout Constants
// ============================================================================

/**
 * Default timeout for single embedding API requests (30 seconds)
 */
export const EMBEDDING_REQUEST_TIMEOUT_MS = 30_000

/**
 * Default timeout for batch embedding API requests (60 seconds)
 */
export const EMBEDDING_BATCH_TIMEOUT_MS = 60_000

// ============================================================================
// SQLite Storage Constants
// ============================================================================

/**
 * Default search limit for SQLite text search
 */
export const SQLITE_DEFAULT_SEARCH_LIMIT = 50

/**
 * Default maximum depth for graph traversal
 */
export const SQLITE_DEFAULT_TRAVERSAL_DEPTH = 3

// ============================================================================
// CLI Constants
// ============================================================================

/**
 * Start index for bash completion arguments
 */
export const COMPLETION_ARGS_START_INDEX = 3
