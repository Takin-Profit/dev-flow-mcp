/**
 * Logger Type Definitions
 *
 * Defines the contract for logging throughout the application.
 * Implementations can be Winston, Consola, or mock loggers for testing.
 *
 * Design Principle: Depend on abstractions, not concretions.
 * Classes should accept Logger type, not concrete implementations.
 */

/**
 * Metadata object for structured logging
 */
export type LogMetadata = Record<string, unknown>

/**
 * Logger type for application-wide logging
 *
 * All logging operations should go through this type to enable:
 * - Dependency injection
 * - Testing with mock loggers
 * - Swapping implementations without changing business logic
 */
export type Logger = {
  /**
   * Log informational messages
   * Use for: normal operations, state changes, milestones
   */
  info(message: string, meta?: LogMetadata): void

  /**
   * Log error messages
   * Use for: exceptions, failures, critical issues
   */
  error(message: string, error?: Error | unknown, meta?: LogMetadata): void

  /**
   * Log warning messages
   * Use for: deprecated features, recoverable issues, potential problems
   */
  warn(message: string, meta?: LogMetadata): void

  /**
   * Log debug messages
   * Use for: detailed diagnostic information, troubleshooting
   */
  debug(message: string, meta?: LogMetadata): void
}

/**
 * No-op logger for testing or when logging is disabled
 */
export const createNoOpLogger = (): Logger => ({
  info: (_message: string, _meta?: LogMetadata): void => {},
  error: (_message: string, _error?: Error | unknown, _meta?: LogMetadata): void => {},
  warn: (_message: string, _meta?: LogMetadata): void => {},
  debug: (_message: string, _meta?: LogMetadata): void => {},
})
