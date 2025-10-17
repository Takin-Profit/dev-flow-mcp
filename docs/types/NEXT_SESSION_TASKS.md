# Next Session: MCP Compliance Fix

**Priority**: CRITICAL - Must be done before any other work

## Overview

We discovered that our response format does NOT match MCP specification. This document provides a step-by-step plan to fix it.

## The Core Problem

**What we built:**
```typescript
return {
  content: [{
    type: "text",
    text: JSON.stringify({ success: false, error: { code: "...", message: "..." } })
  }]
}
```

**What MCP expects:**
```typescript
return {
  isError: true,
  content: [{
    type: "text",
    text: "Error message"
  }]
}
```

## Task Breakdown

### Task 1: Update Response Type (15 minutes)

**File**: `src/types/responses.ts`

**Current**:
```typescript
export const MCPToolResponseSchema = z.object({
  content: z.array(
    z.object({
      type: z.literal("text"),
      text: z.string(),
    }),
  ),
})
```

**Change to**:
```typescript
export const MCPToolResponseSchema = z.object({
  content: z.array(
    z.object({
      type: z.literal("text"),
      text: z.string(),
    }),
  ),
  isError: z.boolean().optional(),
  structuredContent: z.record(z.unknown()).optional(),
})
```

**Also remove** or comment out all the specific response schemas (CreateEntitiesResponseSchema, etc.) - we'll add them back as output schemas later.

### Task 2: Rewrite Response Builders (30 minutes)

**File**: `src/utils/response-builders.ts`

**Delete everything and replace with**:

```typescript
import type { MCPToolResponse } from "#types/responses"
import type { ZodError } from "zod"
import { fromZodError } from "zod-validation-error"

/**
 * Build a successful MCP tool response
 *
 * @param data - The response data
 * @returns MCP-formatted tool response with structured content
 */
export function buildSuccessResponse<T>(data: T): MCPToolResponse {
  return {
    content: [{
      type: "text",
      text: JSON.stringify(data, null, 2)
    }],
    structuredContent: data as Record<string, unknown>
  }
}

/**
 * Build an error MCP tool response
 *
 * @param message - Human-readable error message
 * @returns MCP-formatted error response
 */
export function buildErrorResponse(message: string): MCPToolResponse {
  return {
    isError: true,
    content: [{
      type: "text",
      text: message
    }]
  }
}

/**
 * Build error response from Zod validation failure
 *
 * @param zodError - The Zod validation error
 * @returns MCP-formatted error response
 */
export function buildValidationErrorResponse(zodError: ZodError): MCPToolResponse {
  const validationError = fromZodError(zodError, {
    prefix: "Validation failed",
    prefixSeparator: ": ",
    includePath: true,
    maxIssuesInMessage: 5,
  })

  return buildErrorResponse(validationError.message)
}
```

**That's it!** Much simpler than before.

### Task 3: Update Error Classes (15 minutes)

**File**: `src/errors/index.ts`

**Add this method to DFMError class**:

```typescript
export class DFMError extends Error {
  constructor(
    public readonly code: ErrorCode,
    message: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message)
    this.name = "DFMError"
    Error.captureStackTrace(this, this.constructor)
  }

  /**
   * Convert to MCP error message
   * Format: "ERROR_CODE: message (details)"
   */
  toMCPMessage(): string {
    const detailsStr = this.details
      ? ` (${JSON.stringify(this.details)})`
      : ''
    return `${this.code}: ${this.message}${detailsStr}`
  }
}
```

### Task 4: Simplify Error Handler (10 minutes)

**File**: `src/utils/error-handler.ts`

**Replace everything with**:

```typescript
import type { ZodError } from "zod"
import { isValidationErrorLike } from "zod-validation-error"
import { buildErrorResponse, buildValidationErrorResponse } from "#utils/response-builders"
import { DFMError } from "#errors"
import type { Logger } from "#types/logger"
import type { MCPToolResponse } from "#types/responses"

/**
 * Type guard to check if error is a Zod error
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
 * @param error - Unknown error object
 * @param logger - Logger instance for error logging
 * @returns MCP-formatted error response
 */
export function handleError(error: unknown, logger?: Logger): MCPToolResponse {
  // Log full error internally
  logger?.error("Tool error", error)

  // Handle custom DFM errors
  if (error instanceof DFMError) {
    return buildErrorResponse(error.toMCPMessage())
  }

  // Handle Zod validation errors
  if (isZodError(error)) {
    return buildValidationErrorResponse(error)
  }

  // Handle zod-validation-error ValidationError
  if (isValidationErrorLike(error)) {
    return buildErrorResponse(error.message)
  }

  // Handle standard Error
  if (error instanceof Error) {
    return buildErrorResponse(error.message)
  }

  // Unknown error type
  return buildErrorResponse("An unexpected error occurred")
}
```

**Remove** the `withErrorHandling` function - we don't need it.

### Task 5: Update Tool Handlers (45 minutes)

**File**: `src/server/handlers/tool-handlers.ts`

**Pattern for each handler**:

```typescript
export async function handleCreateEntities(
  args: unknown,
  knowledgeGraphManager: KnowledgeGraphManager,
  logger?: Logger,
): Promise<MCPToolResponse> {
  try {
    // 1. Validate input
    const result = CreateEntitiesInputSchema.safeParse(args)
    if (!result.success) {
      logger?.warn("create_entities validation failed", {
        issues: result.error.issues,
      })
      return buildValidationErrorResponse(result.error)
    }

    const { entities } = result.data

    logger?.debug("create_entities called", {
      entityCount: entities.length,
    })

    // 2. Perform operation
    const created = await knowledgeGraphManager.createEntities(entities)

    logger?.info("create_entities completed", {
      created: created.length,
    })

    // 3. Build response (simplified!)
    return buildSuccessResponse({
      created: created.length,
      entities: created,
    })
  } catch (error) {
    return handleError(error, logger)
  }
}
```

**Apply this pattern to all 5 handlers**:
- handleCreateEntities
- handleCreateRelations
- handleDeleteEntities
- handleReadGraph
- handleAddObservations

### Task 6: Update Call Tool Handler (60 minutes)

**File**: `src/server/handlers/call-tool-handler.ts`

**For each tool case**, update to new response format:

**Before**:
```typescript
case "delete_observations": {
  try {
    const result = DeleteObservationsInputSchema.safeParse(args)
    if (!result.success) {
      logger.warn("delete_observations validation failed", {
        issues: result.error.issues,
      })
      return buildValidationErrorResponse(result.error)
    }

    const { deletions } = result.data

    logger.debug("delete_observations called", {
      deletionCount: deletions.length,
    })

    await knowledgeGraphManager.deleteObservations(deletions)

    logger.info("delete_observations completed", {
      deleted: deletions.length,
    })

    const totalDeleted = deletions.reduce(
      (sum, d) => sum + d.observations.length,
      0,
    )

    return buildSuccessResponse({
      deleted: totalDeleted,
      entities: deletions.map((d) => ({
        entityName: d.entityName,
        deletedCount: d.observations.length,
      })),
    })
  } catch (error) {
    return handleError(error, logger)
  }
}
```

**After**: Same code! The only change is `buildSuccessResponse` now works correctly.

**But check error responses** - make sure they use simple messages:

```typescript
// ✅ Good
return buildErrorResponse("Entity not found: MyEntity")

// ❌ Bad
return buildErrorResponse(
  ErrorCode.ENTITY_NOT_FOUND,
  "Entity not found: MyEntity",
  { entityName: "MyEntity" }
)
```

### Task 7: Test One Handler (30 minutes)

**Manual test**:
1. Build the project: `pnpm build`
2. Start the server: `pnpm start`
3. Test with MCP Inspector or a client
4. Check response format matches spec

**Expected success response**:
```json
{
  "content": [{
    "type": "text",
    "text": "{\"created\": 1, \"entities\": [...]}"
  }],
  "structuredContent": {
    "created": 1,
    "entities": [...]
  }
}
```

**Expected error response**:
```json
{
  "isError": true,
  "content": [{
    "type": "text",
    "text": "ENTITY_NOT_FOUND: Entity 'User' not found (entityName: \"User\")"
  }]
}
```

### Task 8: Add Output Schemas (Optional - 60 minutes)

**After response format is fixed**, add output schemas to validation.ts:

```typescript
// src/types/validation.ts

/**
 * ============================================================================
 * Tool Output Schemas
 * ============================================================================
 */

export const CreateEntitiesOutputSchema = z.object({
  created: z.number().int().nonnegative(),
  entities: z.array(EntitySchema),
})

export const DeleteEntitiesOutputSchema = z.object({
  deleted: z.number().int().nonnegative(),
  entityNames: z.array(EntityNameSchema),
})

// ... add for all 17 tools
```

**Then use in handlers**:
```typescript
// Validate output before returning
const output = {
  created: created.length,
  entities: created,
}

// Optional: validate against output schema
const validatedOutput = CreateEntitiesOutputSchema.parse(output)

return buildSuccessResponse(validatedOutput)
```

**This is optional but recommended** - it catches implementation errors early.

## Verification Checklist

After completing all tasks:

- [ ] `pnpm build` succeeds
- [ ] `pnpm typecheck` passes
- [ ] All handlers return `{ isError: true, content: [...] }` for errors
- [ ] All handlers return `{ content: [...], structuredContent: {...} }` for success
- [ ] Error messages are simple strings, not JSON objects
- [ ] Success responses include structured content
- [ ] Manual test with one tool shows correct format

## Files Changed Summary

1. `src/types/responses.ts` - Add isError and structuredContent fields
2. `src/utils/response-builders.ts` - Complete rewrite (simpler)
3. `src/errors/index.ts` - Add toMCPMessage() method
4. `src/utils/error-handler.ts` - Simplify to use new builders
5. `src/server/handlers/tool-handlers.ts` - Update 5 handlers
6. `src/server/handlers/call-tool-handler.ts` - Update all remaining handlers
7. (Optional) `src/types/validation.ts` - Add output schemas

## Estimated Time

- Core fixes (Tasks 1-6): **2-3 hours**
- Testing (Task 7): **30 minutes**
- Output schemas (Task 8): **1 hour** (optional)

**Total**: 3-4 hours for full MCP compliance

## Common Pitfalls to Avoid

1. **Don't keep ErrorCode in responses** - Use it in error classes, but convert to strings in responses
2. **Don't encode success/error in JSON** - Use isError flag
3. **Don't forget structuredContent** - Include it for data-heavy responses
4. **Don't leak internal details** - Keep error messages user-friendly
5. **Don't skip validation** - Always validate with Zod schemas

## After This Session

Once MCP compliance is fixed, continue with:
1. Phase 3: Replace Error throws with error classes in business logic
2. Phase 4: Update business logic method signatures to use branded types
3. Phase 5: Create test builders and update E2E tests
4. Final verification

## References

- [MCP_COMPLIANCE_REQUIREMENTS.md](./MCP_COMPLIANCE_REQUIREMENTS.md) - Full spec details
- [MIGRATION_STATUS.md](./MIGRATION_STATUS.md) - Overall migration status
- [BRANDED_TYPES_ARCHITECTURE.md](./BRANDED_TYPES_ARCHITECTURE.md) - How branded types work
