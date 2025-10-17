# Code Review Prompt for MCP Compliance Implementation

## Quick Start

You're reviewing Phase 2 of the DevFlow MCP migration: **MCP Protocol Compliance**.

### 1. Read These Files First (in order):

1. `docs/MIGRATION_STATUS.md` - Current status and context (5 min)
2. `docs/types/IMPLEMENTATION_COMPLETE.md` - What was done and why (15 min)
3. `docs/types/CODE_REVIEW_GUIDE.md` - Detailed review checklist (reference)

### 2. Review These 7 Changed Files:

**Core Changes:**
1. `src/types/responses.ts` (lines 22-31) - Added `isError` and `structuredContent` fields
2. `src/utils/response-builders.ts` - Simplified response builders (87 lines total)
3. `src/errors/index.ts` (lines 31-38) - Added `toMCPMessage()` method

**Handler Updates:**
4. `src/utils/error-handler.ts` - Simplified error handling (62 lines total)
5. `src/server/handlers/tool-handlers.ts` - Updated 5 core handlers
6. `src/server/handlers/call-tool-handler.ts` - Updated 12+ additional handlers
7. `src/types/validation.ts` (lines 625-816) - Added 17 output schemas

### 3. Check For:

**Critical (Must Pass):**
- [ ] Success responses have `content` array AND `structuredContent` object
- [ ] Error responses have `isError: true` flag
- [ ] Error messages are simple strings (not JSON objects)
- [ ] All 17+ handlers use consistent response pattern
- [ ] Build succeeds (`pnpm build`)

**Important (Should Pass):**
- [ ] Error messages are user-friendly and informative
- [ ] No sensitive data in error messages or logs
- [ ] Type safety maintained (branded types used correctly)
- [ ] No code duplication or unnecessary complexity

### 4. Test Manually (If Possible):

```bash
# Build and check bundle size
pnpm build

# Should output: ~160KB bundle, no TypeScript errors from this work
```

### 5. Decision:

**APPROVE** if all critical checks pass and implementation matches MCP specification.

**REQUEST CHANGES** if you find issues with response format compliance or error handling.

---

**Questions?** Reference `docs/types/MCP_COMPLIANCE_REQUIREMENTS.md` for the official MCP specification.
