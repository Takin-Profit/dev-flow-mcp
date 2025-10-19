# DevFlow MCP: Type Safety & Standardization Refactoring Plan

**Branch**: `sqlite`
**Status**: Planning Phase
**Priority**: BLOCKER for testing and production readiness

---

## Executive Summary

This document outlines a comprehensive refactoring to establish type safety, validation consistency, and standardized patterns across the DevFlow MCP codebase. The current state has inconsistent validation (ArkType + Zod + manual), no branded types for domain concepts, inconsistent error handling, and ad-hoc response formatting. This blocks effective testing and introduces maintainability risks.

**Goal**: Create a fully type-safe, testable, maintainable codebase with zero runtime type errors and user-friendly error messages.

---

## Current State Analysis

### Problems Identified

1. **Dual Validation Systems**
   - ArkType used in: `src/types/shared.ts`, `src/types/entity.ts`, `src/types/relation.ts`, `src/types/knowledge-graph.ts`, `src/types/database.ts`, `src/types/embedding.ts`
   - Zod used in: `src/types/validation.ts` (comprehensive but unused)
   - Result: 10 ArkType imports, duplicate validation logic, confusion about which to use

2. **Manual Validation Functions**
   - 19 usages of `validateString`, `validateArray`, `validateNumber` in handlers
   - Located primarily in: `src/server/handlers/call-tool-handler.ts`
   - No type safety, arbitrary error messages, inconsistent validation

3. **No Branded Types**
   - Strings used for: entity names, relation types, entity types
   - Numbers used for: timestamps, version numbers, confidence scores
   - Result: No compile-time safety, easy to mix up parameters

4. **Inconsistent Response Formats**
   - `delete_entities`: Plain text → JSON (just changed)
   - `delete_observations`: Plain text
   - `delete_relations`: Plain text
   - `read_graph`: JSON
   - `create_entities`: JSON array
   - No standard success/error shape

5. **Inconsistent Input Patterns**
   - `delete_entities`: `{ entityNames: string[] }`
   - `delete_observations`: `{ deletions: [{ entityName, observations }] }`
   - `add_observations`: `{ entityName, contents }`
   - Similar operations have different parameter structures

6. **Ad-Hoc Error Handling**
   - Mix of thrown errors, returned errors, MCP errors
   - No error codes or structured error responses
   - Tests check substring matches in error messages (brittle)
   - Error messages not user-friendly

7. **No Response Builders**
   - Tool responses built manually inline
   - Duplicate `{ content: [{ type: "text", text: ... }] }` everywhere
   - No type safety for MCP protocol responses

---

## Solution Design

### Phase 0: Dependencies

**Add new dependencies:**
```bash
pnpm add zod-validation-error
```

**Remove deprecated dependencies:**
```bash
pnpm remove arktype arkenv
```

---

### Phase 1: Foundation - Zod Migration & Branded Types

**Objective**: Establish single source of truth for validation using Zod with branded types

#### 1.1 Configure Zod with zod-validation-error (src/config/zod-config.ts)

```typescript
import { z } from "zod"
import { createErrorMap } from "zod-validation-error"

/**
 * Global Zod configuration with user-friendly error messages
 *
 * This configures Zod to use zod-validation-error's error map for
 * producing human-readable validation error messages.
 */
z.setErrorMap(
  createErrorMap({
    // Show detailed format information (e.g., regex patterns) in dev mode only
    maxIssuesInMessage: 5,

    // Display configuration for allowed values
    maxAllowedValuesToDisplay: 10,
    allowedValuesSeparator: ", ",
    allowedValuesLastSeparator: " or ",
    wrapAllowedValuesInQuote: true,

    // Display configuration for unrecognized keys
    maxUnrecognizedKeysToDisplay: 5,
    unrecognizedKeysSeparator: ", ",
    unrecognizedKeysLastSeparator: " and ",
    wrapUnrecognizedKeysInQuote: true,

    // Localization
    dateLocalization: true,
    numberLocalization: true,
  })
)

// Re-export configured Zod
export { z }
```

**Import this configured Zod everywhere:**
```typescript
// Instead of:
import { z } from "zod"

// Use:
import { z } from "#config/zod-config.js"
```

#### 1.2 Expand Zod Schemas (src/types/validation.ts)

Add missing branded types:

```typescript
import { z } from "#config/zod-config.js"

/**
 * Constants for validation rules
 */
export const VALIDATION_CONSTANTS = {
  /** Maximum length for entity names */
  MAX_ENTITY_NAME_LENGTH: 200,

  /** Maximum length for observation strings */
  MAX_OBSERVATION_LENGTH: 5000,

  /** Maximum vector dimensions for embeddings */
  MAX_VECTOR_DIMENSIONS: 10_000,

  /** Valid entity name pattern: starts with letter/underscore, then alphanumeric + _ or - */
  ENTITY_NAME_PATTERN: /^[a-zA-Z_][a-zA-Z0-9_-]*$/,
} as const

// Branded primitive types
export const TimestampSchema = z.number().int().nonnegative().brand<"Timestamp">()
export type Timestamp = z.infer<typeof TimestampSchema>

export const VersionSchema = z.number().int().positive().brand<"Version">()
export type Version = z.infer<typeof VersionSchema>

export const ConfidenceScoreSchema = z.number().min(0).max(1).brand<"ConfidenceScore">()
export type ConfidenceScore = z.infer<typeof ConfidenceScoreSchema>

export const StrengthScoreSchema = z.number().min(0).max(1).brand<"StrengthScore">()
export type StrengthScore = z.infer<typeof StrengthScoreSchema>

export const EntityIdSchema = z.string().uuid().brand<"EntityId">()
export type EntityId = z.infer<typeof EntityIdSchema>

export const RelationIdSchema = z.string().brand<"RelationId">()
export type RelationId = z.infer<typeof RelationIdSchema>

/**
 * Entity Name Schema
 *
 * Rules:
 * - Must be non-empty strings (1-200 characters)
 * - Allowed characters: letters (a-z, A-Z), numbers (0-9), underscores (_), hyphens (-)
 * - Must start with a letter or underscore (not a number or hyphen)
 * - No spaces or special characters allowed
 *
 * Examples:
 * - ✅ Valid: "UserService", "user_repository", "Auth-Module", "_internal"
 * - ❌ Invalid: "User Service" (space), "123user" (starts with number), "user@service" (special char)
 */
export const EntityNameSchema = z
  .string()
  .min(1, "Entity name cannot be empty")
  .max(
    VALIDATION_CONSTANTS.MAX_ENTITY_NAME_LENGTH,
    `Entity name cannot exceed ${VALIDATION_CONSTANTS.MAX_ENTITY_NAME_LENGTH} characters`
  )
  .regex(
    VALIDATION_CONSTANTS.ENTITY_NAME_PATTERN,
    "Entity name must start with a letter or underscore, followed by alphanumeric characters, underscores, or hyphens"
  )
  .brand<"EntityName">()

export type EntityName = z.infer<typeof EntityNameSchema>

// ... rest of existing schemas from validation.ts ...

/**
 * Refine existing types to use branded primitives
 */
export const RelationMetadataSchema = z
  .object({
    createdAt: TimestampSchema,
    updatedAt: TimestampSchema,
    inferredFrom: z.array(RelationIdSchema).optional(),
    lastAccessed: TimestampSchema.optional(),
  })
  .strict()
  .refine((data) => data.updatedAt >= data.createdAt, {
    message: "updatedAt must be greater than or equal to createdAt",
    path: ["updatedAt"],
  })

export const RelationSchema = z
  .object({
    from: EntityNameSchema,
    to: EntityNameSchema,
    relationType: RelationTypeSchema,
    strength: StrengthScoreSchema.optional(),
    confidence: ConfidenceScoreSchema.optional(),
    metadata: RelationMetadataSchema.optional(),
  })
  .strict()
  .refine((data) => data.from !== data.to, {
    message: "Relation cannot connect an entity to itself",
    path: ["to"],
  })

export const TemporalEntitySchema = EntitySchema.extend({
  id: EntityIdSchema.optional(),
  version: VersionSchema,
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
  validFrom: TimestampSchema.optional(),
  validTo: TimestampSchema.nullable().optional(),
  changedBy: z.string().nullable().optional(),
}).refine((data) => data.updatedAt >= data.createdAt, {
  message: "updatedAt must be greater than or equal to createdAt",
  path: ["updatedAt"],
})
```

#### 1.3 Tool Input/Output Schemas

Create Zod schemas for ALL tool inputs and outputs:

```typescript
// Tool Input Schemas
export const CreateEntitiesInputSchema = z.object({
  entities: z.array(EntitySchema).min(1, "Must provide at least one entity"),
}).strict()

export const DeleteEntitiesInputSchema = z.object({
  entityNames: z.array(EntityNameSchema).min(1, "Must provide at least one entity name"),
}).strict()

export const AddObservationsInputSchema = z.object({
  entityName: EntityNameSchema,
  contents: z.array(ObservationSchema).min(1, "Must provide at least one observation"),
}).strict()

export const DeleteObservationsInputSchema = z.object({
  deletions: z.array(z.object({
    entityName: EntityNameSchema,
    observations: z.array(ObservationSchema).min(1),
  })).min(1, "Must provide at least one deletion"),
}).strict()

export const CreateRelationsInputSchema = z.object({
  relations: z.array(RelationSchema).min(1, "Must provide at least one relation"),
}).strict()

export const DeleteRelationsInputSchema = z.object({
  relations: z.array(RelationSchema).min(1, "Must provide at least one relation"),
}).strict()

export const SearchNodesInputSchema = z.object({
  query: z.string().min(1, "Search query cannot be empty"),
}).strict()

export const SemanticSearchInputSchema = z.object({
  query: z.string().min(1, "Search query cannot be empty"),
  limit: z.number().int().positive().optional(),
  minSimilarity: ConfidenceScoreSchema.optional(),
  entityTypes: z.array(EntityTypeSchema).optional(),
  hybridSearch: z.boolean().optional(),
  semanticWeight: z.number().min(0).max(1).optional(),
}).strict()

export const GetRelationInputSchema = z.object({
  from: EntityNameSchema,
  to: EntityNameSchema,
  relationType: RelationTypeSchema,
}).strict()

export const UpdateRelationInputSchema = z.object({
  from: EntityNameSchema,
  to: EntityNameSchema,
  relationType: RelationTypeSchema,
  strength: StrengthScoreSchema.optional(),
  confidence: ConfidenceScoreSchema.optional(),
  metadata: RelationMetadataSchema.optional(),
}).strict()

export const OpenNodesInputSchema = z.object({
  names: z.array(EntityNameSchema).min(1, "Must provide at least one entity name"),
}).strict()

export const GetEntityHistoryInputSchema = z.object({
  entityName: EntityNameSchema,
}).strict()

export const GetRelationHistoryInputSchema = z.object({
  from: EntityNameSchema,
  to: EntityNameSchema,
  relationType: RelationTypeSchema,
}).strict()

export const GetGraphAtTimeInputSchema = z.object({
  timestamp: TimestampSchema,
}).strict()

export const GetEntityEmbeddingInputSchema = z.object({
  entityName: EntityNameSchema,
}).strict()
```

#### 1.4 Remove ArkType Dependencies

**Files to delete**:
- `src/types/shared.ts` - DELETE entirely (functionality moved to validation.ts)

**Files to refactor** (remove ArkType, use Zod):
- `src/types/entity.ts`
- `src/types/relation.ts`
- `src/types/knowledge-graph.ts`
- `src/types/database.ts`
- `src/types/embedding.ts`
- `src/server/handlers/tool-handlers.ts`
- `src/utils/fetch.ts`
- `src/embeddings/openai-embedding-service.ts`

**Dependencies to remove**:
```bash
pnpm remove arktype arkenv
```

---

### Phase 2: Standardized Response System

**Objective**: Create type-safe, consistent response builders for all tool operations

#### 2.1 Response Type Definitions (src/types/responses.ts)

```typescript
import { z } from "#config/zod-config.js"
import type { Entity, Relation, KnowledgeGraph, TemporalEntity } from "./validation.js"

/**
 * Standard MCP Tool Response envelope
 */
export const MCPToolResponseSchema = z.object({
  content: z.array(z.object({
    type: z.literal("text"),
    text: z.string(),
  })),
})

export type MCPToolResponse = z.infer<typeof MCPToolResponseSchema>

/**
 * Success response with data payload
 */
export interface SuccessResponse<T = unknown> {
  success: true
  data: T
}

/**
 * Error response with structured error info
 */
export interface ErrorResponse {
  success: false
  error: {
    code: ErrorCode
    message: string
    details?: Record<string, unknown>
  }
}

/**
 * Standardized error codes
 */
export enum ErrorCode {
  // Validation errors (4xx equivalent)
  INVALID_INPUT = "INVALID_INPUT",
  INVALID_ENTITY_NAME = "INVALID_ENTITY_NAME",
  INVALID_ENTITY_TYPE = "INVALID_ENTITY_TYPE",
  INVALID_RELATION_TYPE = "INVALID_RELATION_TYPE",
  INVALID_OBSERVATIONS = "INVALID_OBSERVATIONS",
  INVALID_STRENGTH = "INVALID_STRENGTH",
  INVALID_CONFIDENCE = "INVALID_CONFIDENCE",
  EMPTY_ARRAY = "EMPTY_ARRAY",

  // Not found errors
  ENTITY_NOT_FOUND = "ENTITY_NOT_FOUND",
  RELATION_NOT_FOUND = "RELATION_NOT_FOUND",

  // Conflict errors
  ENTITY_ALREADY_EXISTS = "ENTITY_ALREADY_EXISTS",
  RELATION_ALREADY_EXISTS = "RELATION_ALREADY_EXISTS",

  // Internal errors (5xx equivalent)
  DATABASE_ERROR = "DATABASE_ERROR",
  EMBEDDING_ERROR = "EMBEDDING_ERROR",
  INTERNAL_ERROR = "INTERNAL_ERROR",
}

/**
 * Tool-specific response types
 */
export type CreateEntitiesResponse = SuccessResponse<{
  created: number
  entities: Entity[]
}>

export type DeleteEntitiesResponse = SuccessResponse<{
  deleted: number
  entityNames: string[]
}>

export type ReadGraphResponse = SuccessResponse<KnowledgeGraph>

export type AddObservationsResponse = SuccessResponse<{
  entityName: string
  added: number
  totalObservations: number
}>

export type DeleteObservationsResponse = SuccessResponse<{
  deleted: number
  entities: Array<{
    entityName: string
    deletedCount: number
  }>
}>

export type CreateRelationsResponse = SuccessResponse<{
  created: number
  relations: Relation[]
}>

export type DeleteRelationsResponse = SuccessResponse<{
  deleted: number
}>

export type SearchNodesResponse = SuccessResponse<{
  results: Entity[]
  count: number
}>

export type SemanticSearchResponse = SuccessResponse<{
  results: Array<{
    entity: Entity
    similarity: number
  }>
  count: number
}>

export type GetRelationResponse = SuccessResponse<Relation | null>

export type UpdateRelationResponse = SuccessResponse<Relation>

export type OpenNodesResponse = SuccessResponse<{
  nodes: Entity[]
  found: number
  notFound: string[]
}>

export type GetEntityHistoryResponse = SuccessResponse<{
  entityName: string
  history: TemporalEntity[]
  totalVersions: number
}>

export type GetRelationHistoryResponse = SuccessResponse<{
  from: string
  to: string
  relationType: string
  history: TemporalEntity[]
  totalVersions: number
}>

export type GetGraphAtTimeResponse = SuccessResponse<{
  timestamp: number
  graph: KnowledgeGraph
}>

export type GetDecayedGraphResponse = SuccessResponse<KnowledgeGraph>

export type GetEntityEmbeddingResponse = SuccessResponse<{
  entityName: string
  embedding: number[]
  model: string
}>
```

#### 2.2 Response Builder Utilities (src/utils/response-builders.ts)

```typescript
import { fromError, fromZodError } from "zod-validation-error"
import type { ZodError } from "zod"
import type {
  MCPToolResponse,
  SuccessResponse,
  ErrorResponse,
  ErrorCode,
} from "#types/responses.js"

/**
 * Build a successful MCP tool response
 */
export function buildSuccessResponse<T>(data: T): MCPToolResponse {
  const response: SuccessResponse<T> = {
    success: true,
    data,
  }

  return {
    content: [{
      type: "text",
      text: JSON.stringify(response, null, 2),
    }],
  }
}

/**
 * Build an error MCP tool response
 */
export function buildErrorResponse(
  code: ErrorCode,
  message: string,
  details?: Record<string, unknown>
): MCPToolResponse {
  const response: ErrorResponse = {
    success: false,
    error: {
      code,
      message,
      details,
    },
  }

  return {
    content: [{
      type: "text",
      text: JSON.stringify(response, null, 2),
    }],
  }
}

/**
 * Build error from Zod validation failure
 * Uses zod-validation-error for user-friendly messages
 */
export function buildValidationErrorResponse(zodError: ZodError): MCPToolResponse {
  // Convert Zod error to user-friendly ValidationError
  const validationError = fromZodError(zodError, {
    prefix: "Validation failed",
    prefixSeparator: ": ",
    includePath: true,
    maxIssuesInMessage: 5,
  })

  // Extract individual issues as details
  const details = zodError.errors.reduce((acc, err) => {
    const path = err.path.join('.')
    acc[path] = err.message
    return acc
  }, {} as Record<string, string>)

  return buildErrorResponse(
    ErrorCode.INVALID_INPUT,
    validationError.message,
    details
  )
}

/**
 * Build error from unknown error
 * Uses zod-validation-error's fromError for consistent handling
 */
export function buildErrorFromUnknown(error: unknown): MCPToolResponse {
  const validationError = fromError(error, {
    prefix: "Error",
    prefixSeparator: ": ",
    includePath: true,
  })

  return buildErrorResponse(
    ErrorCode.INTERNAL_ERROR,
    validationError.message,
    { cause: validationError.cause }
  )
}
```

#### 2.3 Update All Tool Handlers

Refactor every tool handler to:
1. Use Zod schemas for input validation
2. Use branded types internally
3. Use response builders for output
4. Use error codes instead of string messages

Example refactoring:

**Before:**
```typescript
export async function handleDeleteEntities(args: unknown, ...): Promise<...> {
  const validated = DeleteEntitiesArgsSchema(args)
  if (validated instanceof type.errors) {
    throw new Error(`Invalid arguments: ${validated}`)
  }

  await knowledgeGraphManager.deleteEntities(validated.entityNames)
  return {
    content: [{ type: "text", text: "Entities deleted successfully" }],
  }
}
```

**After:**
```typescript
import { DeleteEntitiesInputSchema } from "#types/validation.js"
import { buildSuccessResponse, buildValidationErrorResponse } from "#utils/response-builders.js"
import type { DeleteEntitiesResponse, MCPToolResponse } from "#types/responses.js"

export async function handleDeleteEntities(
  args: unknown,
  knowledgeGraphManager: KnowledgeGraphManager
): Promise<MCPToolResponse> {
  // Validate input
  const result = DeleteEntitiesInputSchema.safeParse(args)
  if (!result.success) {
    return buildValidationErrorResponse(result.error)
  }

  const { entityNames } = result.data

  // Perform operation
  await knowledgeGraphManager.deleteEntities(entityNames)

  // Build typed response
  const responseData: DeleteEntitiesResponse["data"] = {
    deleted: entityNames.length,
    entityNames: entityNames.map(name => name as string), // Extract from brand
  }

  return buildSuccessResponse(responseData)
}
```

---

### Phase 3: Error Handling Standardization

**Objective**: Consistent, testable error handling throughout the codebase

#### 3.1 Error Classes (src/errors/index.ts)

```typescript
import { ErrorCode } from "#types/responses.js"

/**
 * Base error class for all DevFlow MCP errors
 */
export class DFMError extends Error {
  constructor(
    public readonly code: ErrorCode,
    message: string,
    public readonly details?: Record<string, unknown>
  ) {
    super(message)
    this.name = "DFMError"
    Error.captureStackTrace(this, this.constructor)
  }
}

/**
 * Validation error
 */
export class ValidationError extends DFMError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(ErrorCode.INVALID_INPUT, message, details)
    this.name = "ValidationError"
  }
}

/**
 * Entity not found error
 */
export class EntityNotFoundError extends DFMError {
  constructor(entityName: string) {
    super(
      ErrorCode.ENTITY_NOT_FOUND,
      `Entity not found: ${entityName}`,
      { entityName }
    )
    this.name = "EntityNotFoundError"
  }
}

/**
 * Relation not found error
 */
export class RelationNotFoundError extends DFMError {
  constructor(from: string, to: string, relationType: string) {
    super(
      ErrorCode.RELATION_NOT_FOUND,
      `Relation not found: ${from} -[${relationType}]-> ${to}`,
      { from, to, relationType }
    )
    this.name = "RelationNotFoundError"
  }
}

/**
 * Database error
 */
export class DatabaseError extends DFMError {
  constructor(message: string, cause?: Error) {
    super(ErrorCode.DATABASE_ERROR, message, { cause: cause?.message })
    this.name = "DatabaseError"
  }
}

/**
 * Embedding service error
 */
export class EmbeddingError extends DFMError {
  constructor(message: string, cause?: Error) {
    super(ErrorCode.EMBEDDING_ERROR, message, { cause: cause?.message })
    this.name = "EmbeddingError"
  }
}
```

#### 3.2 Error Handler Middleware (src/utils/error-handler.ts)

```typescript
import { isValidationErrorLike } from "zod-validation-error"
import { buildErrorResponse, buildValidationErrorResponse, buildErrorFromUnknown } from "./response-builders.js"
import { DFMError } from "#errors"
import { ErrorCode } from "#types/responses.js"
import { logger } from "#logger"
import type { ZodError } from "zod"
import type { MCPToolResponse } from "#types/responses.js"

/**
 * Check if error is a Zod error
 */
function isZodError(error: unknown): error is ZodError {
  return (
    typeof error === "object" &&
    error !== null &&
    "issues" in error &&
    Array.isArray((error as any).issues)
  )
}

/**
 * Convert any error to a standard MCP error response
 */
export function handleError(error: unknown): MCPToolResponse {
  // Handle DFMError instances
  if (error instanceof DFMError) {
    return buildErrorResponse(error.code, error.message, error.details)
  }

  // Handle Zod validation errors
  if (isZodError(error)) {
    return buildValidationErrorResponse(error)
  }

  // Handle zod-validation-error ValidationError
  if (isValidationErrorLike(error)) {
    return buildErrorResponse(
      ErrorCode.INVALID_INPUT,
      error.message,
      { details: (error as any).details }
    )
  }

  // Unknown error - log and return generic error
  logger.error("Unexpected error", error)
  return buildErrorFromUnknown(error)
}

/**
 * Wrap handler function with error handling
 */
export function withErrorHandling<TArgs extends unknown[], TReturn>(
  handler: (...args: TArgs) => Promise<TReturn>
) {
  return async (...args: TArgs): Promise<TReturn | MCPToolResponse> => {
    try {
      return await handler(...args)
    } catch (error) {
      return handleError(error)
    }
  }
}
```

---

### Phase 4: Method Signature Updates

**Objective**: Replace all method signatures to use branded types

#### 4.1 KnowledgeGraphManager Interface Updates

**Before:**
```typescript
interface KnowledgeGraphManager {
  createEntities(entities: Entity[]): Promise<Entity[]>
  deleteEntities(entityNames: string[]): Promise<void>
  addObservations(entityName: string, contents: string[]): Promise<void>
  // etc.
}
```

**After:**
```typescript
import type { EntityName, Entity, Observation, Timestamp } from "#types/validation.js"

interface KnowledgeGraphManager {
  createEntities(entities: readonly Entity[]): Promise<readonly Entity[]>
  deleteEntities(entityNames: readonly EntityName[]): Promise<void>
  addObservations(entityName: EntityName, contents: readonly Observation[]): Promise<void>
  getEntityHistory(entityName: EntityName): Promise<readonly TemporalEntity[]>
  getGraphAtTime(timestamp: Timestamp): Promise<KnowledgeGraph>
  // etc.
}
```

#### 4.2 Database Layer Updates

Update all database methods to accept and return branded types:

```typescript
class SqliteDatabase implements Database {
  async getEntity(name: EntityName): Promise<Entity | null>
  async saveEntity(entity: Entity): Promise<void>
  async deleteEntity(name: EntityName): Promise<void>
  // etc.
}
```

---

### Phase 5: Testing Infrastructure

**Objective**: Create testable, type-safe test utilities

#### 5.1 Test Builders (src/tests/builders/)

```typescript
// src/tests/builders/entity-builder.ts
import { EntityNameSchema, ObservationSchema, EntitySchema } from "#types/validation.js"
import type { Entity, EntityType } from "#types/validation.js"

export class EntityBuilder {
  private entity: Partial<Entity> = {}

  withName(name: string): this {
    this.entity.name = EntityNameSchema.parse(name)
    return this
  }

  withType(type: EntityType): this {
    this.entity.entityType = type
    return this
  }

  withObservations(...observations: string[]): this {
    this.entity.observations = observations.map(o => ObservationSchema.parse(o))
    return this
  }

  build(): Entity {
    return EntitySchema.parse({
      entityType: "feature",
      observations: ["Default observation"],
      ...this.entity,
    })
  }
}

// Usage in tests:
const entity = new EntityBuilder()
  .withName("test_entity")
  .withType("feature")
  .withObservations("Test observation")
  .build()
```

#### 5.2 Response Assertions (src/tests/assertions/)

```typescript
// src/tests/assertions/response-assertions.ts
import { strictEqual, ok } from "node:assert/strict"
import type { SuccessResponse, ErrorResponse, ErrorCode } from "#types/responses.js"

export function assertSuccessResponse<T>(
  response: unknown
): asserts response is SuccessResponse<T> {
  strictEqual(typeof response, "object")
  strictEqual((response as any).success, true)
  ok("data" in (response as any))
}

export function assertErrorResponse(
  response: unknown,
  expectedCode?: ErrorCode
): asserts response is ErrorResponse {
  strictEqual(typeof response, "object")
  strictEqual((response as any).success, false)
  ok("error" in (response as any))

  if (expectedCode) {
    strictEqual((response as any).error.code, expectedCode)
  }
}

export function assertValidationError(response: unknown): asserts response is ErrorResponse {
  assertErrorResponse(response, ErrorCode.INVALID_INPUT)
}
```

#### 5.3 Update Test Helpers (src/tests/integration/e2e/fixtures/helpers.js)

```typescript
import { ok, strictEqual } from "node:assert/strict"
import { assertSuccessResponse, assertErrorResponse } from "#tests/assertions/response-assertions.js"

export class MCPTestHelper {
  client

  constructor(client, _transport) {
    this.client = client
  }

  /**
   * Call a tool and parse JSON response
   * Now with proper success/error handling
   */
  async callToolJSON(name, args) {
    const result = await this.client.callTool({
      name,
      arguments: args,
    })

    ok(result.content, "should have content")
    ok(
      Array.isArray(result.content) && result.content.length > 0,
      "should have content array"
    )

    const content = result.content[0]
    ok(content.type === "text", "content should be text")

    if (content.type === "text") {
      const parsed = JSON.parse(content.text)

      // Check if it's a success response
      if (parsed.success === true) {
        assertSuccessResponse(parsed)
        return parsed.data
      }

      // It's an error response
      assertErrorResponse(parsed)
      throw new Error(`Tool ${name} returned error: ${parsed.error.message}`)
    }

    throw new Error("Invalid content type")
  }

  /**
   * Call a tool and expect it to fail with specific error code
   */
  async expectToolError(name, args, expectedCode) {
    try {
      const result = await this.client.callTool({
        name,
        arguments: args,
      })

      const content = result.content[0]
      const parsed = JSON.parse(content.text)

      // Should be an error response
      assertErrorResponse(parsed, expectedCode)
      return parsed
    } catch (error) {
      // If it's a regular error (not from MCP), check it contains expected code
      if (expectedCode && error instanceof Error) {
        ok(
          error.message.includes(expectedCode),
          `Expected error with code "${expectedCode}", got "${error.message}"`
        )
      }
      return error
    }
  }

  // ... rest of helper methods ...
}
```

---

## Implementation Phases

### Phase 0: Setup (Day 1)
- [ ] Install `zod-validation-error` dependency
- [ ] Remove `arktype` and `arkenv` dependencies
- [ ] Create Zod configuration file with error map
- [ ] Update all Zod imports to use configured version

**Deliverable**: Dependencies updated, Zod configured globally

### Phase 1: Foundation (Week 1)
- [ ] Expand Zod schemas in validation.ts with all branded types
- [ ] Create tool input/output schemas
- [ ] Remove validateString/validateArray/validateNumber manual functions
- [ ] Update all type files to remove ArkType
- [ ] Delete src/types/shared.ts

**Deliverable**: Single validation source using Zod, all branded types defined

### Phase 2: Response System (Week 1-2)
- [ ] Create response types (src/types/responses.ts)
- [ ] Create response builders with zod-validation-error integration
- [ ] Update all tool handlers to use response builders
- [ ] Update call-tool-handler.ts to use new patterns

**Deliverable**: Consistent response format across all tools with user-friendly errors

### Phase 3: Error Handling (Week 2)
- [ ] Create error classes (src/errors/index.ts)
- [ ] Create error handler utilities with zod-validation-error support
- [ ] Update all error handling to use DFMError classes
- [ ] Add error handling middleware to tool handlers

**Deliverable**: Structured, testable error handling with readable messages

### Phase 4: Method Signatures (Week 2-3)
- [ ] Update KnowledgeGraphManager interface
- [ ] Update SqliteDatabase implementation
- [ ] Update all service layer methods
- [ ] Update embedding service methods

**Deliverable**: Type-safe method signatures using branded types

### Phase 5: Testing (Week 3)
- [ ] Create test builders
- [ ] Create response assertions
- [ ] Update test helpers to use new response format
- [ ] Update existing E2E tests to use new patterns
- [ ] Write comprehensive tests for all tools
- [ ] Achieve >90% test coverage

**Deliverable**: Robust test suite with type safety

---

## Success Criteria

1. **Zero ArkType dependencies** - All validation through Zod
2. **Zero manual validation** - No validateString/Array/Number functions
3. **100% branded types** - No raw strings/numbers for domain concepts
4. **Consistent responses** - All tools use standard response format
5. **Structured errors** - All errors use ErrorCode enum
6. **User-friendly error messages** - Using zod-validation-error
7. **Type-safe tests** - Tests use builders and assertions
8. **All tests passing** - E2E test suite passes completely
9. **Build succeeds** - `mise run build` completes without errors
10. **Type check passes** - `mise run typecheck` shows no errors

---

## Migration Strategy

### Backwards Compatibility

- Keep old types alongside new types temporarily
- Use adapter functions during transition
- Mark old APIs as deprecated
- Remove deprecated code after full migration

### Testing During Migration

- Keep existing tests running
- Add new tests for new patterns
- Gradually migrate old tests
- Ensure no regression

### Rollback Plan

- Git branch for rollback: `sqlite-pre-refactor`
- Tag release point: `v1.0.0-pre-refactor`
- Can revert entire branch if needed
- Each phase is atomic and can be reverted independently

---

## Risks & Mitigation

| Risk | Impact | Mitigation |
|------|--------|------------|
| Breaking existing functionality | High | Comprehensive test coverage before changes |
| Long migration time | Medium | Phased approach, one phase at a time |
| Type errors cascade | Medium | Fix types layer by layer (types → handlers → database) |
| Test failures during migration | Medium | Keep old tests, add new tests, migrate gradually |
| Performance regression | Low | Benchmark before/after, Zod is fast, zod-validation-error is lightweight |
| Error message quality | Low | zod-validation-error provides extensive configuration options |

---

## Benefits of zod-validation-error

1. **User-Friendly Messages**: Transforms technical Zod errors into readable messages
2. **Consistency**: All validation errors follow the same format
3. **Customization**: Extensive configuration options for message formatting
4. **Type Safety**: Works seamlessly with TypeScript
5. **Minimal Overhead**: Lightweight library with no dependencies
6. **Original Details Preserved**: Maintains access to original Zod error details
7. **Error Type Guards**: Provides utilities like `isValidationErrorLike` for error handling
8. **Functional Programming Support**: Curried functions for FP workflows

---

## Timeline

- **Day 1**: Phase 0 (Setup)
- **Week 1**: Phases 1-2 (Foundation + Response System)
- **Week 2**: Phases 3-4 (Errors + Method Signatures)
- **Week 3**: Phase 5 (Testing)
- **Total**: 3 weeks for complete migration

---

## Next Steps

1. **Review this plan** - Get team approval
2. **Install dependencies** - Add zod-validation-error
3. **Create git branch** - Tag current state for rollback
4. **Start Phase 0** - Configure Zod with error map
5. **Daily check-ins** - Ensure progress and address blockers
6. **Testing at each phase** - No phase complete until tests pass

---

**Document Status**: Draft v2
**Last Updated**: 2025-10-17
**Author**: DevFlow Team
**Changes**: Added zod-validation-error integration for user-friendly error messages
