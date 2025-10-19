# DevFlow MCP: Detailed Implementation Guide

**Target**: Another AI model implementing the refactoring plan
**Goal**: Complete type safety & standardization refactoring in one focused work session
**Branch**: `sqlite`
**Prerequisites**: Read [REFACTORING_PLAN.md](./REFACTORING_PLAN.md) first

---

## =Ë Table of Contents

1. [Project Structure & Conventions](#project-structure--conventions)
2. [Phase 0: Setup & Dependencies](#phase-0-setup--dependencies)
3. [Phase 1: Foundation - Zod Migration](#phase-1-foundation---zod-migration)
4. [Phase 2: Response System](#phase-2-response-system)
5. [Phase 3: Error Handling](#phase-3-error-handling)
6. [Phase 4: Method Signatures](#phase-4-method-signatures)
7. [Phase 5: Testing Infrastructure](#phase-5-testing-infrastructure)
8. [Verification & Testing](#verification--testing)
9. [Troubleshooting](#troubleshooting)

---

## <× Project Structure & Conventions

### Import Path Aliases

The project uses TypeScript path aliases configured in `tsconfig.json`:

```typescript
//  Correct - Use alias for src imports
import { EntitySchema } from "#types/validation.js"
import { logger } from "#logger.js"
import type { Entity } from "#types/validation.js"

// L Wrong - Don't use relative paths for src imports
import { EntitySchema } from "../../types/validation.js"
```

**Rule**: Always use `#` alias for importing from `src/`. The pattern is `#path/to/file.js` maps to `src/path/to/file.ts`.

### File Extensions in Imports

**IMPORTANT**: Always use `.js` extension in imports, even for `.ts` files:

```typescript
//  Correct
import { EntitySchema } from "#types/validation.js"

// L Wrong
import { EntitySchema } from "#types/validation.ts"
import { EntitySchema } from "#types/validation"
```

### Export Patterns

Use named exports, avoid default exports:

```typescript
//  Correct - Named exports
export const EntitySchema = z.object({...})
export type Entity = z.infer<typeof EntitySchema>
export function buildSuccessResponse<T>(data: T): MCPToolResponse {...}

// L Wrong - Default exports
export default EntitySchema
```

### File Naming Conventions

- **Type files**: `kebab-case.ts` (e.g., `validation.ts`, `responses.ts`)
- **Implementation files**: `kebab-case.ts` (e.g., `response-builders.ts`, `error-handler.ts`)
- **Test files**: `*.test.ts` or `*.test.js` for E2E tests
- **Folders**: `kebab-case` (e.g., `src/errors/`, `src/tests/builders/`)

### TypeScript Strict Mode

The project uses strict TypeScript:
- Always type function parameters and return types
- Use `unknown` instead of `any`
- Use `readonly` for arrays that won't be mutated
- Use strict null checks
- Use `type` imports when only importing types

```typescript
//  Correct - Explicit types
export function handleError(error: unknown): MCPToolResponse {
  // ...
}

export async function createEntities(
  entities: readonly Entity[]
): Promise<readonly Entity[]> {
  // ...
}

//  Correct - Type-only imports
import type { Entity, Relation } from "#types/validation.js"
```

### Available Commands

Located in `.mise.toml`:

```bash
# Build
mise run build        # Build project
mise run clean        # Clean dist folder

# Testing
mise run test:e2e     # Run E2E tests
mise run test:e2e:debug  # Run E2E with console logs

# Type checking
mise run typecheck    # Run TypeScript compiler check
```

### Documentation References

When you need more information:

- **Zod**: https://zod.dev/
- **zod-validation-error**: https://www.npmjs.com/package/zod-validation-error
- **MCP Protocol**: The project follows MCP (Model Context Protocol) response format
- **Project docs**: Check `docs/` folder for architecture decisions

---

## =€ Phase 0: Setup & Dependencies

### Step 0.1: Install Dependencies

**File**: `package.json`

```bash
# Install zod-validation-error
pnpm add zod-validation-error

# Remove deprecated dependencies
pnpm remove arktype arkenv
```

**Verification**:
```bash
# Check package.json has:
grep "zod-validation-error" package.json
# Check package.json doesn't have:
grep "arktype" package.json
# Should return nothing
```

---

### Step 0.2: Create Zod Configuration File

**File**: `src/config/zod-config.ts` (NEW FILE)

```typescript
/**
 * Global Zod Configuration
 *
 * Configures Zod to use zod-validation-error's error map for user-friendly messages.
 * Import this configured version of Zod throughout the codebase.
 *
 * @example
 * ```typescript
 * // Use this instead of importing from 'zod' directly
 * import { z } from "#config/zod-config.js"
 * ```
 */

import { z } from "zod"
import { createErrorMap } from "zod-validation-error"

/**
 * Configure Zod with user-friendly error messages
 *
 * See: https://github.com/causaly/zod-validation-error#createerrormap
 */
z.setErrorMap(
  createErrorMap({
    // Show detailed format information in error messages
    displayInvalidFormatDetails: false, // Set to true in dev mode if needed

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

    // Localization for dates and numbers
    dateLocalization: true,
    numberLocalization: true,
  })
)

/**
 * Export configured Zod instance
 *
 * Import this throughout the codebase instead of importing 'zod' directly
 */
export { z }
```

**Verification**:
```bash
# File should exist and compile
ls -la src/config/zod-config.ts
mise run typecheck
```

---

### Step 0.3: Update validation.ts to Use Configured Zod

**File**: `src/types/validation.ts`

**Change**:
```typescript
// OLD (line 18):
import { z } from "zod"

// NEW:
import { z } from "#config/zod-config.js"
```

**Verification**:
```bash
# Check the import was updated
grep "from \"#config/zod-config.js\"" src/types/validation.ts
```

---

### Step 0.4: Find and Update All Zod Imports

**Task**: Find all files importing from `"zod"` and update to use configured version

**Command to find all files**:
```bash
grep -r "from \"zod\"" src --include="*.ts" --include="*.js"
```

**For EACH file found, change**:
```typescript
// OLD:
import { z } from "zod"

// NEW:
import { z } from "#config/zod-config.js"
```

**Common files to check**:
- `src/types/*.ts`
- `src/server/handlers/*.ts`
- `src/embeddings/*.ts`
- `src/utils/*.ts`

**Verification**:
```bash
# Should return nothing (all zod imports now use config)
grep -r "from \"zod\"" src --include="*.ts" --include="*.js"

# Should find all config imports
grep -r "from \"#config/zod-config.js\"" src --include="*.ts"

# TypeScript should compile
mise run typecheck
```

---

## =Ý Phase 1: Foundation - Zod Migration

### Step 1.1: Expand validation.ts with Branded Types

**File**: `src/types/validation.ts`

**Add these branded type schemas AFTER the existing imports but BEFORE EntityNameSchema**:

```typescript
// Add after line 35 (after VALIDATION_CONSTANTS)

/**
 * Branded Primitive Types
 *
 * These types prevent mixing up similar primitive values (e.g., timestamp vs version number).
 * Zod's .brand() creates a nominal type that's incompatible with plain numbers/strings at compile time.
 */

/**
 * Unix timestamp in milliseconds
 * Must be a non-negative integer
 */
export const TimestampSchema = z.number().int().nonnegative().brand<"Timestamp">()
export type Timestamp = z.infer<typeof TimestampSchema>

/**
 * Version number (1-based)
 * Must be a positive integer
 */
export const VersionSchema = z.number().int().positive().brand<"Version">()
export type Version = z.infer<typeof VersionSchema>

/**
 * Confidence score (0.0 to 1.0)
 * Represents certainty or confidence in a relation or classification
 */
export const ConfidenceScoreSchema = z.number().min(0).max(1).brand<"ConfidenceScore">()
export type ConfidenceScore = z.infer<typeof ConfidenceScoreSchema>

/**
 * Strength score (0.0 to 1.0)
 * Represents intensity or importance of a relation
 */
export const StrengthScoreSchema = z.number().min(0).max(1).brand<"StrengthScore">()
export type StrengthScore = z.infer<typeof StrengthScoreSchema>

/**
 * UUID-based entity identifier
 */
export const EntityIdSchema = z.string().uuid().brand<"EntityId">()
export type EntityId = z.infer<typeof EntityIdSchema>

/**
 * Relation identifier
 * Format: "{from}_{relationType}_{to}"
 */
export const RelationIdSchema = z.string().brand<"RelationId">()
export type RelationId = z.infer<typeof RelationIdSchema>
```

**Update RelationMetadataSchema** (around line 174):

```typescript
// OLD:
export const RelationMetadataSchema = z
  .object({
    createdAt: z.number().int().nonnegative(),
    updatedAt: z.number().int().nonnegative(),
    inferredFrom: z.array(z.string()).optional(),
    lastAccessed: z.number().int().nonnegative().optional(),
  })
  .strict()
  .refine((data) => data.updatedAt >= data.createdAt, {
    message: "updatedAt must be greater than or equal to createdAt",
    path: ["updatedAt"],
  })

// NEW:
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
```

**Update RelationSchema** (around line 200):

```typescript
// OLD:
export const RelationSchema = z
  .object({
    from: EntityNameSchema,
    to: EntityNameSchema,
    relationType: RelationTypeSchema,
    strength: z.number().min(0).max(1).optional(),
    confidence: z.number().min(0).max(1).optional(),
    metadata: RelationMetadataSchema.optional(),
  })
  .strict()
  .refine((data) => data.from !== data.to, {
    message: "Relation cannot connect an entity to itself (from must differ from to)",
    path: ["to"],
  })

// NEW:
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
    message: "Relation cannot connect an entity to itself (from must differ from to)",
    path: ["to"],
  })
```

**Update EntityEmbeddingSchema** (around line 129):

```typescript
// OLD:
export const EntityEmbeddingSchema = z
  .object({
    vector: z
      .array(z.number().finite())
      .min(1, "Vector must have at least 1 dimension")
      .max(
        VALIDATION_CONSTANTS.MAX_VECTOR_DIMENSIONS,
        `Vector cannot exceed ${VALIDATION_CONSTANTS.MAX_VECTOR_DIMENSIONS} dimensions`
      ),
    model: z.string().min(1, "Model identifier cannot be empty"),
    lastUpdated: z.number().int().nonnegative(),
  })
  .strict()

// NEW:
export const EntityEmbeddingSchema = z
  .object({
    vector: z
      .array(z.number().finite())
      .min(1, "Vector must have at least 1 dimension")
      .max(
        VALIDATION_CONSTANTS.MAX_VECTOR_DIMENSIONS,
        `Vector cannot exceed ${VALIDATION_CONSTANTS.MAX_VECTOR_DIMENSIONS} dimensions`
      ),
    model: z.string().min(1, "Model identifier cannot be empty"),
    lastUpdated: TimestampSchema,
  })
  .strict()
```

**Update TemporalEntitySchema** (around line 229):

```typescript
// OLD:
export const TemporalEntitySchema = EntitySchema.extend({
  id: z.string().optional(),
  version: z.number().int().positive(),
  createdAt: z.number().int().nonnegative(),
  updatedAt: z.number().int().nonnegative(),
  validFrom: z.number().int().nonnegative().optional(),
  validTo: z.number().int().nonnegative().nullable().optional(),
  changedBy: z.string().nullable().optional(),
}).refine((data) => data.updatedAt >= data.createdAt, {
  message: "updatedAt must be greater than or equal to createdAt",
  path: ["updatedAt"],
})

// NEW:
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

**Verification**:
```bash
mise run typecheck
```

---

### Step 1.2: Add Tool Input Schemas to validation.ts

**File**: `src/types/validation.ts`

**Add at the end of the file (after line 350)**:

```typescript
/**
 * ============================================================================
 * Tool Input Schemas
 * ============================================================================
 *
 * These schemas validate the input parameters for MCP tool handlers.
 * Each schema corresponds to a tool defined in list-tools-handler.ts
 */

/**
 * create_entities tool input
 */
export const CreateEntitiesInputSchema = z
  .object({
    entities: z.array(EntitySchema).min(1, "Must provide at least one entity"),
  })
  .strict()

export type CreateEntitiesInput = z.infer<typeof CreateEntitiesInputSchema>

/**
 * delete_entities tool input
 */
export const DeleteEntitiesInputSchema = z
  .object({
    entityNames: z.array(EntityNameSchema).min(1, "Must provide at least one entity name"),
  })
  .strict()

export type DeleteEntitiesInput = z.infer<typeof DeleteEntitiesInputSchema>

/**
 * add_observations tool input
 */
export const AddObservationsInputSchema = z
  .object({
    entityName: EntityNameSchema,
    contents: z.array(ObservationSchema).min(1, "Must provide at least one observation"),
  })
  .strict()

export type AddObservationsInput = z.infer<typeof AddObservationsInputSchema>

/**
 * delete_observations tool input
 */
export const DeleteObservationsInputSchema = z
  .object({
    deletions: z
      .array(
        z.object({
          entityName: EntityNameSchema,
          observations: z.array(ObservationSchema).min(1),
        })
      )
      .min(1, "Must provide at least one deletion"),
  })
  .strict()

export type DeleteObservationsInput = z.infer<typeof DeleteObservationsInputSchema>

/**
 * create_relations tool input
 */
export const CreateRelationsInputSchema = z
  .object({
    relations: z.array(RelationSchema).min(1, "Must provide at least one relation"),
  })
  .strict()

export type CreateRelationsInput = z.infer<typeof CreateRelationsInputSchema>

/**
 * delete_relations tool input
 */
export const DeleteRelationsInputSchema = z
  .object({
    relations: z.array(RelationSchema).min(1, "Must provide at least one relation"),
  })
  .strict()

export type DeleteRelationsInput = z.infer<typeof DeleteRelationsInputSchema>

/**
 * search_nodes tool input
 */
export const SearchNodesInputSchema = z
  .object({
    query: z.string().min(1, "Search query cannot be empty"),
  })
  .strict()

export type SearchNodesInput = z.infer<typeof SearchNodesInputSchema>

/**
 * semantic_search tool input
 */
export const SemanticSearchInputSchema = z
  .object({
    query: z.string().min(1, "Search query cannot be empty"),
    limit: z.number().int().positive().optional(),
    minSimilarity: ConfidenceScoreSchema.optional(),
    entityTypes: z.array(EntityTypeSchema).optional(),
    hybridSearch: z.boolean().optional(),
    semanticWeight: z.number().min(0).max(1).optional(),
  })
  .strict()

export type SemanticSearchInput = z.infer<typeof SemanticSearchInputSchema>

/**
 * get_relation tool input
 */
export const GetRelationInputSchema = z
  .object({
    from: EntityNameSchema,
    to: EntityNameSchema,
    relationType: RelationTypeSchema,
  })
  .strict()

export type GetRelationInput = z.infer<typeof GetRelationInputSchema>

/**
 * update_relation tool input
 */
export const UpdateRelationInputSchema = z
  .object({
    from: EntityNameSchema,
    to: EntityNameSchema,
    relationType: RelationTypeSchema,
    strength: StrengthScoreSchema.optional(),
    confidence: ConfidenceScoreSchema.optional(),
    metadata: RelationMetadataSchema.optional(),
  })
  .strict()

export type UpdateRelationInput = z.infer<typeof UpdateRelationInputSchema>

/**
 * open_nodes tool input
 */
export const OpenNodesInputSchema = z
  .object({
    names: z.array(EntityNameSchema).min(1, "Must provide at least one entity name"),
  })
  .strict()

export type OpenNodesInput = z.infer<typeof OpenNodesInputSchema>

/**
 * get_entity_history tool input
 */
export const GetEntityHistoryInputSchema = z
  .object({
    entityName: EntityNameSchema,
  })
  .strict()

export type GetEntityHistoryInput = z.infer<typeof GetEntityHistoryInputSchema>

/**
 * get_relation_history tool input
 */
export const GetRelationHistoryInputSchema = z
  .object({
    from: EntityNameSchema,
    to: EntityNameSchema,
    relationType: RelationTypeSchema,
  })
  .strict()

export type GetRelationHistoryInput = z.infer<typeof GetRelationHistoryInputSchema>

/**
 * get_graph_at_time tool input
 */
export const GetGraphAtTimeInputSchema = z
  .object({
    timestamp: TimestampSchema,
  })
  .strict()

export type GetGraphAtTimeInput = z.infer<typeof GetGraphAtTimeInputSchema>

/**
 * get_entity_embedding tool input
 */
export const GetEntityEmbeddingInputSchema = z
  .object({
    entityName: EntityNameSchema,
  })
  .strict()

export type GetEntityEmbeddingInput = z.infer<typeof GetEntityEmbeddingInputSchema>

/**
 * read_graph tool has no parameters (empty object)
 */
export const ReadGraphInputSchema = z.object({}).strict()

export type ReadGraphInput = z.infer<typeof ReadGraphInputSchema>

/**
 * get_decayed_graph tool has no parameters (empty object)
 */
export const GetDecayedGraphInputSchema = z.object({}).strict()

export type GetDecayedGraphInput = z.infer<typeof GetDecayedGraphInputSchema>
```

**Verification**:
```bash
mise run typecheck
```

---

### Step 1.3: Delete src/types/shared.ts

**Task**: Remove the old arktype-based shared types file

```bash
# Delete the file
rm src/types/shared.ts

# Verify it's gone
ls src/types/shared.ts
# Should show "No such file or directory"
```

**Find all imports of shared.ts and replace**:

```bash
# Find files importing from shared.ts
grep -r "from.*shared" src --include="*.ts"
```

For each file found, replace the import:

```typescript
// OLD:
import { ... } from "./shared.js"
import { ... } from "../types/shared.js"
import { ... } from "#types/shared.js"

// NEW:
import { ... } from "#types/validation.js"
```

**Common files to update**:
- `src/types/entity.ts`
- `src/types/relation.ts`
- `src/types/knowledge-graph.ts`
- `src/server/handlers/*.ts`

**Verification**:
```bash
# Should return nothing
grep -r "from.*shared" src --include="*.ts"

mise run typecheck
```

---

### Step 1.4: Remove ArkType from Remaining Type Files

**Files to update**:
- `src/types/entity.ts`
- `src/types/relation.ts`
- `src/types/knowledge-graph.ts`
- `src/types/database.ts`
- `src/types/embedding.ts`

**Process for EACH file**:

1. **Check if file exists and has arktype imports**:
   ```bash
   grep "arktype" src/types/entity.ts
   ```

2. **If arktype is found**:
   - Remove all arktype imports
   - Check if the file re-exports types from validation.ts
   - If yes, keep the file as a simple re-export
   - If no, consider if the file is needed

3. **Example for entity.ts**:

```bash
# Check what it contains
cat src/types/entity.ts
```

If it only contains arktype schemas that are now in validation.ts:

```typescript
// Option 1: Convert to re-export file
/**
 * Entity type definitions
 * Re-exports from validation.ts for backward compatibility
 */
export type { Entity, EntityType, EntityName } from "./validation.js"
export { EntitySchema, EntityTypeSchema, EntityNameSchema } from "./validation.js"
```

Or if it's redundant:

```bash
# Option 2: Delete the file and update imports
rm src/types/entity.ts

# Find files importing from entity.ts
grep -r "from.*entity" src --include="*.ts" | grep "types"

# Update each import to use validation.ts instead
```

4. **Repeat for all type files**

**Verification**:
```bash
# No arktype imports should remain
grep -r "arktype" src --include="*.ts"
# Should return nothing

mise run typecheck
```

---

### Step 1.5: Remove Manual Validation Functions

**File**: Search for manual validation in handlers

```bash
# Find manual validation functions
grep -r "validateString\|validateArray\|validateNumber" src --include="*.ts"
```

**Common location**: `src/server/handlers/call-tool-handler.ts`

**Process**:
1. Open the file
2. Find the manual validation functions (usually at the top)
3. Delete them completely
4. Update any usage to use Zod schemas instead

**Example**:

```typescript
// L DELETE THESE FUNCTIONS:
function validateString(value: unknown, name: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${name} must be a non-empty string`)
  }
  return value
}

function validateArray<T>(value: unknown, name: string): T[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error(`${name} must be a non-empty array`)
  }
  return value
}

// ... etc
```

**Verification**:
```bash
# Should return nothing
grep -r "validateString\|validateArray\|validateNumber" src --include="*.ts"

mise run typecheck
```

---

## =æ Phase 2: Response System

### Step 2.1: Create Response Types File

**File**: `src/types/responses.ts` (NEW FILE)

```typescript
/**
 * MCP Tool Response Types
 *
 * Standardized response formats for all MCP tools.
 * Ensures consistency and type safety across the codebase.
 */

import type { Entity, Relation, KnowledgeGraph, TemporalEntity } from "./validation.js"

/**
 * Standard MCP Tool Response envelope
 * All tool responses must follow this format per MCP protocol
 */
export interface MCPToolResponse {
  content: Array<{
    type: "text"
    text: string
  }>
}

/**
 * Success response with data payload
 * Generic type T represents the response data shape
 */
export interface SuccessResponse<T = unknown> {
  success: true
  data: T
}

/**
 * Error response with structured error information
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
 * Standardized error codes for consistent error handling
 *
 * Convention:
 * - INVALID_* : Validation errors (client error, 4xx equivalent)
 * - *_NOT_FOUND : Resource not found (404 equivalent)
 * - *_ALREADY_EXISTS : Conflict errors (409 equivalent)
 * - *_ERROR : Internal errors (5xx equivalent)
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

  // Not found errors (404 equivalent)
  ENTITY_NOT_FOUND = "ENTITY_NOT_FOUND",
  RELATION_NOT_FOUND = "RELATION_NOT_FOUND",

  // Conflict errors (409 equivalent)
  ENTITY_ALREADY_EXISTS = "ENTITY_ALREADY_EXISTS",
  RELATION_ALREADY_EXISTS = "RELATION_ALREADY_EXISTS",

  // Internal errors (5xx equivalent)
  DATABASE_ERROR = "DATABASE_ERROR",
  EMBEDDING_ERROR = "EMBEDDING_ERROR",
  INTERNAL_ERROR = "INTERNAL_ERROR",
}

/**
 * ============================================================================
 * Tool-Specific Response Types
 * ============================================================================
 *
 * Each tool has a strongly-typed response data structure.
 * This ensures consistency and makes testing easier.
 */

/**
 * create_entities response
 */
export type CreateEntitiesResponse = SuccessResponse<{
  created: number
  entities: Entity[]
}>

/**
 * delete_entities response
 */
export type DeleteEntitiesResponse = SuccessResponse<{
  deleted: number
  entityNames: string[]
}>

/**
 * read_graph response
 */
export type ReadGraphResponse = SuccessResponse<KnowledgeGraph>

/**
 * add_observations response
 */
export type AddObservationsResponse = SuccessResponse<{
  entityName: string
  added: number
  totalObservations: number
}>

/**
 * delete_observations response
 */
export type DeleteObservationsResponse = SuccessResponse<{
  deleted: number
  entities: Array<{
    entityName: string
    deletedCount: number
  }>
}>

/**
 * create_relations response
 */
export type CreateRelationsResponse = SuccessResponse<{
  created: number
  relations: Relation[]
}>

/**
 * delete_relations response
 */
export type DeleteRelationsResponse = SuccessResponse<{
  deleted: number
}>

/**
 * search_nodes response
 */
export type SearchNodesResponse = SuccessResponse<{
  results: Entity[]
  count: number
}>

/**
 * semantic_search response
 */
export type SemanticSearchResponse = SuccessResponse<{
  results: Array<{
    entity: Entity
    similarity: number
  }>
  count: number
}>

/**
 * get_relation response
 */
export type GetRelationResponse = SuccessResponse<Relation | null>

/**
 * update_relation response
 */
export type UpdateRelationResponse = SuccessResponse<Relation>

/**
 * open_nodes response
 */
export type OpenNodesResponse = SuccessResponse<{
  nodes: Entity[]
  found: number
  notFound: string[]
}>

/**
 * get_entity_history response
 */
export type GetEntityHistoryResponse = SuccessResponse<{
  entityName: string
  history: TemporalEntity[]
  totalVersions: number
}>

/**
 * get_relation_history response
 */
export type GetRelationHistoryResponse = SuccessResponse<{
  from: string
  to: string
  relationType: string
  history: TemporalEntity[]
  totalVersions: number
}>

/**
 * get_graph_at_time response
 */
export type GetGraphAtTimeResponse = SuccessResponse<{
  timestamp: number
  graph: KnowledgeGraph
}>

/**
 * get_decayed_graph response
 */
export type GetDecayedGraphResponse = SuccessResponse<KnowledgeGraph>

/**
 * get_entity_embedding response
 */
export type GetEntityEmbeddingResponse = SuccessResponse<{
  entityName: string
  embedding: number[]
  model: string
}>
```

**Verification**:
```bash
ls src/types/responses.ts
mise run typecheck
```

---

### Step 2.2: Create Response Builder Utilities

**File**: `src/utils/response-builders.ts` (NEW FILE)

```typescript
/**
 * Response Builder Utilities
 *
 * Standardized functions for building MCP tool responses.
 * Uses zod-validation-error for user-friendly error messages.
 */

import type { ZodError } from "zod"
import { fromError, fromZodError } from "zod-validation-error"
import type {
  MCPToolResponse,
  SuccessResponse,
  ErrorResponse,
  ErrorCode,
} from "#types/responses.js"

/**
 * Build a successful MCP tool response
 *
 * @param data - The response data (will be wrapped in SuccessResponse format)
 * @returns MCP-formatted tool response
 *
 * @example
 * ```typescript
 * return buildSuccessResponse({
 *   created: 1,
 *   entities: [entity]
 * })
 * ```
 */
export function buildSuccessResponse<T>(data: T): MCPToolResponse {
  const response: SuccessResponse<T> = {
    success: true,
    data,
  }

  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(response, null, 2),
      },
    ],
  }
}

/**
 * Build an error MCP tool response
 *
 * @param code - Standardized error code
 * @param message - Human-readable error message
 * @param details - Optional additional error details
 * @returns MCP-formatted error response
 *
 * @example
 * ```typescript
 * return buildErrorResponse(
 *   ErrorCode.ENTITY_NOT_FOUND,
 *   "Entity 'user123' not found",
 *   { entityName: "user123" }
 * )
 * ```
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
    content: [
      {
        type: "text",
        text: JSON.stringify(response, null, 2),
      },
    ],
  }
}

/**
 * Build error response from Zod validation failure
 *
 * Uses zod-validation-error to convert technical Zod errors into
 * user-friendly messages.
 *
 * @param zodError - The Zod validation error
 * @returns MCP-formatted error response
 *
 * @example
 * ```typescript
 * const result = EntitySchema.safeParse(data)
 * if (!result.success) {
 *   return buildValidationErrorResponse(result.error)
 * }
 * ```
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
  const details = zodError.errors.reduce(
    (acc, err) => {
      const path = err.path.join(".")
      acc[path] = err.message
      return acc
    },
    {} as Record<string, string>
  )

  return buildErrorResponse(ErrorCode.INVALID_INPUT, validationError.message, details)
}

/**
 * Build error response from unknown error
 *
 * Uses zod-validation-error's fromError for consistent handling
 * of any error type.
 *
 * @param error - Unknown error object
 * @returns MCP-formatted error response
 *
 * @example
 * ```typescript
 * try {
 *   // ... operation
 * } catch (error) {
 *   return buildErrorFromUnknown(error)
 * }
 * ```
 */
export function buildErrorFromUnknown(error: unknown): MCPToolResponse {
  const validationError = fromError(error, {
    prefix: "Error",
    prefixSeparator: ": ",
    includePath: true,
  })

  return buildErrorResponse(ErrorCode.INTERNAL_ERROR, validationError.message, {
    cause: validationError.cause,
  })
}
```

**Verification**:
```bash
ls src/utils/response-builders.ts
mise run typecheck
```

---

### Step 2.3: Update Tool Handler - delete_entities Example

**File**: `src/server/handlers/tool-handlers.ts`

Find the `handleDeleteEntities` function and replace it:

```typescript
// OLD (approximately lines 106-127):
export async function handleDeleteEntities(args: unknown, ...) {
  const validated = DeleteEntitiesArgsSchema(args)
  if (validated instanceof type.errors) {
    throw new Error(`Invalid arguments: ${validated}`)
  }
  await knowledgeGraphManager.deleteEntities(validated.entityNames)
  return {
    content: [{
      type: "text",
      text: JSON.stringify({
        success: true,
        deleted: validated.entityNames.length,
        entityNames: validated.entityNames,
      }),
    }],
  }
}

// NEW:
import { DeleteEntitiesInputSchema } from "#types/validation.js"
import { buildSuccessResponse, buildValidationErrorResponse } from "#utils/response-builders.js"
import type { MCPToolResponse, DeleteEntitiesResponse } from "#types/responses.js"

/**
 * Handle delete_entities tool call
 *
 * Deletes entities from the knowledge graph by name.
 *
 * @param args - Tool arguments (must match DeleteEntitiesInputSchema)
 * @param knowledgeGraphManager - Knowledge graph manager instance
 * @returns MCP tool response
 */
export async function handleDeleteEntities(
  args: unknown,
  knowledgeGraphManager: KnowledgeGraphManager,
  logger: Logger
): Promise<MCPToolResponse> {
  // Validate input
  const result = DeleteEntitiesInputSchema.safeParse(args)
  if (!result.success) {
    return buildValidationErrorResponse(result.error)
  }

  const { entityNames } = result.data

  logger.debug(`Deleting ${entityNames.length} entities`, { entityNames })

  // Perform operation
  await knowledgeGraphManager.deleteEntities(entityNames)

  // Build typed response
  const responseData: DeleteEntitiesResponse["data"] = {
    deleted: entityNames.length,
    entityNames: entityNames.map((name) => name as string), // Extract from brand
  }

  return buildSuccessResponse(responseData)
}
```

**Pattern for ALL tool handlers**:

1. **Add imports at top of file**:
```typescript
import { <ToolName>InputSchema } from "#types/validation.js"
import { buildSuccessResponse, buildValidationErrorResponse } from "#utils/response-builders.js"
import type { MCPToolResponse, <ToolName>Response } from "#types/responses.js"
```

2. **Update function signature**:
```typescript
export async function handle<ToolName>(
  args: unknown,
  dependencies...,
): Promise<MCPToolResponse>
```

3. **Validate input**:
```typescript
const result = <ToolName>InputSchema.safeParse(args)
if (!result.success) {
  return buildValidationErrorResponse(result.error)
}
const validatedData = result.data
```

4. **Perform operation** (existing logic)

5. **Build response**:
```typescript
const responseData: <ToolName>Response["data"] = {
  // ... response data
}
return buildSuccessResponse(responseData)
```

**Verification after updating EACH handler**:
```bash
mise run typecheck
```

---

### Step 2.4: Update call-tool-handler.ts

**File**: `src/server/handlers/call-tool-handler.ts`

This file contains the switch statement that routes to tool handlers.

**Process**:

1. **Find tool cases that need updating** (look for manual response building):
```bash
grep -n "content: \[" src/server/handlers/call-tool-handler.ts
```

2. **For EACH case, update to use response builders**:

**Example - delete_observations**:

```typescript
// OLD:
case "delete_observations": {
  const deletions = validateArray(args.deletions, "deletions") as Array<{
    entityName: string
    observations: string[]
  }>
  await knowledgeGraphManager.deleteObservations(deletions)
  return {
    content: [{ type: "text", text: "Observations deleted successfully" }],
  }
}

// NEW:
case "delete_observations": {
  const result = DeleteObservationsInputSchema.safeParse(args)
  if (!result.success) {
    return buildValidationErrorResponse(result.error)
  }

  const { deletions } = result.data
  const totalDeleted = await knowledgeGraphManager.deleteObservations(deletions)

  const responseData: DeleteObservationsResponse["data"] = {
    deleted: totalDeleted,
    entities: deletions.map(d => ({
      entityName: d.entityName as string,
      deletedCount: d.observations.length,
    })),
  }

  return buildSuccessResponse(responseData)
}
```

3. **Add imports at top**:
```typescript
import {
  DeleteObservationsInputSchema,
  DeleteRelationsInputSchema,
  AddObservationsInputSchema,
  // ... other schemas used in this file
} from "#types/validation.js"
import {
  buildSuccessResponse,
  buildValidationErrorResponse,
} from "#utils/response-builders.js"
import type {
  MCPToolResponse,
  DeleteObservationsResponse,
  DeleteRelationsResponse,
  AddObservationsResponse,
  // ... other response types
} from "#types/responses.js"
```

4. **Remove manual validation function calls** (validateString, validateArray, etc.)

**Verification**:
```bash
mise run typecheck

# No manual validation should remain
grep "validateString\|validateArray" src/server/handlers/call-tool-handler.ts
# Should return nothing
```

---

##   Phase 3: Error Handling

### Step 3.1: Create Error Classes

**File**: `src/errors/index.ts` (NEW FILE)

```typescript
/**
 * Custom Error Classes for DevFlow MCP
 *
 * Provides structured, type-safe error handling with error codes.
 */

import { ErrorCode } from "#types/responses.js"

/**
 * Base error class for all DevFlow MCP errors
 *
 * All custom errors inherit from this class to provide
 * consistent error structure and behavior.
 */
export class DFMError extends Error {
  /**
   * @param code - Standardized error code
   * @param message - Human-readable error message
   * @param details - Optional additional error details
   */
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
 *
 * Thrown when input validation fails.
 *
 * @example
 * ```typescript
 * throw new ValidationError("Invalid entity name", { name: "123invalid" })
 * ```
 */
export class ValidationError extends DFMError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(ErrorCode.INVALID_INPUT, message, details)
    this.name = "ValidationError"
  }
}

/**
 * Entity not found error
 *
 * Thrown when an entity doesn't exist in the knowledge graph.
 *
 * @example
 * ```typescript
 * throw new EntityNotFoundError("user123")
 * ```
 */
export class EntityNotFoundError extends DFMError {
  constructor(entityName: string) {
    super(ErrorCode.ENTITY_NOT_FOUND, `Entity not found: ${entityName}`, {
      entityName,
    })
    this.name = "EntityNotFoundError"
  }
}

/**
 * Relation not found error
 *
 * Thrown when a relation doesn't exist in the knowledge graph.
 *
 * @example
 * ```typescript
 * throw new RelationNotFoundError("user123", "service456", "depends_on")
 * ```
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
 * Entity already exists error
 *
 * Thrown when attempting to create an entity that already exists.
 *
 * @example
 * ```typescript
 * throw new EntityAlreadyExistsError("user123")
 * ```
 */
export class EntityAlreadyExistsError extends DFMError {
  constructor(entityName: string) {
    super(ErrorCode.ENTITY_ALREADY_EXISTS, `Entity already exists: ${entityName}`, {
      entityName,
    })
    this.name = "EntityAlreadyExistsError"
  }
}

/**
 * Database error
 *
 * Thrown when a database operation fails.
 *
 * @example
 * ```typescript
 * try {
 *   await db.query(...)
 * } catch (err) {
 *   throw new DatabaseError("Failed to query database", err)
 * }
 * ```
 */
export class DatabaseError extends DFMError {
  constructor(message: string, cause?: Error) {
    super(ErrorCode.DATABASE_ERROR, message, { cause: cause?.message })
    this.name = "DatabaseError"
  }
}

/**
 * Embedding service error
 *
 * Thrown when embedding generation fails.
 *
 * @example
 * ```typescript
 * try {
 *   await embeddingService.generateEmbedding(text)
 * } catch (err) {
 *   throw new EmbeddingError("Failed to generate embedding", err)
 * }
 * ```
 */
export class EmbeddingError extends DFMError {
  constructor(message: string, cause?: Error) {
    super(ErrorCode.EMBEDDING_ERROR, message, { cause: cause?.message })
    this.name = "EmbeddingError"
  }
}
```

**Verification**:
```bash
ls src/errors/index.ts
mise run typecheck
```

---

### Step 3.2: Create Error Handler Utilities

**File**: `src/utils/error-handler.ts` (NEW FILE)

```typescript
/**
 * Error Handler Utilities
 *
 * Centralized error handling for consistent error responses.
 */

import type { ZodError } from "zod"
import { isValidationErrorLike } from "zod-validation-error"
import {
  buildErrorResponse,
  buildValidationErrorResponse,
  buildErrorFromUnknown,
} from "./response-builders.js"
import { DFMError } from "#errors"
import type { Logger } from "#types/logger.js"
import type { MCPToolResponse } from "#types/responses.js"

/**
 * Type guard to check if error is a Zod error
 *
 * @param error - Unknown error object
 * @returns True if error is a ZodError
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
 *
 * This function handles all error types and converts them to
 * consistent MCP tool responses with user-friendly messages.
 *
 * @param error - Unknown error object
 * @param logger - Logger instance for error logging
 * @returns MCP-formatted error response
 *
 * @example
 * ```typescript
 * try {
 *   await doSomething()
 * } catch (error) {
 *   return handleError(error, logger)
 * }
 * ```
 */
export function handleError(error: unknown, logger?: Logger): MCPToolResponse {
  // Handle DFMError instances (our custom errors)
  if (error instanceof DFMError) {
    logger?.error(`DFMError: ${error.code}`, { message: error.message, details: error.details })
    return buildErrorResponse(error.code, error.message, error.details)
  }

  // Handle Zod validation errors
  if (isZodError(error)) {
    logger?.warn("Validation error", { issues: error.issues })
    return buildValidationErrorResponse(error)
  }

  // Handle zod-validation-error ValidationError
  if (isValidationErrorLike(error)) {
    logger?.warn("Validation error", { message: error.message })
    return buildErrorResponse(
      "INVALID_INPUT" as any,
      error.message,
      { details: (error as any).details }
    )
  }

  // Unknown error - log and return generic error
  logger?.error("Unexpected error", error)
  return buildErrorFromUnknown(error)
}

/**
 * Wrap handler function with error handling
 *
 * This utility automatically catches errors and converts them to
 * MCP responses, reducing boilerplate in handlers.
 *
 * @param handler - Async function to wrap
 * @param logger - Logger instance
 * @returns Wrapped function that catches errors
 *
 * @example
 * ```typescript
 * export const handleDeleteEntities = withErrorHandling(
 *   async (args, manager, logger) => {
 *     // ... implementation
 *   },
 *   logger
 * )
 * ```
 */
export function withErrorHandling<TArgs extends unknown[], TReturn>(
  handler: (...args: TArgs) => Promise<TReturn>,
  logger?: Logger
) {
  return async (...args: TArgs): Promise<TReturn | MCPToolResponse> => {
    try {
      return await handler(...args)
    } catch (error) {
      return handleError(error, logger)
    }
  }
}
```

**Verification**:
```bash
ls src/utils/error-handler.ts
mise run typecheck
```

---

### Step 3.3: Update Handlers to Use Error Classes

**Task**: Replace generic `throw new Error()` with specific error classes

**Example locations**:
- `src/database/sqlite-database.ts`
- `src/knowledge-graph/knowledge-graph-manager.ts`
- `src/embeddings/openai-embedding-service.ts`

**Pattern**:

```typescript
// ADD IMPORT at top of file:
import {
  EntityNotFoundError,
  RelationNotFoundError,
  DatabaseError,
  EmbeddingError,
} from "#errors"

// OLD:
throw new Error(`Entity not found: ${name}`)

// NEW:
throw new EntityNotFoundError(name)

// OLD:
throw new Error(`Database query failed: ${err.message}`)

// NEW:
throw new DatabaseError("Failed to query database", err)

// OLD:
throw new Error(`Embedding generation failed`)

// NEW:
throw new EmbeddingError("Failed to generate embedding", err)
```

**Search command**:
```bash
# Find all throw new Error statements
grep -rn "throw new Error" src --include="*.ts"
```

**For EACH occurrence**:
1. Determine the error type (validation, not found, database, etc.)
2. Replace with appropriate error class
3. Verify imports are added

**Verification**:
```bash
mise run typecheck

# Test that errors have structure
mise run test:e2e:debug
```

---

## =' Phase 4: Method Signatures

### Step 4.1: Update KnowledgeGraphManager Interface

**File**: `src/types/knowledge-graph.ts` (or wherever the interface is defined)

**Find the interface**:
```bash
grep -n "interface KnowledgeGraphManager" src --include="*.ts" -r
```

**Update the interface**:

```typescript
// ADD IMPORTS at top:
import type {
  Entity,
  EntityName,
  Observation,
  Relation,
  KnowledgeGraph,
  TemporalEntity,
  Timestamp,
} from "./validation.js"

// UPDATE INTERFACE:
export interface KnowledgeGraphManager {
  /**
   * Create new entities in the knowledge graph
   * @param entities - Array of entities to create
   * @returns Array of created entities
   */
  createEntities(entities: readonly Entity[]): Promise<readonly Entity[]>

  /**
   * Delete entities from the knowledge graph
   * @param entityNames - Array of entity names to delete
   */
  deleteEntities(entityNames: readonly EntityName[]): Promise<void>

  /**
   * Add observations to an existing entity
   * @param entityName - Name of the entity
   * @param contents - Array of observation strings
   */
  addObservations(
    entityName: EntityName,
    contents: readonly Observation[]
  ): Promise<void>

  /**
   * Delete specific observations from entities
   * @param deletions - Array of {entityName, observations} pairs
   * @returns Total number of observations deleted
   */
  deleteObservations(
    deletions: readonly Array<{
      entityName: EntityName
      observations: readonly Observation[]
    }>
  ): Promise<number>

  /**
   * Create relations between entities
   * @param relations - Array of relations to create
   * @returns Array of created relations
   */
  createRelations(relations: readonly Relation[]): Promise<readonly Relation[]>

  /**
   * Delete relations from the knowledge graph
   * @param relations - Array of relations to delete
   */
  deleteRelations(relations: readonly Relation[]): Promise<void>

  /**
   * Read the entire knowledge graph
   * @returns Knowledge graph with all entities and relations
   */
  readGraph(): Promise<KnowledgeGraph>

  /**
   * Search for entities by text query
   * @param query - Search query string
   * @returns Array of matching entities
   */
  searchNodes(query: string): Promise<readonly Entity[]>

  /**
   * Get entity version history
   * @param entityName - Name of the entity
   * @returns Array of temporal entity versions
   */
  getEntityHistory(entityName: EntityName): Promise<readonly TemporalEntity[]>

  /**
   * Get knowledge graph state at a specific time
   * @param timestamp - Unix timestamp in milliseconds
   * @returns Knowledge graph at the specified time
   */
  getGraphAtTime(timestamp: Timestamp): Promise<KnowledgeGraph>

  // ... other methods ...
}
```

**Key changes**:
- Use branded types (`EntityName`, `Timestamp`, etc.)
- Use `readonly` for array parameters (immutability)
- Add JSDoc comments for clarity

**Verification**:
```bash
mise run typecheck
```

---

### Step 4.2: Update Implementation Classes

**Files to update**:
- `src/knowledge-graph/knowledge-graph-manager.ts` (implementation)
- `src/database/sqlite-database.ts` (database layer)

**Process**:

1. **Find the implementation file**:
```bash
ls src/knowledge-graph/*.ts
```

2. **Update method signatures to match interface**:

```typescript
// Example for createEntities:

// OLD:
async createEntities(entities: Entity[]): Promise<Entity[]> {
  // ...
}

// NEW:
async createEntities(entities: readonly Entity[]): Promise<readonly Entity[]> {
  // ...
}
```

3. **Update database layer similarly**:

```typescript
// src/database/sqlite-database.ts

// OLD:
async getEntity(name: string): Promise<Entity | null> {
  // ...
}

// NEW:
import type { EntityName } from "#types/validation.js"

async getEntity(name: EntityName): Promise<Entity | null> {
  // ...
}
```

4. **Handle brand type conversions**:

When you need to convert branded types to plain types for database queries:

```typescript
// Branded type to plain type:
const plainName: string = entityName as string

// Plain type to branded type (with validation):
const brandedName = EntityNameSchema.parse(plainName)

// In database queries, use plain types:
const row = await this.db.get(
  "SELECT * FROM entities WHERE name = ?",
  entityName as string
)
```

**Verification after EACH file**:
```bash
mise run typecheck
```

---

### Step 4.3: Update Embedding Service

**File**: `src/embeddings/openai-embedding-service.ts`

**Updates**:

1. **Add imports**:
```typescript
import type { EntityName } from "#types/validation.js"
import { EmbeddingError } from "#errors"
```

2. **Update method signatures**:
```typescript
// OLD:
async generateEmbedding(entityName: string, text: string): Promise<number[]> {
  // ...
}

// NEW:
async generateEmbedding(
  entityName: EntityName,
  text: string
): Promise<readonly number[]> {
  // ...
}
```

3. **Replace error throws**:
```typescript
// OLD:
catch (error) {
  throw new Error(`Failed to generate embedding: ${error.message}`)
}

// NEW:
catch (error) {
  throw new EmbeddingError("Failed to generate embedding", error as Error)
}
```

**Verification**:
```bash
mise run typecheck
```

---

## >ê Phase 5: Testing Infrastructure

### Step 5.1: Create Test Builders Directory

```bash
mkdir -p src/tests/builders
```

---

### Step 5.2: Create Entity Builder

**File**: `src/tests/builders/entity-builder.ts` (NEW FILE)

```typescript
/**
 * Entity Builder for Tests
 *
 * Provides a fluent API for constructing test entities.
 */

import {
  EntityNameSchema,
  ObservationSchema,
  EntitySchema,
  EntityTypeSchema,
} from "#types/validation.js"
import type { Entity, EntityType } from "#types/validation.js"

/**
 * Builder class for creating test entities
 *
 * @example
 * ```typescript
 * const entity = new EntityBuilder()
 *   .withName("test_entity")
 *   .withType("feature")
 *   .withObservations("First observation", "Second observation")
 *   .build()
 * ```
 */
export class EntityBuilder {
  private entity: Partial<Entity> = {}

  /**
   * Set entity name
   */
  withName(name: string): this {
    this.entity.name = EntityNameSchema.parse(name)
    return this
  }

  /**
   * Set entity type
   */
  withType(type: EntityType): this {
    this.entity.entityType = type
    return this
  }

  /**
   * Set observations
   */
  withObservations(...observations: string[]): this {
    this.entity.observations = observations.map((o) => ObservationSchema.parse(o))
    return this
  }

  /**
   * Add a single observation
   */
  addObservation(observation: string): this {
    if (!this.entity.observations) {
      this.entity.observations = []
    }
    this.entity.observations.push(ObservationSchema.parse(observation))
    return this
  }

  /**
   * Build the entity
   * Applies defaults for missing required fields
   */
  build(): Entity {
    return EntitySchema.parse({
      name: "default_entity",
      entityType: "feature",
      observations: ["Default observation"],
      ...this.entity,
    })
  }
}

/**
 * Helper function to create entity builder
 * @returns New EntityBuilder instance
 */
export function buildEntity(): EntityBuilder {
  return new EntityBuilder()
}
```

**Verification**:
```bash
ls src/tests/builders/entity-builder.ts
mise run typecheck
```

---

### Step 5.3: Create Relation Builder

**File**: `src/tests/builders/relation-builder.ts` (NEW FILE)

```typescript
/**
 * Relation Builder for Tests
 *
 * Provides a fluent API for constructing test relations.
 */

import {
  EntityNameSchema,
  RelationSchema,
  RelationTypeSchema,
  StrengthScoreSchema,
  ConfidenceScoreSchema,
} from "#types/validation.js"
import type { Relation, RelationType } from "#types/validation.js"

/**
 * Builder class for creating test relations
 *
 * @example
 * ```typescript
 * const relation = new RelationBuilder()
 *   .from("entity_a")
 *   .to("entity_b")
 *   .withType("depends_on")
 *   .withStrength(0.8)
 *   .build()
 * ```
 */
export class RelationBuilder {
  private relation: Partial<Relation> = {}

  /**
   * Set source entity
   */
  from(entityName: string): this {
    this.relation.from = EntityNameSchema.parse(entityName)
    return this
  }

  /**
   * Set target entity
   */
  to(entityName: string): this {
    this.relation.to = EntityNameSchema.parse(entityName)
    return this
  }

  /**
   * Set relation type
   */
  withType(type: RelationType): this {
    this.relation.relationType = type
    return this
  }

  /**
   * Set strength score
   */
  withStrength(strength: number): this {
    this.relation.strength = StrengthScoreSchema.parse(strength)
    return this
  }

  /**
   * Set confidence score
   */
  withConfidence(confidence: number): this {
    this.relation.confidence = ConfidenceScoreSchema.parse(confidence)
    return this
  }

  /**
   * Build the relation
   * Applies defaults for missing required fields
   */
  build(): Relation {
    return RelationSchema.parse({
      from: "entity_a",
      to: "entity_b",
      relationType: "relates_to",
      ...this.relation,
    })
  }
}

/**
 * Helper function to create relation builder
 * @returns New RelationBuilder instance
 */
export function buildRelation(): RelationBuilder {
  return new RelationBuilder()
}
```

**Verification**:
```bash
ls src/tests/builders/relation-builder.ts
mise run typecheck
```

---

### Step 5.4: Create Response Assertions

**File**: `src/tests/assertions/response-assertions.ts` (NEW FILE)

```bash
mkdir -p src/tests/assertions
```

```typescript
/**
 * Response Assertions for Tests
 *
 * Type-safe assertion functions for MCP tool responses.
 */

import { strictEqual, ok } from "node:assert/strict"
import type { SuccessResponse, ErrorResponse, ErrorCode } from "#types/responses.js"

/**
 * Assert that response is a success response
 *
 * @param response - Response to check
 * @throws AssertionError if response is not a success response
 *
 * @example
 * ```typescript
 * assertSuccessResponse(response)
 * // Now TypeScript knows response is SuccessResponse<T>
 * console.log(response.data)
 * ```
 */
export function assertSuccessResponse<T>(
  response: unknown
): asserts response is SuccessResponse<T> {
  strictEqual(typeof response, "object", "Response should be an object")
  ok(response !== null, "Response should not be null")
  strictEqual((response as any).success, true, "Response should have success: true")
  ok("data" in (response as any), "Response should have data property")
}

/**
 * Assert that response is an error response
 *
 * @param response - Response to check
 * @param expectedCode - Optional expected error code
 * @throws AssertionError if response is not an error response
 *
 * @example
 * ```typescript
 * assertErrorResponse(response, ErrorCode.ENTITY_NOT_FOUND)
 * ```
 */
export function assertErrorResponse(
  response: unknown,
  expectedCode?: ErrorCode
): asserts response is ErrorResponse {
  strictEqual(typeof response, "object", "Response should be an object")
  ok(response !== null, "Response should not be null")
  strictEqual((response as any).success, false, "Response should have success: false")
  ok("error" in (response as any), "Response should have error property")

  const error = (response as any).error
  ok("code" in error, "Error should have code property")
  ok("message" in error, "Error should have message property")

  if (expectedCode !== undefined) {
    strictEqual(
      error.code,
      expectedCode,
      `Expected error code ${expectedCode}, got ${error.code}`
    )
  }
}

/**
 * Assert that response is a validation error
 *
 * @param response - Response to check
 * @throws AssertionError if response is not a validation error
 */
export function assertValidationError(response: unknown): asserts response is ErrorResponse {
  assertErrorResponse(response, "INVALID_INPUT" as ErrorCode)
}

/**
 * Assert that response is an entity not found error
 *
 * @param response - Response to check
 * @throws AssertionError if response is not an entity not found error
 */
export function assertEntityNotFoundError(
  response: unknown
): asserts response is ErrorResponse {
  assertErrorResponse(response, "ENTITY_NOT_FOUND" as ErrorCode)
}
```

**Verification**:
```bash
ls src/tests/assertions/response-assertions.ts
mise run typecheck
```

---

### Step 5.5: Update Test Helpers

**File**: `src/tests/integration/e2e/fixtures/helpers.js`

**Find the MCPTestHelper class and update**:

```javascript
// ADD IMPORTS at top:
import { ok, strictEqual } from "node:assert/strict"
import {
  assertSuccessResponse,
  assertErrorResponse,
} from "#tests/assertions/response-assertions.js"

// UPDATE callToolJSON method (around line 20):
/**
 * Call a tool and parse JSON response
 * Automatically handles success/error responses
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
    throw new Error(`Tool ${name} returned error: ${parsed.error.message} (${parsed.error.code})`)
  }

  throw new Error("Invalid content type")
}

// ADD NEW METHOD:
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
    ok(content.type === "text", "content should be text")
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
```

**Verification**:
```bash
mise run typecheck
```

---

### Step 5.6: Update E2E Tests

**File**: `src/tests/integration/e2e/01-crud.test.js`

**Example updates**:

```javascript
// Test should now use error codes instead of message matching:

// OLD:
test("should fail with invalid entity name", async () => {
  await t.rejects(
    helper.callToolJSON("create_entities", {
      entities: [{ name: "123invalid", entityType: "feature", observations: ["test"] }],
    }),
    /Entity name must start with/
  )
})

// NEW:
import { ErrorCode } from "#types/responses.js"

test("should fail with invalid entity name", async () => {
  const error = await helper.expectToolError(
    "create_entities",
    {
      entities: [{ name: "123invalid", entityType: "feature", observations: ["test"] }],
    },
    ErrorCode.INVALID_INPUT
  )

  ok(error.error.code === ErrorCode.INVALID_INPUT)
  ok(error.error.message.includes("Entity name"))
})
```

**Process**:
1. Find tests that check error messages with regex
2. Replace with `expectToolError` and error code checks
3. Update success response assertions to check data structure

**Verification**:
```bash
mise run test:e2e:debug
```

---

##  Verification & Testing

### Final Type Check

```bash
mise run typecheck
```

**Expected**: No type errors

---

### Final Build

```bash
mise run clean
mise run build
```

**Expected**: Build completes successfully

---

### Run E2E Tests

```bash
mise run test:e2e
```

**Expected**: Tests pass or fail consistently (not with type errors)

---

### Check for Remaining Issues

```bash
# No arktype imports
grep -r "arktype" src --include="*.ts"
# Should return nothing

# No manual validation
grep -r "validateString\|validateArray\|validateNumber" src --include="*.ts"
# Should return nothing

# All Zod imports use config
grep -r 'from "zod"' src --include="*.ts"
# Should return nothing

# Response builders used consistently
grep -r "content: \[" src/server/handlers --include="*.ts" | grep -v "buildSuccessResponse\|buildErrorResponse"
# Should have minimal results (only in response-builders.ts)
```

---

## = Troubleshooting

### Issue: TypeScript path alias not resolving

**Error**: `Cannot find module '#types/validation.js'`

**Solution**:
1. Check `tsconfig.json` has paths configured:
   ```json
   "paths": {
     "#*": ["./src/*"]
   }
   ```
2. Restart TypeScript server in your editor
3. Run `mise run typecheck` to verify

---

### Issue: Zod error "Property 'brand' does not exist"

**Error**: `Property 'brand' does not exist on type 'ZodString'`

**Solution**:
- Check Zod version: `pnpm list zod`
- Should be v3.23+ for `.brand()` support
- Update if needed: `pnpm update zod`

---

### Issue: Tests failing with JSON parse errors

**Error**: `Unexpected token in JSON at position X`

**Solution**:
1. Check response building - ensure `JSON.stringify()` is used
2. Verify response format matches MCPToolResponse type
3. Add logging to see raw response:
   ```typescript
   console.log("Raw response:", JSON.stringify(response, null, 2))
   ```

---

### Issue: Branded types causing type errors

**Error**: `Type 'string' is not assignable to type 'EntityName'`

**Solution**:
```typescript
// When you have a plain string and need branded type:
const brandedName = EntityNameSchema.parse(plainString)

// When you have a branded type and need plain string:
const plainString: string = brandedName as string

// In function parameters, accept branded type:
function foo(name: EntityName): void {
  // name is already validated
}
```

---

### Issue: Import errors after file moves

**Error**: `Cannot find module './old-path.js'`

**Solution**:
1. Search for all imports of the moved file:
   ```bash
   grep -r "old-path" src --include="*.ts"
   ```
2. Update each import to new path
3. Use path alias if importing from src:
   ```typescript
   import { Foo } from "#new/path.js"
   ```

---

## =Ú Reference: Complete File Checklist

Use this checklist to track progress:

### Phase 0: Setup
- [ ] `pnpm add zod-validation-error`
- [ ] `pnpm remove arktype arkenv`
- [ ] Create `src/config/zod-config.ts`
- [ ] Update all Zod imports to use config

### Phase 1: Foundation
- [ ] Update `src/types/validation.ts` with branded types
- [ ] Add tool input schemas to `src/types/validation.ts`
- [ ] Delete `src/types/shared.ts`
- [ ] Remove ArkType from all type files
- [ ] Remove manual validation functions

### Phase 2: Response System
- [ ] Create `src/types/responses.ts`
- [ ] Create `src/utils/response-builders.ts`
- [ ] Update `src/server/handlers/tool-handlers.ts`
- [ ] Update `src/server/handlers/call-tool-handler.ts`

### Phase 3: Error Handling
- [ ] Create `src/errors/index.ts`
- [ ] Create `src/utils/error-handler.ts`
- [ ] Update error throws to use error classes

### Phase 4: Method Signatures
- [ ] Update KnowledgeGraphManager interface
- [ ] Update KnowledgeGraphManager implementation
- [ ] Update SqliteDatabase class
- [ ] Update embedding service

### Phase 5: Testing
- [ ] Create `src/tests/builders/entity-builder.ts`
- [ ] Create `src/tests/builders/relation-builder.ts`
- [ ] Create `src/tests/assertions/response-assertions.ts`
- [ ] Update `src/tests/integration/e2e/fixtures/helpers.js`
- [ ] Update E2E tests to use new patterns

### Verification
- [ ] `mise run typecheck` passes
- [ ] `mise run build` succeeds
- [ ] `mise run test:e2e` runs (may have failures to fix)
- [ ] No arktype imports remain
- [ ] No manual validation functions remain
- [ ] All responses use builders

---

## <¯ Success Criteria

When you complete this guide, the following should be true:

1.  Zero ArkType dependencies (`grep -r "arktype" src` returns nothing)
2.  Zero manual validation (`grep -r "validateString" src` returns nothing)
3.  All Zod imports use config (`grep -r 'from "zod"' src` returns nothing)
4.  All tools use response builders
5.  All errors use error codes
6.  TypeScript compiles without errors (`mise run typecheck`)
7.  Project builds successfully (`mise run build`)
8.  E2E tests can run (may need test fixes, but no build errors)

---

## =Þ Need Help?

If you encounter issues:

1. Check the [Troubleshooting](#troubleshooting) section
2. Verify you followed each step exactly
3. Check `mise run typecheck` for type errors
4. Review the [REFACTORING_PLAN.md](./REFACTORING_PLAN.md) for context

---

**Good luck! This is a large refactoring, but following these steps systematically will get you there.** =€
