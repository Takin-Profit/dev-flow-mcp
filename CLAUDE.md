# DevFlow MCP - Project Guide for AI Assistants

## Project Overview

**Project Name:** DevFlow MCP (DevFlow Model Context Protocol)  
**Version:** 1.0.0  
**Package Manager:** pnpm (NOT npm)  
**Node Version:** >=20.0.0  
**TypeScript:** 5.8.2 with strict configuration  
**Primary Language:** TypeScript (ESNext)

### What Is DevFlow MCP?

DevFlow MCP is a **knowledge graph memory layer** for AI-driven software development workflows. It provides persistent, queryable memory for AI agents working on software projects, enabling context-aware decision making, code review, and project planning.

This is a **significant fork** of [Memento MCP](https://github.com/gannonh/memento-mcp) by Gannon Hall, focused on:
- **Architectural honesty** - Only shipping features that actually work
- **Code quality** - Zero `any` types, full dependency injection, strict TypeScript
- **Simplicity** - Removing unimplemented features and dead code
- **Maintainability** - Modern tooling, comprehensive logging, proper abstractions

### Core Architecture

The system uses:
- **Neo4j Graph Database** (v6.0.0) - For storing entities, relationships, and temporal versioning
- **Vector Embeddings** - For semantic search (OpenAI text-embedding-3-small, 1536 dimensions)
- **MCP Protocol** (v1.20.0) - For communication with AI agents (Claude Desktop, Cursor, etc.)
- **Runtime Validation** - ArkType for type safety at runtime

## Technology Stack

### Core Dependencies
- **@modelcontextprotocol/sdk** (1.20.0) - MCP protocol implementation
- **neo4j-driver** (^6.0.0) - Neo4j database driver
- **arktype** (^2.1.23) - Runtime type validation
- **arkenv** (^0.7.3) - Environment variable validation
- **openai** (^6.3.0) - OpenAI API for embeddings
- **winston** (^3.18.3) - Structured logging (server)
- **consola** (^3.4.2) - User-friendly CLI logging
- **@stricli/core** (^1.2.4) - CLI framework
- **uuid** (^13.0.0) - UUID generation
- **lru-cache** (^11.1.0) - Built-in types, LRU caching

### Development Tools
- **tsx** (^4.19.3) - Fast TypeScript runner for dev/tests
- **tsdown** (^0.15.7) - Production TypeScript bundler
- **ultracite** (^5.6.4) - Biome-based linter/formatter
- **lefthook** (^1.13.6) - Git hooks for linting
- **@types/node** (^24.7.2) - Node.js type definitions
- **@types/uuid** (^11.0.0) - UUID type definitions

### Build Tooling
- **Development**: tsx (uses esbuild internally)
- **Production**: tsdown for bundling
- **Testing**: Native Node.js test runner with tsx
- **Type Checking**: TypeScript compiler (tsc)

## Recent Work (Latest Session)

**Test Suite & Dependency Updates** - Completed comprehensive quality improvements:
- Fixed all TypeScript errors in `knowledge-graph-manager.test.ts`
- Removed unimplemented filter properties from tests (`filters`, `includeExplanations`)
- Fixed entityType literal types to match union `'feature' | 'task' | 'decision' | 'component' | 'test'`
- Fixed mock typing and embedding service mocks
- Upgraded all dependencies to latest versions (major updates for MCP SDK, Neo4j, OpenAI, UUID, etc.)
- Removed deprecated `@types/lru-cache` (types now built-in)
- Removed unused `zod` dependency
- Fixed package.json scripts (removed duplicates, fixed dev path, added --noEmit to typecheck)
- **All 21 tests passing** ✅
- **Zero TypeScript errors** ✅

## Project Structure

```
src/
├── cli/                          # Stricli-based CLI commands (4 files)
│   ├── index.ts                 # CLI entry point (bin: dfm)
│   ├── app.ts                   # CLI application definition
│   ├── neo4j.ts                 # Neo4j management commands
│   └── mcp.ts                   # MCP server command
│
├── server/                       # MCP server (5 files)
│   ├── index.ts                 # Server entry point & composition root
│   ├── setup.ts                 # MCP server configuration
│   └── handlers/                # MCP tool handlers
│       ├── call-tool-handler.ts      # Main tool dispatcher
│       ├── list-tools-handler.ts     # Tool schema definitions
│       └── tool-handlers.ts          # Individual tool implementations
│
├── storage/                      # Storage abstraction layer (9 files)
│   ├── storage-provider.ts            # StorageProvider interface
│   ├── storage-provider-factory.ts   # Factory for creating storage providers
│   ├── vector-store-factory.ts       # Factory for vector stores
│   ├── search-result-cache.ts        # LRU cache for search results
│   └── neo4j/                        # Neo4j implementation
│       ├── neo4j-config.ts
│       ├── neo4j-connection-manager.ts
│       ├── neo4j-schema-manager.ts
│       ├── neo4j-vector-store.ts        # CRITICAL for semantic search
│       └── neo4j-storage-provider.ts    # Main storage impl (2450+ lines)
│
├── embeddings/                   # Embedding services (5 files)
│   ├── embedding-service.ts           # Base class
│   ├── default-embedding-service.ts   # Mock/deterministic (testing)
│   ├── openai-embedding-service.ts    # Production (OpenAI API)
│   ├── embedding-service-factory.ts   # Service creation
│   └── embedding-job-manager.ts       # Job queue management
│
├── types/                        # Type definitions (10 files)
│   ├── index.ts                 # Barrel exports + Logger type
│   ├── entity.ts                # Entity with arktype validation
│   ├── relation.ts              # Relation with arktype validation
│   ├── temporal.ts              # Temporal entities/relations
│   ├── vector.ts                # Vector search types
│   ├── storage.ts               # Storage provider interface
│   ├── knowledge-graph.ts       # Knowledge graph types
│   ├── shared.ts                # Shared primitives
│   ├── embedding.ts             # Embedding types
│   ├── neo4j.ts                 # Neo4j-specific types
│   ├── constants.ts             # Shared constants
│   └── logger.ts                # Logger type definitions
│
├── utils/                        # Utilities (1 file)
│   └── index.ts                 # Utility functions
│
├── knowledge-graph-manager.ts    # Core business logic (~600 lines)
├── logger.ts                     # Logger implementations (Winston + Consola)
└── config.ts                     # Configuration and environment
```

**Statistics:**
- Source files: 41 TypeScript files
- Test files: 2 test files
- Total tests: 21 (all passing)
- Main business logic: knowledge-graph-manager.ts
- Largest file: neo4j-storage-provider.ts (~2450 lines)

## Core Concepts

### 1. Entity Types

Entities represent semantic nodes in the knowledge graph. Valid entity types:
- `feature` - A product feature or capability
- `task` - A work item or action item
- `decision` - An architectural or design decision
- `component` - A code component, module, or service
- `test` - A test case or test suite

### 2. Relation Types

Relations connect entities with semantic meaning:
- `implements` - One entity implements another
- `depends_on` - One entity depends on another
- `relates_to` - Generic relationship between entities
- `part_of` - One entity is part of another

### 3. Temporal Versioning

All entities and relations are versioned with:
- `version` - Integer version number
- `createdAt` - Timestamp of creation
- `updatedAt` - Timestamp of last update
- `validFrom` - Start of validity period
- `validTo` - End of validity period (null = current)
- `changedBy` - Who made the change

### 4. Semantic Search

Vector embeddings enable semantic search:
- OpenAI `text-embedding-3-small` model (1536 dimensions)
- Cosine similarity for matching
- Automatic embedding generation on entity creation
- HNSW vector indexing in Neo4j

## Key Design Patterns

### 1. Dependency Injection

All services use constructor injection for dependencies:

```typescript
// ✅ GOOD: Dependency injection
import type { Logger } from "#types"
import { createNoOpLogger } from "#types"

export class MyService {
  private readonly logger: Logger

  constructor(options: { logger?: Logger } = {}) {
    this.logger = options.logger ?? createNoOpLogger()
  }
}
```

**Benefits:** Testable, flexible, no global state

### 2. ArkType Runtime Validation

All data types that cross boundaries use arktype:

```typescript
import { type } from "arktype"

// Define schema with validation
export const Entity = type({
  name: "string",
  entityType: "'feature' | 'task' | 'decision' | 'component' | 'test'",
  observations: "string[]",
})

// Extract TypeScript type
export type Entity = typeof Entity.infer

// Validate at runtime
const result = Entity(data)
if (result instanceof type.errors) {
  console.error(result.summary)
} else {
  console.log(result) // Validated entity
}
```

### 3. Dual Logging Systems

**Winston (File-based)** - For MCP Server
- Output: `~/.local/state/devflow-mcp/log/devflow-mcp.log`
- Includes: timestamps, metadata, rotation

**Consola (CLI-based)** - For Command-line Tools
- Output: stdout/stderr with colors
- User-friendly formatting

Both implement the same `Logger` interface.

### 4. Composition Root Pattern

The server entry point (`src/server/index.ts`) wires all dependencies together:

```typescript
// 1. Create logger
const logger = createFileLogger()

// 2. Initialize storage provider
const storageProvider = initializeStorageProvider()

// 3. Create knowledge graph manager
const knowledgeGraphManager = new KnowledgeGraphManager({
  storageProvider,
  logger,
})

// 4. Start MCP server
await setupServer(knowledgeGraphManager, logger)
```

## Environment Variables

All application variables use the `DFM_` prefix:

```bash
# Embedding Configuration
DFM_MOCK_EMBEDDINGS=false
DFM_OPENAI_API_KEY=sk-...
DFM_OPENAI_EMBEDDING_MODEL=text-embedding-3-small

# Neo4j Configuration (no DFM_ prefix)
NEO4J_URI=bolt://localhost:7687
NEO4J_USERNAME=neo4j
NEO4J_PASSWORD=your_password
NEO4J_DATABASE=neo4j
NEO4J_VECTOR_INDEX=entity_embeddings
NEO4J_VECTOR_DIMENSIONS=1536
NEO4J_SIMILARITY_FUNCTION=cosine

# Logging Configuration
DFM_LOG_LEVEL=info
DFM_ENABLE_CONSOLE_LOGS=false

# Node Environment
NODE_ENV=development
```

## Development Workflow

### Getting Started

```bash
# Clone and install
git clone <repo>
cd devflow-mcp
pnpm install

# Set up environment
cp example.env .env
# Edit .env with your Neo4j credentials and OpenAI API key

# Start Neo4j (Docker or Desktop)
docker-compose up -d neo4j

# Initialize schema
pnpm run neo4j:init

# Run tests
pnpm test

# Start development server
pnpm run dev
```

### Common Commands

```bash
# Development
pnpm run dev              # Start in watch mode
pnpm run build            # Build for production
pnpm start                # Start production server

# Testing
pnpm test                 # Run all tests
pnpm run test:watch       # Run tests in watch mode

# Type Checking & Linting
pnpm run typecheck        # Type check (tsc --noEmit)
pnpm run check            # Run linter
pnpm run fix              # Auto-fix linting issues

# Neo4j CLI
pnpm run neo4j:test       # Test Neo4j connection
pnpm run neo4j:init       # Initialize schema
dfm neo4j test            # CLI version
```

### Build Process

**Development:**
- Uses: `tsx watch src/server/index.ts`
- No build step, instant reload

**Production:**
- Uses: `tsdown` (ESM bundler)
- Output: `dist/` directory
- Entry points: `dist/server/index.js`, `dist/cli/index.js`

**Testing:**
- Uses: `tsx --test src/**/*.test.ts`
- Native Node.js test runner

## Testing Strategy

### Test Files
- `src/knowledge-graph-manager.test.ts` - Core business logic tests (21 tests)
- `src/index.test.ts` - MCP server integration tests

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
const mockStorageProvider: Partial<StorageProvider> = {
  searchNodes: mock.fn(() => Promise.resolve({ entities: [], relations: [] })),
}
```

**Running Tests:**
```bash
pnpm test                           # All tests
pnpm test src/knowledge-graph-manager.test.ts  # Single file
```

## TypeScript Configuration

**Key Settings:**

```json
{
  "compilerOptions": {
    "target": "ESNext",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "paths": {
      "#*": ["./src/*"]
    }
  }
}
```

**Implications:**
- Array access returns `T | undefined` (need type guards)
- No `.js` extensions in imports
- Full type safety, no implicit any
- Path aliases work in both TS and runtime

**Type Guard Pattern:**
```typescript
const record = result.records[0]
if (!record) {
  throw new Error("No record found")
}
// Now safe to use record
```

## Neo4j Best Practices

### Vector Search Implementation

#### 1. Vector Normalization
```typescript
private normalizeVector(vector: number[]): number[] {
  const norm = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0))
  return vector.map(v => v / norm)
}
```

#### 2. Proper Query Pattern
```cypher
CALL db.index.vector.queryNodes(
  'entity_embeddings',
  $limit,
  $embedding
)
YIELD node, score
WHERE score >= $minScore
RETURN node, score
ORDER BY score DESC
```

#### 3. Index Configuration
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

## Troubleshooting

### Common Issues

#### 1. Module Resolution Errors
**Error:** `Cannot find module '#types/...'`
**Fix:** Check both `tsconfig.json` paths and `package.json` imports

#### 2. Neo4j Connection Failed
```bash
# Test connection
pnpm run neo4j:test

# Verify credentials in .env
NEO4J_URI=bolt://localhost:7687
NEO4J_USERNAME=neo4j
NEO4J_PASSWORD=your_password
```

#### 3. Vector Index Not Found
```bash
# Initialize schema
pnpm run neo4j:init

# Verify in Neo4j Browser
SHOW VECTOR INDEXES
```

#### 4. TypeScript Array Access Errors
**Error:** `Object is possibly 'undefined'`
**Fix:** Add type guard:
```typescript
const item = array[0]
if (!item) throw new Error("Item not found")
// Now safe
```

## Important Notes for AI Assistants

### What You Need to Know

1. **We removed features that didn't work** - Original Memento MCP had documented but unimplemented features. We removed dead code for honest API.

2. **We use arktype for runtime validation** - Pattern is always:
   ```typescript
   export const MyType = type({ /* schema */ })
   export type MyType = typeof MyType.infer
   ```

3. **We have two loggers** - Winston for server (file), Consola for CLI (stdout). Both implement same interface.

4. **Dependency injection everywhere** - All services accept dependencies via constructor.

5. **No npm** - This project uses **pnpm**. Always use `pnpm install`, `pnpm test`, etc.

6. **Path aliases** - Use `#types`, `#storage`, etc. Defined in `tsconfig.json` and `package.json`.

7. **Environment variables** - App vars use `DFM_` prefix. Neo4j vars have no prefix.

8. **All tests passing** - 21 tests, zero TypeScript errors, all dependencies up to date.

## Key Files Reference

### Must-Read Files
- `README.md` - User-facing documentation
- `package.json` - Dependencies, scripts
- `tsconfig.json` - TypeScript config
- `src/config.ts` - Environment validation
- `src/types/index.ts` - Type exports
- `src/knowledge-graph-manager.ts` - Core logic

### Critical Implementation Files
- `src/storage/neo4j/neo4j-storage-provider.ts` - Main storage (~2450 lines)
- `src/storage/neo4j/neo4j-vector-store.ts` - Vector search (CRITICAL)
- `src/server/handlers/call-tool-handler.ts` - MCP tool dispatcher

### Configuration Files
- `biome.jsonc` - Linter/formatter (via ultracite)
- `lefthook.yml` - Git hooks
- `tsdown.config.ts` - Production build
- `docker-compose.yml` - Neo4j container

## Quick Command Reference

```bash
# Development
pnpm run dev            # Watch mode
pnpm run build          # Production build
pnpm test               # Run tests

# Type Checking
pnpm run typecheck      # tsc --noEmit
pnpm run check          # Linter
pnpm run fix            # Auto-fix

# Neo4j
pnpm run neo4j:test     # Test connection
pnpm run neo4j:init     # Init schema

# Git
git log --oneline -20   # Recent commits
git status              # Working directory status
```

## Current Status

✅ **All tests passing** (21/21)  
✅ **Zero TypeScript errors**  
✅ **All dependencies up to date**  
✅ **Clean codebase** (no `any` types, full DI, strict TS)  
✅ **Production ready**

---

**Last Updated:** 2025-01-15  
**Current Session:** Test suite fixes and dependency updates  
**Status:** ✅ Ready for production deployment  
**Next Action:** Deploy and monitor in production environment
