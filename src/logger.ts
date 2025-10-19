/**
 * Application Logging
 * - logger: Winston-based file logging for the MCP server (avoids stdio interference)
 * - cliLogger: Consola-based CLI output for user-facing tools (with colors/emojis)
 *
 * This module provides concrete implementations of the Logger interface.
 * Business logic should depend on the Logger type, not these implementations directly.
 */
/** biome-ignore-all lint/suspicious/noEmptyBlockStatements: noOpLogger */

import path from "node:path"
import { consola } from "consola"
import winston from "winston"
import DailyRotateFile from "winston-daily-rotate-file"
import { getLogDir } from "#config"
import type { Logger } from "#types"

// Get log directory from config (uses XDG paths)
const LOG_DIR = getLogDir()

// Log levels - can be overridden via DFM_LOG_LEVEL environment variable
const LOG_LEVEL = process.env.DFM_LOG_LEVEL ?? "info"

// Format for file logs (JSON for easy parsing)
const fileFormat = winston.format.combine(
  winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
  winston.format.errors({ stack: true }),
  winston.format.json()
)

// Format for console logs (human-readable, only used in development/debugging)
const consoleFormat = winston.format.combine(
  winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
  winston.format.colorize(),
  winston.format.errors({ stack: true }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    const metaStr =
      Object.keys(meta).length > 0 ? `\n${JSON.stringify(meta, null, 2)}` : ""
    return `${timestamp} [${level}]: ${message}${metaStr}`
  })
)

// Daily rotate file transport for error logs
const errorFileTransport = new DailyRotateFile({
  filename: path.join(LOG_DIR, "error-%DATE%.log"),
  datePattern: "YYYY-MM-DD",
  level: "error",
  maxFiles: "30d", // Keep error logs for 30 days
  maxSize: "20m",
  format: fileFormat,
  handleExceptions: true,
  handleRejections: true,
})

// Daily rotate file transport for combined logs
const combinedFileTransport = new DailyRotateFile({
  filename: path.join(LOG_DIR, "combined-%DATE%.log"),
  datePattern: "YYYY-MM-DD",
  maxFiles: "14d", // Keep combined logs for 14 days
  maxSize: "20m",
  format: fileFormat,
})

// Create Winston logger instance
const winstonLogger = winston.createLogger({
  level: LOG_LEVEL,
  transports: [errorFileTransport, combinedFileTransport],
  exitOnError: false,
})

// Add console transport only in development or when explicitly enabled via DFM_ENABLE_CONSOLE_LOGS
// IMPORTANT: This should NOT be used in production MCP server context
// as it will interfere with stdio communication
const ENABLE_CONSOLE_LOGS = process.env.DFM_ENABLE_CONSOLE_LOGS === "true"
if (ENABLE_CONSOLE_LOGS) {
  winstonLogger.add(
    new winston.transports.Console({
      format: consoleFormat,
      stderrLevels: ["error", "warn", "info", "debug"],
    })
  )
}

/**
 * Winston-based logger implementation
 * This provides structured logging with file rotation for the MCP server
 *
 * Implements the Logger interface for dependency injection
 */
export const logger: Logger = {
  /**
   * Log an error message
   */
  error: (
    message: string,
    error?: Error | unknown,
    meta?: Record<string, unknown>
  ) => {
    if (error instanceof Error) {
      winstonLogger.error(message, {
        error: error.message,
        stack: error.stack,
        ...meta,
      })
    } else if (error) {
      winstonLogger.error(message, { error, ...meta })
    } else {
      winstonLogger.error(message, meta)
    }
  },

  /**
   * Log a warning message
   */
  warn: (message: string, meta?: Record<string, unknown>) => {
    winstonLogger.warn(message, meta)
  },

  /**
   * Log an info message
   */
  info: (message: string, meta?: Record<string, unknown>) => {
    winstonLogger.info(message, meta)
  },

  /**
   * Log a debug message
   */
  debug: (message: string, meta?: Record<string, unknown>) => {
    winstonLogger.debug(message, meta)
  },

  /**
   * Log a trace message (lowest level, most detailed)
   */
  trace: (message: string, meta?: Record<string, unknown>) => {
    // Winston doesn't have a trace level by default, map it to debug
    winstonLogger.debug(message, { level: "trace", ...meta })
  },
}

/**
 * Get the underlying Winston logger instance
 * Use this if you need access to advanced Winston features
 * (not part of the Logger interface, use sparingly)
 */
export const getWinstonInstance = (): winston.Logger => winstonLogger

// ============================================================================
// CLI Logger (Consola)
// ============================================================================

/**
 * CLI logger for user-facing output
 * Provides formatted output with emojis and colors for better UX
 * Use this for CLI tools, NOT for the MCP server
 */
export const cliLogger = {
  success: (message: string, ...args: unknown[]) =>
    consola.success(message, ...args),
  error: (message: string, error?: Error | unknown) => {
    if (error instanceof Error) {
      consola.error(message, error)
    } else if (error) {
      consola.error(message, error)
    } else {
      consola.error(message)
    }
  },
  warn: (message: string, ...args: unknown[]) => consola.warn(message, ...args),
  info: (message: string, ...args: unknown[]) => consola.info(message, ...args),
  debug: (message: string, ...args: unknown[]) =>
    consola.debug(message, ...args),
  start: (message: string) => consola.start(message),
  box: (message: string) => consola.box(message),
  getInstance: () => consola,
}

export type CliLogger = typeof cliLogger

/**
 * No-op logger for testing or when logging is disabled
 */
export const createNoOpLogger = (): Logger => ({
  info: (_message: string, _meta?: Record<string, unknown>): void => {},
  error: (
    _message: string,
    _error?: Error | unknown,
    _meta?: Record<string, unknown>
  ): void => {},
  warn: (_message: string, _meta?: Record<string, unknown>): void => {},
  debug: (_message: string, _meta?: Record<string, unknown>): void => {},
  trace: (_message: string, _meta?: Record<string, unknown>): void => {},
})
