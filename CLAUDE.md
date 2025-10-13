# DevFlow MCP Server - Comprehensive Project Guide

## Project Overview

**Project Name:** DevFlow MCP Server (fork of Memento MCP)
**Version:** 1.0.0
**Package Manager:** pnpm (NOT npm)
**Node Version:** v24.10.0
**TypeScript:** Latest with strict configuration
**Primary Language:** TypeScript (ESNext)

### What Is DevFlow MCP?

DevFlow MCP is a **knowledge graph memory layer** specifically designed for AI-driven software development workflows. It provides persistent, queryable memory for AI agents working on software projects, enabling context-aware decision making, code review, and project planning.

### Core Architecture

The system uses:
- **Neo4j Graph Database** - For storing entities, relationships, and temporal versioning
- **Vector Embeddings** - For semantic search (OpenAI text-embedding-3-small, 1536 dimensions)
- **MCP Protocol** - For communication with AI agents (Claude, etc.)
- **Stricli CLI** - For command-line operations and database management

### Design Philosophy

1. **Temporal Knowledge Graph** - All entities and relations are versioned with `validFrom`/`validTo` timestamps
2. **Semantic Search** - Vector embeddings enable finding related entities by meaning, not just keywords
3. **Cascading Agent Workflow** - Supports multi-stage development process (Planner → Task Creator → Coder → Reviewer)
4. **Type Safety First** - Strict TypeScript with no `any` types
5. **Dependency Injection** - Services accept dependencies via constructor, enabling testability

## Expected Final Product

### User Experience

A developer working with Claude (or other AI) can:

1. **Plan Features** - AI creates high-level entity nodes for features and architectural decisions
2. **Break Down Tasks** - AI decomposes features into tasks with relationships
3. **Log Decisions** - AI records implementation decisions, patterns used, and trade-offs
4. **Context-Aware Reviews** - AI retrieves relevant history when reviewing code
5. **Audit Trail** - Full temporal history of all decisions and changes

### Technical Capabilities

- **Entity Management** - Create, update, delete entities with observations
- **Relationship Tracking** - Connect entities with typed relationships (implements, depends_on, relates_to, etc.)
- **Semantic Search** - Find entities by meaning using vector similarity
- **Temporal Queries** - Query the graph state at any point in time
- **Confidence Decay** - Relationships lose confidence over time (configurable)
- **CLI Tools** - Database management, testing, diagnostics

### Supported Workflows

#### 1. Planner Agent
- Creates entities for high-level features
- Logs architectural decisions as observations
- Tools: `create_entities`, `add_observations`

#### 2. Task Creator Agent
- Decomposes features into tasks
- Creates relationships between tasks and features
- Tools: `create_entities`, `create_relations`

#### 3. Coder/Executor Agent
- Logs implementation decisions
- Records patterns and trade-offs
- Tools: `log_decision` (planned), `add_observations`

#### 4. Reviewer Agent
- Searches for related code/decisions
- Retrieves entity history for context
- Tools: `semantic_search`, `get_entity_history`

## Current Architecture

### Directory Structure

```
src/
├── cli/                    # Stricli-based CLI commands
│   ├── index.ts           # CLI entry point
│   ├── neo4j.ts           # Neo4j management commands
│   └── bash-complete.ts   # Shell completion
├── server/                 # MCP server
│   ├── index.ts           # Server entry point (composition root)
│   └── handlers/          # MCP tool handlers
│       └── call-tool-handler.ts
├── storage/               # Storage abstraction layer
│   ├── storage-provider.ts          # Interface
│   ├── file-storage-provider.ts     # File-based (legacy)
│   ├── vector-store-factory.ts      # Vector store factory
│   └── neo4j/             # Neo4j implementation
│       ├── neo4j-config.ts
│       ├── neo4j-connection-manager.ts
│       ├── neo4j-schema-manager.ts
│       ├── neo4j-vector-store.ts    # Vector search (CRITICAL)
│       └── neo4j-storage-provider.ts # Main storage impl
├── embeddings/            # Embedding services
│   ├── embedding-service.ts         # Base class
│   ├── default-embedding-service.ts # Mock/testing
│   ├── openai-embedding-service.ts  # Production
│   └── embedding-service-factory.ts
├── types/                 # Type definitions
│   ├── index.ts          # Barrel exports
│   ├── logger.ts         # Logger interface
│   ├── entity-embedding.ts
│   ├── relation.ts
│   └── vector-store.ts
├── utils/                 # Utilities
│   ├── logger.ts         # Winston-based logger (file output)
│   └── cli-logger.ts     # Consola-based logger (CLI output)
├── knowledge-graph-manager.ts  # Core business logic
└── index.ts               # MCP server main entry

Key Configuration Files:
- tsconfig.json            # TypeScript strict configuration
- biome.json              # Linter/formatter rules
- package.json            # Dependencies and scripts
- lefthook.yml           # Git hooks for linting
```

### Key Components

#### 1. KnowledgeGraphManager
**Location:** `src/knowledge-graph-manager.ts`

The central orchestrator that:
- Manages entity and relation CRUD operations
- Delegates to StorageProvider for persistence
- Handles semantic search coordination
- Provides business logic layer

**Current Status:** Needs refactoring for dependency injection

#### 2. Neo4jStorageProvider
**Location:** `src/storage/neo4j/neo4j-storage-provider.ts`

The main storage implementation:
- 40+ methods for graph operations
- Temporal versioning for all entities/relations
- Automatic embedding generation on entity creation
- Confidence decay calculations
- Comprehensive error handling and logging

**Status:** ✅ Fully refactored with dependency injection

#### 3. Neo4jVectorStore
**Location:** `src/storage/neo4j/neo4j-vector-store.ts`

**MOST CRITICAL FILE** for semantic search:
- HNSW (Hierarchical Navigable Small World) vector indexing
- Automatic vector normalization (l2-norm = 1 for cosine similarity)
- Vector validation (finite values, non-zero norm)
- Index state verification (must be ONLINE)
- Proper Neo4j query patterns using `db.index.vector.queryNodes()`

**Status:** ✅ Fully refactored with Neo4j best practices

#### 4. Embedding Services
**Locations:** `src/embeddings/*.ts`

- **OpenAIEmbeddingService** - Production embedding (text-embedding-3-small)
- **DefaultEmbeddingService** - Deterministic mock for testing
- **EmbeddingServiceFactory** - Creates services from environment config

**Status:** ✅ Fully refactored with dependency injection

## ✅ Completed Work

### Phase 1: Foundation (Previously Completed)

1. **Test Migration** - Vitest → Node.js native test runner
2. **TypeScript Modernization** - Strict config with bundler module resolution
3. **Import Cleanup** - Removed `.js` extensions from imports
4. **Path Aliasing** - `#*` maps to `./src/*` for clean imports
5. **Development Tools** - Ultracite (Biome) for linting/formatting

### Phase 2: Dependency Injection & Logging (Recently Completed)

#### Embedding Services (Commits: ff20ddf, earlier)

**Changes:**
- Added `Logger` type definition in `src/types/logger.ts`
- Created `createNoOpLogger()` factory for default logger
- Updated `DefaultEmbeddingService` constructor to accept `logger?: Logger`
- Updated `OpenAIEmbeddingService` constructor to accept `logger?: Logger`
- Updated `EmbeddingServiceFactory` to pass logger to services
- Changed environment variables to use `DFM_` prefix:
  - `MOCK_EMBEDDINGS` → `DFM_MOCK_EMBEDDINGS`
  - `OPENAI_API_KEY` → `DFM_OPENAI_API_KEY`
  - `OPENAI_EMBEDDING_MODEL` → `DFM_OPENAI_EMBEDDING_MODEL`

**Why:**
- Eliminates tight coupling to concrete logger implementation
- Enables testing with mock loggers
- Allows swapping log outputs (file vs. CLI vs. no-op)

#### Neo4j Vector Store (Commit: f9d20d7)

**Logical Improvements (Based on Neo4j Documentation):**

1. **Automatic Vector Normalization**
   ```typescript
   private normalizeVector(vector: number[]): number[] {
     // Calculates l2-norm (Euclidean length)
     // Normalizes to unit length (magnitude = 1)
     // Required for Neo4j cosine similarity
   }
   ```

2. **Vector Validation**
   ```typescript
   private isValidVector(vector: number[]): boolean {
     // Checks for finite values
     // Verifies non-zero l2-norm
   }
   ```

3. **Index State Verification**
   - Ensures vector index is ONLINE before queries
   - Provides detailed diagnostics on index state

4. **Proper Query Patterns**
   ```cypher
   CALL db.index.vector.queryNodes(
     'entity_embeddings',  -- index name
     $limit,               -- max results
     $embedding            -- normalized query vector
   )
   YIELD node, score
   WHERE score >= $minScore
   ```

**Code Quality Improvements:**
- Constructor injection for logger
- Changed `interface` to `type`
- Type guards for array access (noUncheckedIndexedAccess compliance)
- Comprehensive logging at every operation
- Better error handling with context

#### Neo4j Schema Manager (Commit: f9d20d7)

**Changes:**
- Logger injection via constructor
- Refactored `createVectorIndex()` to use options object (4 params max)
- Type guards for Neo4j record access
- Changed `interface` to `type`

#### Vector Store Factory (Commit: f9d20d7)

**Changes:**
- Logger injection throughout
- Passes logger to Neo4jVectorStore constructor

#### Neo4j Storage Provider (Commit: f9d20d7)

**Major Refactoring:**
- Logger injection to constructor
- Passes logger to all child services:
  - Neo4jSchemaManager
  - Neo4jVectorStore
  - EmbeddingServiceFactory
- Changed all `interface` to `type`:
  - `Neo4jStorageProviderOptions`
  - `ExtendedEntity`
  - `ExtendedRelation`
  - `Neo4jSemanticSearchOptions`
  - `KnowledgeGraphWithDiagnostics`
- Type guards for 40+ Neo4j record array access points
- Replaced all `logger` imports with `this.logger`
- Comprehensive logging in all methods

### Phase 3: Type Safety Improvements (In Progress)

#### Completed:
- Type guards for Neo4j record access (prevents undefined errors)
- Changed `interface` to `type` throughout storage layer
- Proper type annotations for all service constructors

#### Remaining:
- KnowledgeGraphManager type improvements
- Call tool handler type safety
- Union types with arktype validation

## Technical Implementation Details

### Dependency Injection Pattern

We use **constructor injection** for all services:

```typescript
// Bad (tight coupling)
import { logger } from "#utils/logger.ts"

export class MyService {
  doSomething() {
    logger.info("Something happened")
  }
}

// Good (dependency injection)
import type { Logger } from "#types"
import { createNoOpLogger } from "#types"

export class MyService {
  private readonly logger: Logger

  constructor(options: { logger?: Logger } = {}) {
    this.logger = options.logger ?? createNoOpLogger()
  }

  doSomething() {
    this.logger.info("Something happened")
  }
}
```

**Benefits:**
- Testable (inject mock logger)
- Flexible (swap implementations)
- No side effects (no global state)

### Logging Strategy

We use **dual logging systems**:

1. **Winston (File-based)** - For MCP server
   - Location: `src/utils/logger.ts`
   - Output: `logs/devflow-mcp.log`
   - Levels: error, warn, info, debug
   - Includes timestamps and metadata

2. **Consola (CLI-based)** - For command-line tools
   - Location: `src/utils/cli-logger.ts`
   - Output: stdout/stderr with colors
   - User-friendly formatting
   - Progress indicators

**Both implement the same `Logger` interface:**

```typescript
export type Logger = {
  info(message: string, meta?: LogMetadata): void
  error(message: string, error?: Error | unknown, meta?: LogMetadata): void
  warn(message: string, meta?: LogMetadata): void
  debug(message: string, meta?: LogMetadata): void
}
```

### Environment Variables

All application environment variables use the `DFM_` prefix:

```bash
# Embedding Configuration
DFM_MOCK_EMBEDDINGS=true              # Use mock embeddings for testing
DFM_OPENAI_API_KEY=sk-...            # OpenAI API key
DFM_OPENAI_EMBEDDING_MODEL=text-embedding-3-small

# Neo4j Configuration (no prefix)
NEO4J_URI=bolt://localhost:7687
NEO4J_USERNAME=neo4j
NEO4J_PASSWORD=password
NEO4J_DATABASE=neo4j

# Logging
DEBUG=true                            # Enable debug diagnostics
```

### Neo4j Vector Search Best Practices

Based on Neo4j documentation, we implement:

1. **Vector Normalization**
   - All vectors normalized to unit length (l2-norm = 1)
   - Required for accurate cosine similarity
   - Done automatically before storage and search

2. **HNSW Indexing**
   - Hierarchical Navigable Small World algorithm
   - Approximate nearest neighbor search
   - Fast, scalable, and accurate

3. **Index Configuration**
   ```cypher
   CREATE VECTOR INDEX entity_embeddings IF NOT EXISTS
   FOR (n:Entity)
   ON (n.embedding)
   OPTIONS {
     indexConfig: {
       `vector.dimensions`: 1536,
       `vector.similarity_function`: 'cosine'
     }
   }
   ```

4. **Index State Management**
   - Index must be ONLINE before use
   - Check state with: `SHOW VECTOR INDEXES`
   - Wait for index population if POPULATING

5. **Query Pattern**
   ```cypher
   CALL db.index.vector.queryNodes(
     'entity_embeddings',  -- index name
     10,                   -- limit
     [0.1, 0.2, ...]      -- normalized query vector
   )
   YIELD node, score
   WHERE score >= 0.6     -- minimum similarity
   RETURN node, score
   ORDER BY score DESC
   ```

### TypeScript Configuration

**Key Settings:**

```json
{
  "compilerOptions": {
    "target": "ESNext",
    "module": "ESNext",
    "moduleResolution": "bundler",  // Allows imports without .js
    "strict": true,                 // All strict checks
    "noUncheckedIndexedAccess": true,  // array[0] returns T | undefined
    "noUnusedLocals": true,
    "paths": {
      "#*": ["./src/*"]  // Path aliasing
    }
  }
}
```

**Implications:**
- Array access always returns `T | undefined` (need type guards)
- No `.js` extensions in imports
- Full type safety, no implicit any
- Path aliases work in both TS and runtime (via package.json imports)

## 🚧 Remaining Work

### Priority 1: Core Refactoring

#### ✅ KnowledgeGraphManager Dependency Injection (Completed)
**File:** `src/knowledge-graph-manager.ts`

**Changes:**
- **Constructor Injection:** Refactored the constructor to require a `StorageProvider` and accept an optional `Logger`.
- **Removed Direct Imports:** Eliminated direct imports of `#utils/logger.ts` and `#utils/fs.ts`.
- **Eliminated Fallback Logic:** Removed all deprecated file-based storage logic, including the `loadGraph` and `saveGraph` methods and their usage throughout the class.
- **Mandatory StorageProvider:** The `KnowledgeGraphManager` now relies exclusively on the injected `StorageProvider` for all persistence operations.

**Impact:** The class is now fully decoupled from concrete storage and logging implementations, adhering to the project's dependency injection pattern. This improves testability and modularity.

#### ✅ Composition Root (Server Entry Point) (Completed)
**File:** `src/server/index.ts`

**Changes:**
- **Simplified `startMcpServer`:** Replaced the complex implementation of `startMcpServer` with a streamlined version that follows the dependency injection pattern.
- **Removed Adapter Logic:** Eliminated all the adapter code, type guards, and helper functions that were previously needed to make the Neo4j storage provider compatible with the embedding job manager.
- **Centralized Initialization:** The server now relies on the `initializeStorageProvider` function from `src/config.ts` and the `EmbeddingServiceFactory` to create and wire up the necessary services.

**Impact:** The server entry point is now much cleaner, easier to understand, and more maintainable. It clearly shows how the different parts of the application are composed together.

### Priority 2: Bug Fixes

#### ✅ Fix #utils/fs.ts Import in KnowledgeGraphManager (Completed)
**Issue:** Import path was incorrect or file didn't exist
**Location:** `src/knowledge-graph-manager.ts:11`
**Fix:** This issue was resolved by the comprehensive refactoring of the `KnowledgeGraphManager`. All file-based storage logic, including the import of `#utils/fs.ts`, was removed, making this task obsolete.

#### ✅ Neo4j CLI Missing Flags (Completed)
**Issue:** CLI commands missing required flags for vector operations
**Location:** `src/cli/neo4j.ts:180`
**Fix:** Added the `vectorIndex`, `dimensions`, and `similarity` flags to the `test` command definition.

#### ✅ CliContext Type Incompatibility (Completed)
**Issue:** `CliContext` not compatible with `StricliDynamicCommandContext<CliContext>`
**Locations:**
- `src/cli/bash-complete.ts:22`
- `src/cli/index.ts:10`
**Fix:** Refactored the `CliContext` in `src/cli/app.ts` to separate the application-specific context from the `stricli` context. This resolved the type incompatibility.

#### ✅ Neo4jConnectionManager Missing Methods (Completed)
**Issue:** Methods `verifyConnectivity()` and `getDriver()` don't exist
**Location:** `src/cli/neo4j.ts:72,78`
**Fix:** Added the `verifyConnectivity()` and `getDriver()` methods to the `Neo4jConnectionManager` class.

#### ✅ Neo4jSchemaManager Constructor Signature (Completed)
**Issue:** Wrong number of arguments (expects 1-2, getting 3)
**Location:** `src/cli/neo4j.ts:114`
**Fix:** Updated the call to use an options object.

### Priority 3: Type Safety Improvements

#### ✅ Union Types with arktype (Completed)
**Goal:** Replace string literals with validated union types
**What Was Done:**
- Created `src/types/arktype.ts` with validated union types for EntityType and RelationType
- Updated `Entity` interface in `src/types/entity.ts` to use `EntityType`
- Updated `Relation` interface in `src/types/relation.ts` to use `RelationType`
- Imported `RelationType` in `neo4j-storage-provider.ts` to use validated types internally
- Removed `relationTypes` parameter from StorageProvider interface methods (types are now centralized)

#### 2. Remove Remaining `any` Types
**Approach:**
- Remove ALL `eslint-disable` comments (we use Biome/Ultracite, not ESLint)
- Create proper types for all `any` usages
- Use arktype for types that need runtime validation
- Replace `catch (error: any)` with `catch (error: unknown)` and narrow with type guards

**Locations:**
- `src/storage/storage-provider.ts` - `createEntities` returns `any[]` (needs proper temporal entity type)
- `src/storage/neo4j/neo4j-storage-provider.ts` - `createEntities` and internal variables
- `src/server/handlers/call-tool-handler.ts` - `knowledgeGraphManager: any` parameter and error catches

**Actions:**
1. Create `TemporalEntity` type with arktype for entities with temporal metadata
2. Update `StorageProvider.createEntities` signature
3. Replace all `error: any` with `error: unknown` and proper type narrowing
4. Remove all `eslint-disable-next-line @typescript-eslint/no-explicit-any` comments

#### 3. Add Type Guards for Record Access
**Pattern:**
```typescript
const record = result.records[0]
if (!record) {
  throw new Error("No record found")
}
// Now safe to use record
```

### Priority 4: Testing & Documentation

#### 1. Test Logging Infrastructure
- Create test with mock logger
- Verify logger is called appropriately
- Test no-op logger behavior

#### 2. Test CLI Commands
- Test Neo4j connection verification
- Test schema initialization
- Test vector index creation

#### 3. Update Documentation
- Add JSDoc comments to all public methods
- Document Neo4j best practices
- Create developer guide for adding new tools

#### 4. Integration Tests
- Test full MCP workflow
- Test semantic search end-to-end
- Test temporal queries

### Priority 5: Code Quality

#### 1. Reduce Function Complexity
**Files with High Complexity:**
- `src/storage/neo4j/neo4j-storage-provider.ts`:
  - `saveGraph()` - complexity 24 (max 15)
  - `createEntities()` - complexity 23
  - `createRelations()` - complexity 21
  - `addObservations()` - complexity 35
  - `deleteObservations()` - complexity 16
  - `semanticSearch()` - complexity 50+

**Fix:** Break into smaller helper methods

#### 2. Extract Magic Numbers
**Examples:**
- `30` (halfLifeDays default)
- `0.1` (minConfidence default)
- `0.9`, `0.95` (default strength/confidence)
- `1536` (embedding dimensions)

**Fix:** Create constants at module level

#### 3. Improve Error Messages
- Add context to all thrown errors
- Include relevant IDs and names
- Provide actionable error messages

## Development Workflow

### Getting Started

```bash
# Clone and install
git clone <repo>
cd devflow-mcp
pnpm install

# Set up environment
cp .env.example .env
# Edit .env with your Neo4j credentials and OpenAI API key

# Start Neo4j (if using Docker)
docker-compose up -d neo4j

# Initialize schema
pnpm run cli neo4j init

# Run tests
pnpm test

# Start development
pnpm run dev
```

### Common Tasks

```bash
# TypeScript type checking
npx tsc --noEmit

# Lint and format
npx ultracite check src/
npx ultracite fix src/

# Run specific test
pnpm test src/knowledge-graph-manager.test.ts

# Build for production
pnpm run build

# Start server
pnpm start
```

### Git Workflow

```bash
# Pre-commit hooks run automatically via lefthook:
# 1. ls-lint - checks file naming conventions
# 2. ultracite - lints and formats staged files

# To skip hooks (use sparingly):
git commit --no-verify -m "message"

# Check git hooks
lefthook run pre-commit
```

## Key Principles & Best Practices

### 1. Type Safety
- No `any` types (use `unknown` and narrow with type guards)
- Always handle array[0] as possibly undefined
- Use type predicates for validation
- Prefer `type` over `interface` for consistency

### 2. Error Handling
- Always log errors with context
- Re-throw after logging (let caller decide recovery)
- Use typed error objects where appropriate
- Provide actionable error messages

### 3. Testing
- 100% coverage for business logic
- Mock external dependencies (DB, APIs)
- Test error paths, not just happy paths
- Use descriptive test names

### 4. Logging
- Log at appropriate levels:
  - **ERROR**: Failures requiring attention
  - **WARN**: Unexpected but handled situations
  - **INFO**: Important state changes
  - **DEBUG**: Detailed execution information
- Include metadata for context
- Never log sensitive data (API keys, passwords)

### 5. Database Operations
- Use transactions for multi-step operations
- Always close sessions in finally blocks
- Handle connection failures gracefully
- Validate data before DB operations

### 6. Vector Search
- Always normalize vectors before storage
- Validate vector dimensions match index
- Check index is ONLINE before queries
- Use appropriate similarity thresholds (0.6+ for cosine)

## Useful Commands Reference

```bash
# Package Management
pnpm install                  # Install dependencies
pnpm add <package>           # Add dependency
pnpm add -D <package>        # Add dev dependency

# Testing
pnpm test                    # Run all tests
pnpm test <file>            # Run specific test file
NODE_OPTIONS='--experimental-strip-types' node --test  # Direct test run

# TypeScript
npx tsc --noEmit            # Type check all files
npx tsc --noEmit <file>     # Type check specific file

# Linting & Formatting
npx ultracite check src/    # Check all files
npx ultracite fix src/      # Fix all files
npx ultracite check <file>  # Check specific file
npx ultracite fix <file>    # Fix specific file

# Git
git status                   # Check status
git diff                     # View changes
git add -A                   # Stage all changes
git commit -m "message"      # Commit with message
git commit --no-verify       # Skip pre-commit hooks

# Neo4j CLI
pnpm run cli neo4j init                    # Initialize schema
pnpm run cli neo4j test-connection         # Test connection
pnpm run cli neo4j create-vector-index     # Create vector index
pnpm run cli neo4j test-vector-search      # Test vector search

# Development
pnpm run dev                # Start in development mode
pnpm run build             # Build for production
pnpm start                 # Start production server
```

## Important File Locations

### Core Application
- `src/index.ts` - MCP server entry point
- `src/knowledge-graph-manager.ts` - Core business logic (1500+ lines)
- `src/server/index.ts` - Server startup and composition root
- `src/server/handlers/call-tool-handler.ts` - MCP tool implementations

### Storage Layer
- `src/storage/neo4j/neo4j-storage-provider.ts` - Main storage (2450+ lines, 40+ methods)
- `src/storage/neo4j/neo4j-vector-store.ts` - Vector search (CRITICAL, 732 lines)
- `src/storage/neo4j/neo4j-schema-manager.ts` - Schema management
- `src/storage/neo4j/neo4j-connection-manager.ts` - Connection pooling

### Services
- `src/embeddings/openai-embedding-service.ts` - Production embeddings
- `src/embeddings/default-embedding-service.ts` - Mock embeddings
- `src/embeddings/embedding-service-factory.ts` - Service creation

### Configuration & Types
- `tsconfig.json` - TypeScript configuration (strict mode)
- `package.json` - Dependencies and scripts
- `biome.json` - Linter configuration
- `lefthook.yml` - Git hooks
- `src/types/` - Type definitions

### CLI
- `src/cli/index.ts` - CLI entry point
- `src/cli/neo4j.ts` - Neo4j management commands

### Testing
- `src/index.test.ts` - Main entry point tests
- `src/knowledge-graph-manager.test.ts` - Core logic tests
- `src/utils/test-teardown.js` - Test cleanup utilities

## Troubleshooting

### Common Issues

#### 1. TypeScript Errors on Array Access
**Error:** `Object is possibly 'undefined'`
**Cause:** `noUncheckedIndexedAccess` is enabled
**Fix:** Add type guard:
```typescript
const record = result.records[0]
if (!record) {
  throw new Error("No record found")
}
// Now safe to use
```

#### 2. Import Resolution Errors
**Error:** `Cannot find module '#storage/...'`
**Cause:** Path mapping not configured
**Fix:** Ensure both `tsconfig.json` and `package.json` have path mappings

#### 3. Neo4j Vector Index Not Found
**Error:** `Vector index 'entity_embeddings' not found`
**Cause:** Index not created or not ONLINE
**Fix:**
```bash
pnpm run cli neo4j init
# Wait for index to be ONLINE (check with SHOW VECTOR INDEXES)
```

#### 4. Embedding Dimension Mismatch
**Error:** `Vector dimensions don't match index`
**Cause:** Embedding model changed or index misconfigured
**Fix:** Recreate index with correct dimensions

#### 5. Test Failures with Mocking
**Error:** Mock calls undefined
**Cause:** Need optional chaining with strict TypeScript
**Fix:** Use `mock.mock.calls[0]?.arguments[0]`

## Next Steps

### Immediate (Current Session)
1. Refactor KnowledgeGraphManager with dependency injection
2. Update server composition root to wire dependencies
3. Fix #utils/fs.ts import issue

### Short Term (Next 1-2 Sessions)
1. Fix all CLI-related bugs
2. Fix call-tool-handler type issues
3. Add comprehensive logging throughout
4. Update tests for dependency injection

### Medium Term (Next 3-5 Sessions)
1. Improve type safety with union types and arktype
2. Reduce function complexity in storage provider
3. Add integration tests
4. Performance optimization for semantic search

### Long Term (Future)
1. Add caching layer for embeddings
2. Support multiple embedding models
3. Add graph visualization tools
4. Support for other vector databases (Qdrant, Pinecone)
5. Web UI for knowledge graph exploration

## Success Criteria

The refactoring is complete when:

✅ All services use dependency injection
✅ No direct logger imports (except composition root)
✅ TypeScript compiles with zero errors
✅ All tests pass
✅ Lint passes on all files
✅ Vector search works correctly with normalized vectors
✅ Semantic search returns relevant results
✅ CLI commands work without errors
✅ MCP server starts and responds to tools
✅ Knowledge graph persists correctly in Neo4j

## Resources

### Documentation
- [Neo4j Vector Index Docs](https://neo4j.com/docs/cypher-manual/current/indexes-for-vector-search/)
- [MCP Protocol Spec](https://modelcontextprotocol.io/)
- [OpenAI Embeddings](https://platform.openai.com/docs/guides/embeddings)
- [Stricli CLI Framework](https://stricli.js.org/)

### Related Files
- `.github/copilot-instructions.md` - AI coding guidelines
- `docs/PRD.md` - Product requirements (if exists)
- `README.md` - User-facing documentation

## Contact & Support

For questions or issues:
1. Check this CLAUDE.md file first
2. Review error logs in `logs/devflow-mcp.log`
3. Check TypeScript output: `npx tsc --noEmit`
4. Review Neo4j schema: `pnpm run cli neo4j init`

---

**Last Updated:** 2025-01-13
**Current Phase:** Dependency Injection & Refactoring
**Next Priority:** KnowledgeGraphManager refactoring
