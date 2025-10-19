# Quick Reference Guide

**One-page summary for the next session**

## 🚨 START HERE

**The current code produces WRONG response format!**

Before doing ANYTHING else:
1. Read [NEXT_SESSION_TASKS.md](./NEXT_SESSION_TASKS.md)
2. Fix MCP compliance (3-4 hours)
3. Test one handler
4. Then continue with other phases

## The Problem

```typescript
// ❌ WHAT WE BUILT (WRONG)
return {
  content: [{
    type: "text",
    text: JSON.stringify({ success: false, error: {...} })
  }]
}

// ✅ WHAT MCP EXPECTS (CORRECT)
return {
  isError: true,
  content: [{ type: "text", text: "Error message" }]
}
```

## What Works

✅ Zod configuration with friendly errors
✅ Branded types (EntityName, Timestamp, etc.)
✅ Tool input schemas (17 total)
✅ Custom error classes
✅ Handler validation logic

## What Needs Fixing

🔴 Add `isError` and `structuredContent` to MCPToolResponse
🔴 Rewrite response builders (much simpler!)
🔴 Update error classes with `toMCPMessage()`
🔴 Simplify error handler
🔴 Update all handlers (20+)

## Quick Wins

### Response Builder (New)

```typescript
// Success
export function buildSuccessResponse<T>(data: T): MCPToolResponse {
  return {
    content: [{ type: "text", text: JSON.stringify(data) }],
    structuredContent: data
  }
}

// Error
export function buildErrorResponse(message: string): MCPToolResponse {
  return {
    isError: true,
    content: [{ type: "text", text: message }]
  }
}
```

### Handler Pattern

```typescript
async function handleTool(args: unknown, manager, logger) {
  try {
    // Validate
    const result = InputSchema.safeParse(args)
    if (!result.success) {
      return buildValidationErrorResponse(result.error)
    }

    // Execute
    const data = await manager.doWork(result.data)

    // Return
    return buildSuccessResponse(data)
  } catch (error) {
    return handleError(error, logger)
  }
}
```

## Branded Types Flow

```typescript
// 1. JSON input (unknown)
{ "entityName": "User" }

// 2. Validate with Zod
const result = EntityNameSchema.safeParse(input)

// 3. Use branded type
const name: EntityName = result.data  // Branded!

// 4. Extract when calling business logic
await manager.getEntity(name as string)
```

## Key Files

### Must Read
- [NEXT_SESSION_TASKS.md](./NEXT_SESSION_TASKS.md) - Step-by-step fixes
- [MCP_COMPLIANCE_REQUIREMENTS.md](./MCP_COMPLIANCE_REQUIREMENTS.md) - Protocol spec

### Reference
- [MIGRATION_STATUS.md](./MIGRATION_STATUS.md) - Overall progress
- [BRANDED_TYPES_ARCHITECTURE.md](./BRANDED_TYPES_ARCHITECTURE.md) - Type system
- [SESSION_SUMMARY.md](./SESSION_SUMMARY.md) - Detailed summary

### To Update
- `src/types/responses.ts` - Add isError & structuredContent
- `src/utils/response-builders.ts` - Complete rewrite
- `src/errors/index.ts` - Add toMCPMessage()
- `src/utils/error-handler.ts` - Simplify
- `src/server/handlers/tool-handlers.ts` - Update all
- `src/server/handlers/call-tool-handler.ts` - Update all

## Import Patterns

```typescript
// ✅ ALWAYS use # imports
import { z } from "#config"
import { EntitySchema } from "#types/validation"
import { buildSuccessResponse } from "#utils/response-builders"

// ❌ NEVER use .js extensions
import { z } from "#config/zod-config.js"  // WRONG

// ❌ NEVER use relative paths
import { z } from "./zod-config"  // WRONG
```

## Testing After Fix

```bash
# 1. Build
pnpm build

# 2. Start server
pnpm start

# 3. Test with MCP Inspector or client

# Expected success:
{
  "content": [{ "type": "text", "text": "{...}" }],
  "structuredContent": {...}
}

# Expected error:
{
  "isError": true,
  "content": [{ "type": "text", "text": "ERROR: message" }]
}
```

## Common Mistakes

1. ❌ Using `ErrorCode` in responses (keep it internal)
2. ❌ Encoding success/error in JSON (use `isError` flag)
3. ❌ Complex error objects (use simple strings)
4. ❌ Forgetting `structuredContent` (include it!)
5. ❌ Not validating input (always use Zod schemas)

## Next Steps After Compliance Fix

1. **Phase 3**: Error classes in business logic
2. **Phase 4**: Branded types in method signatures
3. **Phase 5**: Test builders and E2E updates
4. **Verify**: Full test suite passes

## Emergency Rollback

If things break badly:
```bash
git stash  # Save current work
git checkout [commit-before-session]  # Rollback
# Review docs and start over carefully
```

## Verification Checklist

- [ ] `pnpm build` succeeds
- [ ] `pnpm typecheck` passes
- [ ] Handlers return `{ isError: true }` for errors
- [ ] Handlers return `{ structuredContent: {} }` for success
- [ ] Error messages are simple strings
- [ ] One tool tested manually and works

## Time Estimates

- Fix response format: **2-3 hours**
- Test and verify: **30 minutes**
- Add output schemas: **1 hour** (optional)

**Total**: 3-4 hours for MCP compliance

## Key Principles

1. **Validate Early** - Check inputs before processing
2. **Fail Safely** - Return errors, don't throw at protocol level
3. **Log Internally** - Full details in logs, safe messages in responses
4. **Type Everything** - Use Zod schemas for inputs AND outputs
5. **Test Thoroughly** - One working handler before updating all

## Documentation

All docs in `/docs`:
- This file - Quick reference
- NEXT_SESSION_TASKS.md - Step-by-step guide
- MCP_COMPLIANCE_REQUIREMENTS.md - Full spec
- MIGRATION_STATUS.md - Progress tracking
- BRANDED_TYPES_ARCHITECTURE.md - Type system
- SESSION_SUMMARY.md - Detailed overview

## Support Resources

- [MCP Docs](https://modelcontextprotocol.io/docs/concepts/tools)
- [MCP Error Handling](https://modelcontextprotocol.io/docs/concepts/tools#error-handling-2)
- [Zod Docs](https://zod.dev/)
- [GitHub Issue #547](https://github.com/modelcontextprotocol/modelcontextprotocol/issues/547)

---

**Remember**: Fix MCP compliance FIRST. Everything else depends on correct response format.

**Start with**: [NEXT_SESSION_TASKS.md](./NEXT_SESSION_TASKS.md)
