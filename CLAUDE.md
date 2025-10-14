# DevFlow MCP - Comprehensive Project Guide

## Project Overview

**Project Name:** DevFlow MCP (DevFlow Model Context Protocol)
**Version:** 1.0.0
**Package Manager:** pnpm (NOT npm)
**Node Version:** >=20.0.0
**TypeScript:** 5.8.2 with strict configuration
**Primary Language:** TypeScript (ESNext)

### Recent Work (Latest Session)

**Embedding Type System Refactor** - Completed comprehensive type safety improvements for embedding services:
- Created strongly-typed `EmbeddingModel` and `EmbeddingProvider` types using arktype
- Moved `EmbeddingProviderInfo` and `EmbeddingModelInfo` from local files to centralized `src/types/embedding.ts`
- Added runtime validation for OpenAI embedding models with proper fallback handling
- Updated all embedding services (`default`, `openai`, `factory`) to use the new typed system
- Eliminated all type casting in favor of proper arktype validation
- Models are now constrained to actual OpenAI models: `text-embedding-3-small`, `text-embedding-3-large`, `text-embedding-ada-002`
- Mock models properly typed: `dfm-mcp-mock`, `text-embedding-3-small-mock`

This creates a foundation for easily adding new embedding providers and models in the future.

### What Is DevFlow MCP?

DevFlow MCP is a **knowledge graph memory layer** specifically designed for AI-driven software development workflows. It provides persistent, queryable memory for AI agents working on software projects, enabling context-aware decision making, code review, and project planning.

This is a **significant fork** of [Memento MCP](https://github.com/gannonh/memento-mcp) by Gannon Hall, focused on:
- **Architectural honesty** - Only shipping features that actually work
- **Code quality** - Zero `any` types, full dependency injection, strict TypeScript
- **Simplicity** - Removing unimplemented features and dead code
- **Maintainability** - Modern tooling, comprehensive logging, proper abstractions

### Core Architecture

The system uses:
- **Neo4j Graph Database** - For storing entities, relationships, and temporal versioning
- **Vector Embeddings** - For semantic search (OpenAI text-embedding-3-small, 1536 dimensions)
- **MCP Protocol** - For communication with AI agents (Claude Desktop, Cursor, etc.)
- **Runtime Validation** - ArkType for type safety at runtime

## Technology Stack

### Core Dependencies
- **@modelcontextprotocol/sdk** (1.11.0) - MCP protocol implementation
- **neo4j-driver** (^5.28.1) - Neo4j database driver
- **arktype** (^2.1.22) - Runtime type validation
- **arkenv** (^0.7.3) - Environment variable validation
- **openai** (^4.90.0) - OpenAI API for embeddings
- **winston** (^3.18.3) - Structured logging (server)
- **consola** (^3.4.2) - User-friendly CLI logging
- **@stricli/core** (^1.2.0) - CLI framework

### Development Tools
- **tsx** (^4.19.3) - Fast TypeScript runner for dev/tests
- **tsdown** (^0.15.6) - Production TypeScript bundler
- **ultracite** (^5.6.2) - Biome-based linter/formatter
- **lefthook** (^1.13.6) - Git hooks for linting

### Build Tooling
- **Development**: tsx (uses esbuild internally)
- **Production**: tsdown for bundling
- **Testing**: Native Node.js test runner with tsx
- **Type Checking**: TypeScript compiler (tsc)

## Project Goals & Expected Final Product

### Product Vision

A developer working with Claude (or other AI) should be able to:

1. **Plan Features** - AI creates high-level entity nodes for features and architectural decisions
2. **Break Down Tasks** - AI decomposes features into tasks with relationships
3. **Log Decisions** - AI records implementation decisions, patterns used, and trade-offs
4. **Context-Aware Reviews** - AI retrieves relevant history when reviewing code
5. **Audit Trail** - Full temporal history of all decisions and changes

### Cascading Agent Workflow

The system is designed to support a **multi-stage development cascade**:

| Agent Role | Goal | Tools Used | Data Saved/Retrieved |
|------------|------|------------|---------------------|
| **1. Planner** | Generate high-level feature plan | `create_entities`, `add_observations` | Entity: Project/Feature, Observations: Goals, requirements |
| **2. Task Creator** | Decompose plan into executable tasks | `create_relations`, `create_entities` | Entities: Task nodes, Relations: PLAN_DECOMPOSED_INTO |
| **3. Coder/Executor** | Implement code and log key decisions | `add_observations`, `create_relations` | Entities: CodeSnippet, Relations: IMPLEMENTS |
| **4. Reviewer** | Analyze code and provide feedback | `semantic_search`, `get_entity_history` | Retrieved: Decisions, historical CodeSnippets |

### Technical Capabilities (Final Product)

- ✅ **Entity Management** - Create, update, delete entities with observations
- ✅ **Relationship Tracking** - Connect entities with typed relationships (implements, depends_on, relates_to, part_of)
- ✅ **Semantic Search** - Find entities by meaning using vector similarity
- ✅ **Temporal Queries** - Query the graph state at any point in time
- ✅ **Confidence Decay** - Relationships lose confidence over time (configurable)
- ✅ **CLI Tools** - Database management, testing, diagnostics
- ✅ **Type Safety** - Runtime validation with arktype, strict TypeScript
- ✅ **Structured Logging** - Winston (server) + Consola (CLI)

## Current State & Recent Refactoring

### ✅ Completed Major Refactoring

The project has undergone extensive refactoring from the original Memento MCP:

#### 1. Type Safety (100% Complete)
- **Zero `any` types** - All uses of `any` replaced with proper types or `unknown`
- **Strict TypeScript** - `noUncheckedIndexedAccess`, `strictNullChecks`, all strict flags enabled
- **Runtime Validation** - ArkType used for all data types that need runtime checking

#### 2. Dependency Injection (100% Complete)
- **Logger Injection** - All services accept logger via constructor
- **No Global State** - No direct imports of logger or file system utilities
- **Testable** - Easy to inject mocks for testing
- **Flexible** - Can swap implementations (Winston vs Consola vs NoOp logger)

#### 3. Modern Neo4j APIs (100% Complete)
- **Driver v5** - Updated from deprecated APIs
- **Vector Search** - Using `db.index.vector.queryNodes()` correctly
- **Proper Normalization** - Vectors normalized to unit length (l2-norm = 1)
- **Index Management** - Automatic index creation and state verification

#### 4. Removed Unimplemented Features
- **Observation metadata** - Old API accepted strength/confidence/metadata but silently ignored them
- **Dead code** - Removed ~150 lines of misleading code that suggested features worked when they didn't
- **File storage** - Removed deprecated file-based storage provider
- **Backward compatibility layers** - Cleaned up migration code

#### 5. Build Tooling Modernization
- **Before**: Node.js experimental type stripping (`NODE_OPTIONS='--experimental-strip-types'`)
- **After**: tsx (dev) + tsdown (production) - professional, reliable tooling
- **Benefits**: Proper module resolution, faster builds, better compatibility

#### 6. Type Consolidation
- **Before**: ~10 small type files scattered across `src/types/`
- **After**: Consolidated into 6 well-organized files:
  - `index.ts` - Barrel exports with Logger type
  - `entity.ts` - Entity types with arktype validation
  - `relation.ts` - Relation types with arktype validation
  - `temporal.ts` - Temporal entities/relations with versioning
  - `vector.ts` - Vector search and store interfaces
  - `storage.ts` - Storage provider interface and search options
  - `knowledge-graph.ts` - Knowledge graph types
  - `shared.ts` - Shared primitives (EntityName, Observation)

### ⚠️ Current Issue: SemanticSearchOptions Type

**Problem**: During type consolidation (commit `1a1e897`), the `SemanticSearchOptions` type was accidentally removed from `src/types/entity-embedding.ts` when that file was consolidated into `index.ts`. However, 4 files still try to import it, causing TypeScript errors.

**Root Cause**: The old type had 15+ properties but most were **never implemented**:
```typescript
// Old type (entity-embedding.ts) - REMOVED
export interface SemanticSearchOptions {
  semanticSearch?: boolean       // ❌ Never used
  hybridSearch?: boolean          // ❌ Only logged, doesn't change behavior
  semanticWeight?: number         // ✅ Used
  minSimilarity?: number          // ✅ Used
  expandQuery?: boolean           // ❌ Never implemented
  includeFacets?: boolean         // ❌ Never implemented
  facets?: string[]               // ❌ Never implemented
  includeExplanations?: boolean   // ❌ Never implemented
  filters?: SearchFilter[]        // ❌ Never implemented
  limit?: number                  // ✅ Used (but in SearchOptions, not here)
  offset?: number                 // ❌ Never implemented
  includeDocuments?: boolean      // ❌ Never implemented
  useCache?: boolean              // ❌ Never implemented
  queryVector?: number[]          // ✅ Used internally
  threshold?: number              // ✅ Used (alias for minSimilarity)
}
```

**Analysis of Actual Usage**:
After grep'ing through `neo4j-storage-provider.ts` and `knowledge-graph-manager.ts`, only these properties **actually affect search results**:
- `queryVector` - Used in Neo4j query (line 2342)
- `minSimilarity` - Used in WHERE clause (line 2311, 2336)
- `threshold` - Alias for minSimilarity (knowledge-graph-manager.ts)
- `limit` - Already in `SearchOptions` (inherited via intersection)
- `entityTypes` - Already in `SearchOptions` (inherited via intersection)

Properties that are **only logged** (no behavior change):
- `hybridSearch` - Only appears in `diagnostics` and `logger.debug`

**Current Work**: Creating a minimal `SemanticSearchOptions` type with only the 3 vector-specific properties that actually affect behavior:
```typescript
export const SemanticSearchOptions = type({
  "queryVector?": "number[]",
  "minSimilarity?": "number >= 0 & <= 1",
  "threshold?": "number >= 0 & <= 1",
})
export type SemanticSearchOptions = typeof SemanticSearchOptions.infer
```

**Files That Need Fixing**:
1. ✅ `src/types/storage.ts` - Added SemanticSearchOptions definition
2. ✅ `src/types/index.ts` - Added export
3. ⚠️ `src/storage/storage-provider.ts` - Imports from `#types`, should now work
4. ⚠️ `src/storage/neo4j/neo4j-storage-provider.ts` - Imports from `#types`, should now work
5. ⚠️ `src/knowledge-graph-manager.test.ts` - Imports from `#knowledge-graph-manager`, need to check

## Architecture & Code Organization

### Directory Structure

```
src/
├── cli/                          # Stricli-based CLI commands
│   ├── index.ts                 # CLI entry point (bin: dfm)
│   ├── app.ts                   # CLI application definition
│   ├── neo4j.ts                 # Neo4j management commands
│   ├── mcp.ts                   # MCP server command
│   └── bash-complete.ts         # Shell completion
│
├── server/                       # MCP server
│   ├── index.ts                 # Server entry point & composition root
│   ├── setup.ts                 # MCP server configuration
│   └── handlers/                # MCP tool handlers
│       ├── call-tool-handler.ts      # Main tool dispatcher
│       ├── list-tools-handler.ts     # Tool schema definitions
│       └── tool-handlers.ts          # Individual tool implementations
│
├── storage/                      # Storage abstraction layer
│   ├── storage-provider.ts            # StorageProvider interface
│   ├── storage-provider-factory.ts   # Factory for creating storage providers
│   ├── vector-store-factory.ts       # Factory for vector stores
│   └── neo4j/                        # Neo4j implementation
│       ├── neo4j-config.ts
│       ├── neo4j-connection-manager.ts
│       ├── neo4j-schema-manager.ts
│       ├── neo4j-vector-store.ts        # CRITICAL for semantic search
│       └── neo4j-storage-provider.ts    # Main storage impl (2450+ lines)
│
├── embeddings/                   # Embedding services
│   ├── embedding-service.ts           # Base class
│   ├── default-embedding-service.ts   # Mock/deterministic (testing)
│   ├── openai-embedding-service.ts    # Production (OpenAI API)
│   ├── embedding-service-factory.ts   # Service creation
│   ├── embedding-job-manager.ts       # Job queue management
│   └── config.ts                      # Embedding configuration
│
├── types/                        # Type definitions (arktype + TypeScript)
│   ├── index.ts                 # Barrel exports + Logger type
│   ├── entity.ts                # Entity with arktype validation
│   ├── relation.ts              # Relation with arktype validation
│   ├── temporal.ts              # Temporal entities/relations
│   ├── vector.ts                # Vector search types
│   ├── storage.ts               # Storage provider interface
│   ├── knowledge-graph.ts       # Knowledge graph types
│   └── shared.ts                # Shared primitives
│
├── utils/                        # Utilities
│   └── search-result-cache.ts   # LRU cache for search results
│
├── knowledge-graph-manager.ts    # Core business logic (1500+ lines)
├── logger.ts                     # Logger implementations (Winston + Consola)
├── config.ts                     # Configuration and environment
└── index.ts                      # MCP server main entry
```

### Key Components

#### 1. KnowledgeGraphManager
**Location:** `src/knowledge-graph-manager.ts`

The central orchestrator that:
- Manages entity and relation CRUD operations
- Delegates to StorageProvider for persistence
- Handles semantic search coordination
- Provides business logic layer

**Status:** ✅ Fully refactored with dependency injection

#### 2. Neo4jStorageProvider
**Location:** `src/storage/neo4j/neo4j-storage-provider.ts`

The main storage implementation:
- 40+ methods for graph operations
- Temporal versioning for all entities/relations
- Automatic embedding generation on entity creation
- Confidence decay calculations
- Comprehensive error handling and logging

**Status:** ✅ Fully refactored with dependency injection, zero `any` types

#### 3. Neo4jVectorStore
**Location:** `src/storage/neo4j/neo4j-vector-store.ts`

**MOST CRITICAL FILE** for semantic search:
- HNSW (Hierarchical Navigable Small World) vector indexing
- Automatic vector normalization (l2-norm = 1 for cosine similarity)
- Vector validation (finite values, non-zero norm)
- Index state verification (must be ONLINE)
- Proper Neo4j query patterns using `db.index.vector.queryNodes()`

**Status:** ✅ Fully refactored with Neo4j v5 best practices

#### 4. Embedding Services
**Locations:** `src/embeddings/*.ts`

- **OpenAIEmbeddingService** - Production embedding (text-embedding-3-small)
- **DefaultEmbeddingService** - Deterministic mock for testing
- **EmbeddingServiceFactory** - Creates services from environment config
- **EmbeddingJobManager** - Manages embedding job queue

**Status:** ✅ Fully refactored with dependency injection

## Design Patterns & Principles

### 1. Dependency Injection

All services use **constructor injection**:

```typescript
// ❌ BAD: Tight coupling
import { logger } from "#logger"

export class MyService {
  doSomething() {
    logger.info("Something happened")
  }
}

// ✅ GOOD: Dependency injection
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

### 2. ArkType Runtime Validation

All data types use **arktype** for runtime validation:

```typescript
import { type } from "arktype"

// Define schema with validation
export const Entity = type({
  name: "string",
  entityType: "string",
  "observations?": "string[]",
})

// Extract TypeScript type
export type Entity = typeof Entity.infer

// Validate at runtime
const result = Entity({ name: "John", entityType: "person" })
if (result instanceof type.errors) {
  console.error(result.summary) // Validation errors
} else {
  console.log(result) // Validated entity
}
```

**Pattern**: Always define schema first, then extract type:
```typescript
export const MyType = type({ /* schema */ })
export type MyType = typeof MyType.infer
```

### 3. Dual Logging Systems

We use **two different loggers** for different contexts:

#### Winston (File-based) - For MCP Server
- **Location:** `src/logger.ts` (createFileLogger)
- **Output:** `~/.local/state/devflow-mcp/log/devflow-mcp.log`
- **Levels:** error, warn, info, debug
- **Includes:** timestamps, metadata, rotation

#### Consola (CLI-based) - For Command-line Tools
- **Location:** `src/logger.ts` (createCliLogger)
- **Output:** stdout/stderr with colors
- **User-friendly:** formatting, progress indicators
- **Use in:** CLI commands only

**Both implement the same `Logger` interface:**
```typescript
export type Logger = {
  info(message: string, meta?: LogMetadata): void
  error(message: string, error?: Error | unknown, meta?: LogMetadata): void
  warn(message: string, meta?: LogMetadata): void
  debug(message: string, meta?: LogMetadata): void
}
```

### 4. Composition Root Pattern

The **server entry point** (`src/server/index.ts`) is the composition root where all dependencies are wired together:

```typescript
// 1. Create logger
const logger = createFileLogger()

// 2. Initialize storage provider (automatically creates embedding service)
const storageProvider = await initializeStorageProvider(logger)

// 3. Create knowledge graph manager
const knowledgeGraphManager = new KnowledgeGraphManager({
  storageProvider,
  logger,
})

// 4. Start MCP server
await setupMcpServer(server, knowledgeGraphManager, logger)
```

## Environment Variables

All application environment variables use the `DFM_` prefix:

```bash
# Embedding Configuration
DFM_MOCK_EMBEDDINGS=false              # Use mock embeddings for testing
DFM_OPENAI_API_KEY=sk-...             # OpenAI API key
DFM_OPENAI_EMBEDDING_MODEL=text-embedding-3-small
DFM_EMBEDDING_RATE_LIMIT_TOKENS=150000
DFM_EMBEDDING_RATE_LIMIT_INTERVAL=60000

# Storage Configuration
DFM_STORAGE_TYPE=neo4j                 # Only neo4j supported

# Neo4j Configuration (no DFM_ prefix)
NEO4J_URI=bolt://localhost:7687
NEO4J_USERNAME=neo4j
NEO4J_PASSWORD=memento_password
NEO4J_DATABASE=neo4j
NEO4J_VECTOR_INDEX=entity_embeddings
NEO4J_VECTOR_DIMENSIONS=1536
NEO4J_SIMILARITY_FUNCTION=cosine

# Logging Configuration
DFM_LOG_LEVEL=info                     # error, warn, info, debug
DFM_ENABLE_CONSOLE_LOGS=false          # Also log to console (in addition to file)
DFM_DEBUG=false                        # Enable debug diagnostics

# Node Environment
NODE_ENV=development                    # development, production, test
```

## TypeScript Configuration

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
    "noUnusedParameters": false,    // Allow unused params (common in interfaces)
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

**Type Guard Pattern:**
```typescript
const record = result.records[0]
if (!record) {
  throw new Error("No record found")
}
// Now safe to use record
```

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

# Or use Neo4j Desktop (recommended)
# Download from https://neo4j.com/download/

# Initialize schema (automatic on first run, but can do manually)
pnpm run neo4j:init

# Run tests
pnpm test

# Start development
pnpm run dev
```

### Common Commands

```bash
# Development
pnpm run dev              # Start in development mode (tsx watch)
pnpm run build            # Build for production (tsdown)
pnpm start                # Start production server

# Testing
pnpm test                 # Run all tests
pnpm run test:watch       # Run tests in watch mode
pnpm run test:coverage    # Generate coverage report
pnpm run test:verbose     # Run with verbose output

# Type Checking & Linting
npx tsc --noEmit          # Type check (no emit)
pnpm typecheck            # Type check (alias)
pnpm run check            # Run ultracite linter
pnpm run lint             # Lint (alias)
pnpm run fix              # Auto-fix linting issues
pnpm run doctor           # Check for common issues

# Neo4j CLI
pnpm run neo4j:test       # Test Neo4j connection
pnpm run neo4j:init       # Initialize schema
dfm neo4j test --help     # See all options
dfm neo4j init --help     # See all options

# Git Hooks (automatic via lefthook)
# Pre-commit: runs ultracite on staged files
```

### Build Process

**Development:**
```bash
pnpm run dev
# Uses: tsx watch src/index.ts
# No build step, instant reload
```

**Production:**
```bash
pnpm run build
# Uses: tsdown (ESM bundler)
# Output: dist/ directory
# Entry points:
#   - dist/index.js (MCP server)
#   - dist/cli/index.js (CLI - bin: dfm)
#   - dist/cli/bash-complete.js (Shell completion)
```

**Testing:**
```bash
pnpm test
# Uses: tsx --test src/**/*.test.ts
# Native Node.js test runner
# No separate test build needed
```

## Neo4j Best Practices

### Vector Search Implementation

Based on Neo4j v5 documentation, we implement:

#### 1. Vector Normalization
```typescript
private normalizeVector(vector: number[]): number[] {
  // Calculate l2-norm (Euclidean length)
  const norm = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0))
  // Normalize to unit length (magnitude = 1)
  return vector.map(v => v / norm)
}
```
**Why:** Required for accurate cosine similarity in Neo4j.

#### 2. Vector Validation
```typescript
private isValidVector(vector: number[]): boolean {
  // Check for finite values
  if (!vector.every(v => Number.isFinite(v))) return false
  // Verify non-zero l2-norm
  const norm = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0))
  return norm > 0
}
```

#### 3. Index State Verification
- Ensure vector index is ONLINE before queries
- Check with: `SHOW VECTOR INDEXES`
- Wait for index population if POPULATING

#### 4. Proper Query Pattern
```cypher
CALL db.index.vector.queryNodes(
  'entity_embeddings',  -- index name
  $limit,               -- max results
  $embedding            -- normalized query vector
)
YIELD node, score
WHERE score >= $minScore
RETURN node, score
ORDER BY score DESC
```

#### 5. Index Configuration
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

## Testing Strategy

### Test Files
- `src/index.test.ts` - MCP server entry point tests
- `src/knowledge-graph-manager.test.ts` - Core business logic tests
- `src/server/handlers/call-tool-handler.test.ts` - Tool handler tests

### Test Patterns

**Mock Logger:**
```typescript
const mockLogger: Logger = {
  info: () => {},
  error: () => {},
  warn: () => {},
  debug: () => {},
}
```

**Mock Storage Provider:**
```typescript
const mockStorageProvider: StorageProvider = {
  loadGraph: async () => ({ entities: [], relations: [] }),
  saveGraph: async () => {},
  // ... other methods
}
```

**Running Tests:**
```bash
# All tests
pnpm test

# Watch mode
pnpm run test:watch

# With coverage
pnpm run test:coverage

# Single file
pnpm test src/knowledge-graph-manager.test.ts
```

## Troubleshooting

### Common Issues

#### 1. Module Resolution Errors
**Error:** `Cannot find module '#types/...`
**Cause:** Path mappings not configured correctly
**Fix:** Check both `tsconfig.json` paths and `package.json` imports

#### 2. Neo4j Connection Failed
**Error:** `Failed to connect to Neo4j`
**Fix:**
```bash
# Test connection
pnpm run neo4j:test

# Check Neo4j is running
docker ps  # or check Neo4j Desktop

# Verify credentials in .env
NEO4J_URI=bolt://localhost:7687
NEO4J_USERNAME=neo4j
NEO4J_PASSWORD=your_password
```

#### 3. Vector Index Not Found
**Error:** `Vector index 'entity_embeddings' not found`
**Fix:**
```bash
# Initialize schema
pnpm run neo4j:init

# Verify index exists
# In Neo4j Browser: SHOW VECTOR INDEXES
```

#### 4. TypeScript Errors on Array Access
**Error:** `Object is possibly 'undefined'`
**Cause:** `noUncheckedIndexedAccess` is enabled
**Fix:** Add type guard:
```typescript
const item = array[0]
if (!item) {
  throw new Error("Item not found")
}
// Now safe to use item
```

## Current Work & Next Steps

### ✅ Completed - Type System Reorganization and Neo4j Validation

**Problem**: 
1. TypeScript errors in `knowledge-graph-manager.ts` due to type mismatches with `VectorStoreFactoryOptions`
2. Duplicate type definitions scattered across storage and types directories
3. Neo4j data parsed with unsafe type casting instead of runtime validation
4. Missing validation for Neo4j relationship data

**Solution Implemented**:

#### 1. Centralized Neo4j Configuration (src/types/storage.ts)
- Created `Neo4jConfig` arktype schema with strict validation:
  - URI: minimum 10 characters
  - Non-empty strings for username, password, database, vectorIndexName
  - Positive integer for vectorDimensions
  - Validated similarityFunction union type
- Moved from `src/storage/neo4j/neo4j-config.ts` to types directory
- Re-exported from original location for backward compatibility

#### 2. Fixed VectorStoreFactoryOptions Type
- Created `VectorStoreFactoryOptionsSchema` with arktype validation
- Used intersection type pattern for Logger: `typeof Schema.infer & { logger?: Logger }`
- Removed duplicate definition from `vector-store-factory.ts`
- Re-exported from `#types/storage` for centralized access

#### 3. Created src/types/neo4j.ts - Neo4j-Specific Types
New file with comprehensive Neo4j data validation:

**Schemas (with runtime validation):**
- `Neo4jNode` - Validates raw node data from Neo4j queries
  - Required: name, entityType, observations (JSON string), version, createdAt, updatedAt
  - Optional: id, validFrom, validTo, changedBy
- `Neo4jRelationship` - Validates raw relationship data from Neo4j queries
  - Required: relationType (validated union)
  - Optional: id, version, timestamps, strength, confidence, metadata

**TypeScript Types:**
- `ExtendedEntity` - Entity + temporal properties, compatible with TemporalEntity
- `ExtendedRelation` - Relation + temporal properties for Neo4j
- `Neo4jSemanticSearchOptions` - Extended search options with queryVector
- `KnowledgeGraphWithDiagnostics` - KnowledgeGraph with optional diagnostics

**Validators:**
- `Neo4jValidator` - Frozen object with validation methods for nodes and relationships

#### 4. Added RelationType Schema (src/types/relation.ts)
- Created `RelationType` arktype schema: `'implements' | 'depends_on' | 'relates_to' | 'part_of'`
- Used in `Relation` schema for consistent validation
- Exported as `RelationTypeValidator` from `#types`

#### 5. Updated Neo4j Storage Provider (src/storage/neo4j/neo4j-storage-provider.ts)
**Removed:**
- All duplicate type definitions (ExtendedEntity, ExtendedRelation, etc.)
- Unsafe type casting with `as` assertions

**Added:**
- `nodeToEntity()` - Now validates with `Neo4jNodeValidator` before parsing
- `relationshipToRelation()` - Now validates with `Neo4jRelationshipValidator`
- Proper error logging when validation fails
- Type-safe data handling throughout

**Fixed:**
- Removed `hybridSearch` property references (was removed from options)
- Fixed entity temporal property handling (use `now` instead of accessing non-existent properties)
- Removed `RelationType.infer` usage (replaced with actual array of values)
- Proper import of validators instead of type-only imports

#### 6. Fixed Variable Shadowing Issues
- Renamed `type` parameter to `relationType` in `getRelation()` method
- Updated both interface and implementation in storage-provider files

### Architecture Benefits

✅ **Runtime Type Safety**
- All data from Neo4j is validated with arktype before use
- Catches invalid data at the boundary (database → application)
- Better error messages with arktype validation summaries

✅ **Centralized Type Management**
- All types in `/types` directory, organized by domain
- No duplicate definitions across codebase
- Single source of truth for schemas

✅ **Consistent Patterns**
- Schema and type use same name (TypeScript declaration merging)
- Validators exported with `-Validator` suffix
- Type-only exports clearly marked

✅ **Improved Maintainability**
- Easy to find and update type definitions
- Clear separation between application types and database schemas
- Validation logic colocated with type definitions

✅ **Better Developer Experience**
- IntelliSense shows validation constraints
- Compile-time AND runtime type safety
- Clear error messages when validation fails

### Files Modified (17 files, +254, -286 lines)

**New Files:**
- `src/types/neo4j.ts` - Neo4j-specific types and validators

**Type System:**
- `src/types/storage.ts` - Added Neo4jConfig, fixed VectorStoreFactoryOptions
- `src/types/relation.ts` - Added RelationType schema
- `src/types/index.ts` - Updated exports for new types and validators
- `src/types/knowledge-graph.ts` - Updated imports

**Storage Layer:**
- `src/storage/neo4j/neo4j-config.ts` - Simplified to re-export from types
- `src/storage/neo4j/neo4j-storage-provider.ts` - Runtime validation, removed casts
- `src/storage/vector-store-factory.ts` - Removed duplicate types
- `src/storage/storage-provider.ts` - Fixed parameter naming

**Other:**
- Various linting and formatting fixes across affected files

### Next Steps
1. ✅ Run type check - All TypeScript errors resolved
2. ✅ Embedding types centralized with arktype validation
3. ⏭️ Run tests - Verify all tests pass with new validation
4. ⏭️ Continue comprehensive code review of remaining files
5. ⏭️ Add integration tests for validation error handling
6. ⏭️ Performance testing with validation enabled

### ✅ Completed - Embedding Subsystem Refactoring (Session 2)

**Problem**:
1. Duplicate type definitions in `embeddings/config.ts` and `embedding-job-manager.ts`
2. Ultracite/biome errors in embedding files (magic numbers, empty blocks, etc.)
3. TypeScript interface incompatibility in `EmbeddingStorageProvider`
4. Constructor with too many parameters (>4)
5. Hardcoded "memento" references (should be "DFM")

**Solution Implemented**:

#### 1. Created Comprehensive Embedding Types (src/types/embedding.ts)

Added all embedding-related types with arktype validation:

**Job Management Types:**
- `EmbeddingJob` - Job record from database with status, priority, timestamps
- `EmbeddingJobStatus` - Valid job statuses: pending, processing, completed, failed
- `JobProcessResults` - Processing results summary
- `CountResult` - Database count query results

**Cache Types:**
- `CachedEmbedding` - Cached embedding entry with vector, timestamp, model
- `CacheOptions` - LRU cache configuration (supports legacy maxItems/ttlHours)

**Rate Limiting:**
- `RateLimiterOptions` - Rate limiter configuration
- `RateLimiterStatus` - Current rate limiter status

**Validators:**
- `EmbeddingConfigValidator` - Frozen object with validation methods
- All types have corresponding validators exported

#### 2. Fixed default-embedding-service.ts

**Ultracite/Biome Fixes:**
- ✅ Extracted all magic numbers to constants (OPENAI_SMALL_DIMENSIONS, DFM_MOCK_DIMENSIONS, etc.)
- ✅ Replaced empty block logger with `createNoOpLogger()`
- ✅ Removed unnecessary `async` where Promise.resolve is used
- ✅ Added biome-ignore for bitwise operations in hash algorithm
- ✅ Used `for-of` loop instead of index-based loop
- ✅ Fixed block statements (early return)

**Other Improvements:**
- Changed "memento-mcp-mock" → "dfm-mcp-mock"
- Added constants: TEXT_PREVIEW_LENGTH, RANDOM_SEED_MULTIPLIER, HASH_BIT_SHIFT

#### 3. Fixed embedding-job-manager.ts

**TypeScript Fixes:**
- ✅ Fixed `EmbeddingStorageProvider` interface incompatibility
  - Removed conflicting `storeEntityVector` override
  - Changed `getEntity` return type to `TemporalEntityType`
  - Updated call to `storeEntityVector` to pass just vector (not object)
- ✅ Removed unused `EntityEmbedding` import
- ✅ Removed 100+ lines of duplicate type definitions

**Code Quality Improvements:**
- ✅ Changed constructor to use options object pattern (was 5 params, now 1)
- ✅ Extracted all magic numbers to constants:
  - Time calculations: MILLISECONDS_PER_SECOND, SECONDS_PER_MINUTE, etc.
  - Defaults: DEFAULT_CACHE_SIZE, DEFAULT_RATE_LIMIT_TOKENS, etc.
  - Job settings: DEFAULT_MAX_ATTEMPTS, DEFAULT_CLEANUP_THRESHOLD_MS
  - CACHE_KEY_PREVIEW_LENGTH for substring operations
- ✅ Replaced empty block logger with `createNoOpLogger()`
- ✅ Added biome-ignore for necessary `any` type on database property

**Constructor Breaking Change:**
```typescript
// Before:
new EmbeddingJobManager(
  storageProvider,
  embeddingService,
  rateLimiterOptions,
  cacheOptions,
  logger
)

// After (options object):
new EmbeddingJobManager({
  storageProvider,
  embeddingService,
  rateLimiterOptions,
  cacheOptions,
  logger,
})
```

#### 4. Deleted Redundant Files

- ❌ `src/embeddings/config.ts` - Moved all types to `src/types/embedding.ts`

#### 5. Updated Type Exports

- `src/types/index.ts` - Exported all new embedding types and validators
- `src/types/embedding.ts` - 310+ lines of comprehensive embedding types

### Architecture Benefits (Embedding Types)

✅ **Centralized Embedding Types** - All embedding types in one location  
✅ **Runtime Validation** - Arktype validates job data, cache options, etc.  
✅ **Consistent Defaults** - Arktype handles defaults for cache and job processing  
✅ **Type Safety** - Proper TypeScript types with runtime checks  
✅ **Clean Code** - Removed 150+ lines of duplicate code  
✅ **Better Maintainability** - Constants extracted, code organized  
✅ **Options Object Pattern** - Constructor follows best practices

### Files Modified (6 files, +202, -303 lines)

**Deleted:**
- `src/embeddings/config.ts` (-113) - Moved to types

**New:**
- `src/types/embedding.ts` (+310) - Comprehensive embedding types

**Updated:**
- `src/embeddings/default-embedding-service.ts` (+77 -77) - Fixed all linting issues
- `src/embeddings/embedding-job-manager.ts` (+255 -303) - Fixed TypeScript + linting
- `src/types/index.ts` (+34 -2) - Exported embedding types
- `src/server/setup.ts` - Updated imports

### Remaining Items
- ⚠️ `processJobs` method has complexity 26/15 (acceptable for future refactoring)

### Future Work

**Problem**: During type consolidation (commit `1a1e897`), `SemanticSearchOptions` was lost when `entity-embedding.ts` was consolidated into `index.ts`.

**Solution Implemented**:
1. ✅ Created minimal `SemanticSearchOptions` in `src/types/storage.ts` with only 3 vector-specific properties:
   - `queryVector?: number[]` - Pre-computed query vector
   - `minSimilarity?: number` - Minimum similarity threshold (0.0-1.0)
   - `threshold?: number` - Alias for minSimilarity
2. ✅ Exported both type and validator from `src/types/index.ts`
3. ✅ Removed circular import from `src/types/storage.ts`
4. ✅ Removed duplicate `SearchOptions` definition in `src/storage/storage-provider.ts`
5. ✅ Fixed import in `src/knowledge-graph-manager.test.ts` to import from `#types` instead of `#knowledge-graph-manager`

**Architecture**: `SemanticSearchOptions` is used via intersection type with `SearchOptions`:
```typescript
// In implementations:
function semanticSearch(
  query: string,
  options: SearchOptions & SemanticSearchOptions
): Promise<KnowledgeGraph>
```

This provides clean separation:
- `SearchOptions` = general search options (limit, entityTypes, caseSensitive)
- `SemanticSearchOptions` = vector-specific options (queryVector, minSimilarity, threshold)

### ✅ Completed - KnowledgeGraphManagerOptions Type Issue RESOLVED

**Problem**: `KnowledgeGraphManagerOptions` was defined with arktype using all `"unknown"` types, which caused the inferred TypeScript type to also be `unknown`. This led to type errors in the constructor:
- `Type 'unknown' is not assignable to type 'StorageProvider'`
- `Type '{}' is missing properties from type 'Logger'`
- `Type 'unknown' is not assignable to type 'EmbeddingJobManager | undefined'`

**Root Cause**: Arktype cannot validate complex interfaces with methods at runtime, so attempting to use arktype for this options type was both useless (everything was `unknown`) and harmful (broke TypeScript inference).

**Solution**: Changed from arktype schema to plain TypeScript type:
```typescript
// Before (arktype - BAD):
export const KnowledgeGraphManagerOptions = type({
  storageProvider: "unknown",
  "embeddingJobManager?": "unknown",
  "vectorStoreOptions?": "unknown",
  "logger?": "unknown",
})
export type KnowledgeGraphManagerOptions = typeof KnowledgeGraphManagerOptions.infer

// After (plain TypeScript - GOOD):
export type KnowledgeGraphManagerOptions = {
  storageProvider: StorageProvider
  embeddingJobManager?: EmbeddingJobManager
  vectorStoreOptions?: VectorStoreFactoryOptions
  logger?: Logger
}
```

**Files Modified**:
1. ✅ `src/types/knowledge-graph.ts` - Converted to plain TypeScript type with proper type references
2. ✅ `src/types/knowledge-graph.ts` - Added necessary imports for the types
3. ✅ `src/types/index.ts` - Removed validator export (no longer exists)

### 🔄 Next Steps
1. **Run type check** - `npx tsc --noEmit` to verify zero TypeScript errors
2. **Run tests** - `pnpm test` to verify all tests pass
3. **Continue fixing remaining TypeScript errors** - Work through the error list systematically
4. **Continue code review** - Resume comprehensive review of remaining files

### Future Work
- Complete comprehensive code review of remaining files
- Document all MCP tools with examples
- Add integration tests for full workflow
- Performance optimization for large graphs
- Consider adding more embedding providers (local models)

## Important Notes for Future Sessions

### What You Need to Know

1. **We removed features that didn't work** - The original Memento MCP documented features that were never implemented. We removed dead code to provide an honest API.

2. **We use arktype for everything** - All types that need runtime validation use arktype. Pattern is always:
   ```typescript
   export const MyType = type({ /* schema */ })
   export type MyType = typeof MyType.infer
   ```

3. **We have two loggers** - Winston for server (file logs), Consola for CLI (stdout). Both implement same `Logger` interface.

4. **Dependency injection everywhere** - All services accept dependencies via constructor. No global state, no direct imports of utilities.

5. **Current issue** - `SemanticSearchOptions` type was lost during consolidation. We're recreating it with only actually-used properties.

6. **No npm** - This project uses **pnpm**. Always use `pnpm install`, `pnpm test`, etc.

7. **Path aliases** - Use `#types`, `#storage`, etc. for imports. Defined in `tsconfig.json` paths and `package.json` imports.

8. **Environment variables** - App-specific vars use `DFM_` prefix (e.g., `DFM_OPENAI_API_KEY`). Neo4j vars don't have prefix.

## Key Files Reference

### Must-Read Files
- `README.md` - User-facing documentation
- `package.json` - Dependencies, scripts, project metadata
- `tsconfig.json` - TypeScript configuration
- `.env.example` - Environment variable template
- `src/config.ts` - Configuration and env validation
- `src/types/index.ts` - Type barrel exports
- `src/knowledge-graph-manager.ts` - Core business logic

### Critical Implementation Files
- `src/storage/neo4j/neo4j-storage-provider.ts` - Main storage (2450+ lines)
- `src/storage/neo4j/neo4j-vector-store.ts` - Vector search (CRITICAL)
- `src/server/handlers/call-tool-handler.ts` - MCP tool dispatcher
- `src/embeddings/embedding-job-manager.ts` - Embedding queue

### Configuration Files
- `biome.json` - Linter/formatter config (via ultracite)
- `lefthook.yml` - Git hooks
- `tsdown.config.ts` - Production build config
- `docker-compose.yml` - Neo4j container setup

## Useful Commands Quick Reference

```bash
# Development
pnpm run dev                    # Start dev server
pnpm run build                  # Build production
pnpm test                       # Run tests

# Type Checking
npx tsc --noEmit               # Check types
pnpm run check                 # Run linter

# Neo4j
pnpm run neo4j:test            # Test connection
pnpm run neo4j:init            # Initialize schema
dfm neo4j test --uri bolt://localhost:7687

# Git
git log --oneline -20          # Recent commits
git show <commit>              # Show commit details
git diff HEAD~5..HEAD          # Recent changes

# Search Codebase
grep -r "pattern" src/         # Search files
grep -n "pattern" file.ts      # With line numbers
```

## Contact & Support

For questions or issues:
1. Check this CLAUDE.md file first
2. Review error logs in `~/.local/state/devflow-mcp/log/`
3. Run diagnostics: `pnpm run neo4j:test`, `npx tsc --noEmit`
4. Check Neo4j schema: `SHOW VECTOR INDEXES` in Neo4j Browser

---

**Last Updated:** 2025-01-15
**Current Session Focus:** Embedding subsystem refactoring - types and validation
**Status:** ✅ All TypeScript and ultracite errors resolved
**Next Action:** Continue code review and testing of embedding functionality
