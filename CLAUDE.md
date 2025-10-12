# DevFlow MCP Server - Development Continuation Guide

## Project Overview

**Project Name:** DevFlow MCP Server (fork of Memento MCP)  
**Version:** 1.0.0  
**Package Manager:** pnpm (NOT npm)  
**Node Version:** v24.10.0  
**TypeScript:** Latest with strict configuration

This is a knowledge graph memory layer specifically designed for software development workflows, supporting a cascading agent workflow (Planner → Task Creator → Coder/Executor → Reviewer).

## Current State of the Project

### ✅ What Has Been Completed

1. **Test Migration from Vitest to Node.js Native Test Runner**
   - All tests converted from Vitest to `node:test` (Node.js built-in test runner)
   - Consolidated tests into two main files:
     - `src/index.test.ts` - Tests for the main entry point
     - `src/knowledge-graph-manager.test.ts` - Tests for the core knowledge graph manager
   - **Note:** The `__vitest__` folder still exists and should be deleted
   - Test command updated to: `cross-env NODE_OPTIONS='--experimental-strip-types --disable-warning=ExperimentalWarning' node --test`

2. **TypeScript Configuration Modernization**
   - Updated `tsconfig.json` with strict settings from reference project
   - Key settings applied:
     - `"moduleResolution": "bundler"` (allows imports without `.js` extensions)
     - `"target": "ESNext"`
     - `"module": "ESNext"`
     - Strict type checking enabled (all strict flags)
     - `"noUncheckedIndexedAccess": true`
     - `"noUnusedLocals": true`
     - `"noUnusedParameters": false`
     - Path mappings configured: `"#*": ["./src/*"]`
     - **Important:** No `baseUrl` (deprecated)
   - Full include patterns added for `./src/**/*.ts`, `./src/**/*.test.ts`, etc.

3. **Package.json Updates**
   - Added `"imports": { "#*": "./src/*" }` for path aliasing
   - Renamed package to `devflow-mcp`
   - Version set to `1.0.0`
   - Binary renamed to `dfm-server`
   - Test script uses `cross-env` for cross-platform compatibility

4. **Development Tools**
   - Using `ultracite` (Biome-based) for linting and formatting
   - Biome rules enforce strict code quality (see `.github/copilot-instructions.md`)
   - Commands:
     - `pnpm run lint` - Check for lint errors
     - `pnpm run format` - Auto-format code
     - `npx ultracite check <file>` - Check specific file
     - `npx ultracite fix <file>` - Fix specific file

## 🚧 Current Task: Import Cleanup

### What We're Doing

Cleaning up import statements across the codebase to remove `.js` extensions, enabled by the new TypeScript configuration with `"moduleResolution": "bundler"`.

### Progress So Far

1. **Test Files Updated (Partially)**
   - Started updating `src/index.test.ts` and `src/knowledge-graph-manager.test.ts`
   - Removed `.js` extensions from imports
   - Changed from: `import { foo } from "./bar.js"`
   - Changed to: `import { foo } from "./bar"`

2. **Issues Encountered**
   - File edits were not persisting (tool approval issues)
   - TypeScript errors exposed by stricter config:
     - `src/knowledge-graph-manager.test.ts:520` - Accessing private `vectorStore` property
     - `src/knowledge-graph-manager.test.ts:571` - Accessing private `vectorStore` property
   - These need `@ts-expect-error` comments above them

### What Needs to Be Done Next

#### Immediate Tasks

1. **Fix TypeScript Errors in Test Files**
   
   In `src/knowledge-graph-manager.test.ts`, add `@ts-expect-error` comments:
   
   ```typescript
   // Around line 520
   // Manually inject the mock vector store (in a real scenario, this would use dependency injection)
   // @ts-expect-error - accessing private property for testing
   manager.vectorStore = mockVectorStore
   
   // Around line 571
   // Manually inject the mock vector store
   // @ts-expect-error - accessing private property for testing
   manager.vectorStore = mockVectorStore
   ```

2. **Verify Test Files Are Clean**
   - Run: `npx tsc --noEmit src/knowledge-graph-manager.test.ts`
   - Run: `npx tsc --noEmit src/index.test.ts`
   - Should have no errors (except unrelated node_modules errors which can be ignored)

3. **Run Tests to Verify They Pass**
   - Run: `pnpm test`
   - Tests should execute without errors
   - All tests in both test files should pass

4. **Delete Old Vitest Infrastructure**
   - Remove `__vitest__` folder: `rm -rf __vitest__`
   - Verify no references to vitest remain in the codebase

5. **Clean Up Imports Throughout Codebase**
   - Create a systematic approach to remove `.js` extensions from ALL imports
   - Can use path aliases `#*` where appropriate for cleaner imports
   - Example: `import { StorageProvider } from "#storage/StorageProvider"`
   - Or relative: `import { StorageProvider } from "./storage/StorageProvider"`

#### Validation Commands

After each change, run these to ensure code quality:

```bash
# TypeScript check
npx tsc --noEmit

# Biome/Ultracite check
npx ultracite check src/

# Run tests
pnpm test
```

## Important File Locations

- **Main entry point:** `src/index.ts`
- **Core logic:** `src/knowledge-graph-manager.ts`
- **Test files:**
  - `src/index.test.ts`
  - `src/knowledge-graph-manager.test.ts`
  - `src/utils/test-teardown.js` (helper for cleanup)
- **TypeScript config:** `tsconfig.json`
- **Package config:** `package.json`
- **Linter config:** `biome.json`
- **Copilot instructions:** `.github/copilot-instructions.md`

## Key Project Rules (from PRD)

1. **Testing:** 100% test coverage for core logic required
2. **Type Safety:** Strict TypeScript - no `any` types
3. **Code Style:** Enforced by Biome via Ultracite
4. **Imports:** No `.js` extensions (using bundler resolution)
5. **Package Manager:** ALWAYS use `pnpm`, never `npm`

## Important Notes for Next AI

1. **File Edit Issues:** If file edits aren't persisting, try:
   - Using `filesystem-write_file` instead of `str_replace_editor`
   - Making smaller, more targeted changes
   - Verifying changes with `cat` or `head` commands

2. **TypeScript Strictness:** The new config is MUCH stricter than before:
   - Check for `noUncheckedIndexedAccess` issues (array access returns `T | undefined`)
   - Check for unused locals/parameters
   - Private property access requires `@ts-expect-error`

3. **Testing Philosophy:**
   - Tests use Node.js native `node:test` module (NOT Vitest)
   - Mocking uses `t.mock.fn()`, `t.mock.method()`, etc.
   - Mock calls accessed via `.mock.calls` array (needs optional chaining with new config)
   - Example: `mock.mock.calls[0]?.arguments[0]`

4. **Path Aliasing:**
   - `#*` maps to `./src/*` 
   - Works in TypeScript but may need `.js` for runtime in some cases
   - Relative imports without `.js` are safer and more portable

## Next Session Starting Point

**Status:** Test migration is 95% complete. Need to:
1. Fix the 2 remaining TypeScript errors in `knowledge-graph-manager.test.ts`
2. Verify all tests pass
3. Clean up imports across entire codebase
4. Delete `__vitest__` folder
5. Consider updating other source files with stricter TypeScript checks

**Priority:** Get tests passing first, then systematically clean up the codebase.

## Useful Commands Reference

```bash
# Install dependencies
pnpm install

# Run tests
pnpm test

# Run specific test file
pnpm test src/knowledge-graph-manager.test.ts

# TypeScript check (no emit)
npx tsc --noEmit
npx tsc --noEmit <file>

# Lint check
npx ultracite check src/
npx ultracite check <file>

# Auto-fix lint issues
npx ultracite fix <file>

# Format code
pnpm run format

# View git status
git status

# View uncommitted changes
git diff
```

## Context from PRD

The server supports a 4-stage cascading workflow:
1. **Planner** - Uses `create_entities` / `add_observations` to log high-level feature plans
2. **Task Creator** - Uses `create_relations` / `create_entities` to decompose plans into tasks
3. **Coder/Executor** - Uses `log_decision` (planned new tool) to log implementation decisions
4. **Reviewer** - Uses `semantic_search` / `get_entity_history` to provide context-aware reviews

The goal is to provide a reliable, auditable knowledge graph for AI-driven development workflows.
