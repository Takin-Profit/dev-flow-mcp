/**
 * Logger Types
 * Type definitions for logging across the application
 */
/** biome-ignore-all lint/suspicious/noEmptyBlockStatements: noop logger */

/**
 * Metadata that can be attached to log messages
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

  /**
   * Log trace messages (lowest level, most detailed)
   * Use for: very detailed diagnostic information, function entry/exit
   */
  trace(message: string, meta?: LogMetadata): void
}

/**
 * No-op logger for testing or when logging is disabled
 */
export const createNoOpLogger = (): Logger => ({
  info: (_message: string, _meta?: LogMetadata): void => {},
  error: (
    _message: string,
    _error?: Error | unknown,
    _meta?: LogMetadata
  ): void => {},
  warn: (_message: string, _meta?: LogMetadata): void => {},
  debug: (_message: string, _meta?: LogMetadata): void => {},
  trace: (_message: string, _meta?: LogMetadata): void => {},
})
