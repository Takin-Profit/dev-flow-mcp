/**
 * Shared Type Schemas
 *
 * This module contains shared ArkType schemas that are used across multiple type files.
 * These are extracted here to avoid circular dependencies.
 *
 * ## Validation Rules
 *
 * ### Entity Name
 * - Must be non-empty strings (1-200 characters)
 * - Allowed characters: letters (a-z, A-Z), numbers (0-9), underscores (_), hyphens (-)
 * - Must start with a letter or underscore (not a number or hyphen)
 * - No spaces or special characters allowed
 * - Pattern: `/^[a-zA-Z_][a-zA-Z0-9_-]*$/`
 * - Examples:
 *   - ✅ Valid: "UserService", "user_repository", "Auth-Module", "_internal"
 *   - ❌ Invalid: "User Service" (space), "123user" (starts with number), "user@service" (special char)
 */

import { type } from "arktype"

/**
 * Valid entity name pattern
 * - Starts with letter or underscore
 * - Followed by any combination of letters, numbers, underscores, or hyphens
 */
const ENTITY_NAME_PATTERN = /^[a-zA-Z_][a-zA-Z0-9_-]*$/

/**
 * Maximum length for entity names (characters)
 */
const MAX_ENTITY_NAME_LENGTH = 200

/**
 * Maximum length for observation strings (characters)
 */
const MAX_OBSERVATION_LENGTH = 5000

/**
 * Entity name with strict validation
 * Used by Entity and Relation schemas
 */
export const EntityName = type("string").narrow((name, ctx) => {
  if (name.length === 0) {
    return ctx.mustBe("a non-empty string")
  }
  if (name.length > MAX_ENTITY_NAME_LENGTH) {
    return ctx.mustBe(`at most ${MAX_ENTITY_NAME_LENGTH} characters`)
  }
  if (!ENTITY_NAME_PATTERN.test(name)) {
    return ctx.mustBe(
      "a valid entity name (letters, numbers, underscores, hyphens; must start with letter or underscore)"
    )
  }
  return true
})

export type EntityName = typeof EntityName.infer

/**
 * Observation - must be non-empty strings
 */
export const Observation = type("string").narrow((obs, ctx) => {
  if (obs.length === 0) {
    return ctx.mustBe("a non-empty observation string")
  }
  if (obs.length > MAX_OBSERVATION_LENGTH) {
    return ctx.mustBe(`at most ${MAX_OBSERVATION_LENGTH} characters`)
  }
  return true
})

export type Observation = typeof Observation.infer
