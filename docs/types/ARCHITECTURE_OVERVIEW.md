# DevFlow MCP Architecture Overview

**Last Updated:** 2025-10-19
**Status:** Current Production Architecture

## System Architecture

DevFlow MCP is built as a **SQLite-only knowledge graph system** with **zero external dependencies** and **complete type safety**.

```
┌─────────────────────────────────────────────────────────────┐
│                    MCP Client (Claude Desktop)              │
└─────────────────────┬───────────────────────────────────────┘
                      │ Model Context Protocol
                      │
┌─────────────────────▼───────────────────────────────────────┐
│                 DevFlow MCP Server                          │
│  ┌─────────────────────────────────────────────────────────┐│
│  │              MCP Protocol Layer                         ││
│  │  • Tool Handlers (create_entities, semantic_search)    ││
│  │  • Input Validation (Zod v4 schemas)                   ││
│  │  • Response Formatting (structured JSON)               ││
│  └─────────────────────────────────────────────────────────┘│
│  ┌─────────────────────────────────────────────────────────┐│
│  │            Knowledge Graph Manager                      ││
│  │  • Entity Management                                    ││
│  │  • Relation Management                                  ││
│  │  • Semantic Search Coordination                        ││
│  │  • Temporal Operations                                  ││
│  └─────────────────────────────────────────────────────────┘│
│  ┌─────────────────────────────────────────────────────────┐│
│  │              Database Layer                             ││
│  │  • SqliteDb (self-initializing)                        ││
│  │  • Schema Management                                    ││
│  │  • Vector Store Integration                             ││
│  │  • Temporal Versioning                                 ││
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────┬───────────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────────┐
│                SQLite Database                              │
│  • Single file storage (knowledge.db)                      │
│  • sqlite-vec extension for vector search                  │
│  • Environment-specific pragma configuration               │
│  • Automatic schema initialization                         │
└─────────────────────────────────────────────────────────────┘
```

---

## Core Components

### 1. MCP Protocol Layer

**Purpose**: Handle Model Context Protocol communication with AI clients.

**Key Files**:
- `src/server/setup.ts` - MCP server configuration
- `src/server/call-tool-handler.ts` - Tool execution logic
- `src/server/list-tools-handler.ts` - Tool discovery

**Responsibilities**:
- Validate all incoming requests with Zod schemas
- Route tool calls to appropriate handlers
- Format responses according to MCP specification
- Handle errors gracefully with structured messages

### 2. Knowledge Graph Manager

**Purpose**: Orchestrate knowledge graph operations across the system.

**Key Files**:
- `src/knowledge-graph-manager.ts` - Main orchestration logic

**Responsibilities**:
- Coordinate entity and relation operations
- Manage semantic search workflows
- Handle temporal queries and versioning
- Integrate with embedding services

### 3. Database Layer

**Purpose**: Provide type-safe, high-performance data persistence.

**Key Files**:
- `src/db/sqlite-db.ts` - Main database interface
- `src/db/sqlite-schema-manager.ts` - Schema management
- `src/db/sqlite-vector-store.ts` - Vector search operations

**Responsibilities**:
- Self-initialize database with environment-specific configuration
- Provide CRUD operations for entities and relations
- Handle vector embeddings and similarity search
- Manage temporal versioning and history
- Implement confidence decay algorithms

### 4. Type System

**Purpose**: Ensure runtime safety and excellent developer experience.

**Key Files**:
- `src/types/validation.ts` - Zod schemas
- `src/types/database.ts` - Database interfaces
- `src/types/knowledge-graph.ts` - Domain types

**Responsibilities**:
- Define all data structures with Zod v4 schemas
- Provide type inference for TypeScript
- Validate input at API boundaries
- Generate meaningful error messages

---

## Data Flow

### Entity Creation Flow

```
1. MCP Client Request
   ↓
2. Zod Schema Validation (CreateEntitiesArgsSchema)
   ↓
3. Knowledge Graph Manager
   ↓
4. SqliteDb.createEntities()
   ↓
5. SQLite Database Storage
   ↓
6. Response Formatting
   ↓
7. MCP Client Response
```

### Semantic Search Flow

```
1. Search Query (text)
   ↓
2. Embedding Generation (OpenAI API)
   ↓
3. Vector Search (sqlite-vec)
   ↓
4. Similarity Scoring
   ↓
5. Result Ranking
   ↓
6. Entity Retrieval
   ↓
7. Formatted Results
```

---

## Configuration Management

### Environment-Aware Database Configuration

```typescript
// Development
{
  journalMode: 'WAL',
  synchronous: 'NORMAL',
  cacheSize: -64000, // 64MB
  mmapSize: 64000000, // 64MB
}

// Testing  
{
  journalMode: 'WAL',
  synchronous: 'OFF', // Faster for tests
  cacheSize: -32000, // 32MB
  lockingMode: 'EXCLUSIVE'
}

// Production
{
  journalMode: 'WAL', 
  synchronous: 'NORMAL',
  cacheSize: -64000, // 64MB
  mmapSize: 268435456, // 256MB
  busyTimeout: 10000
}
```

### Automatic Environment Detection

```typescript
const environment = env.DFM_ENV === 'test' ? 'testing' : 
                   env.DFM_ENV === 'production' ? 'production' : 'development'
```

---

## Security Architecture

### Input Validation

- **All external input** validated with Zod schemas at API boundaries
- **SQL injection prevention** through parameterized queries
- **Type safety** prevents many classes of runtime errors
- **No network exposure** - local SQLite file only

### Data Protection

- **File-based storage** with standard filesystem permissions
- **No network services** - eliminates network attack vectors
- **Environment variable validation** prevents configuration errors
- **Structured error handling** prevents information leakage

---

## Performance Architecture

### Database Optimization

- **WAL mode** for concurrent read/write access
- **Memory-mapped I/O** for large datasets
- **Optimized cache sizes** based on environment
- **Efficient indexing** for common query patterns

### Vector Search Optimization

- **Native sqlite-vec** integration for high-performance similarity search
- **Configurable dimensions** to balance accuracy vs. performance
- **Batch operations** for bulk embedding updates
- **Similarity thresholds** to limit result sets

### Memory Management

- **Connection pooling** through sqlite-x
- **LRU caching** for frequently accessed data
- **Streaming operations** for large result sets
- **Garbage collection friendly** object patterns

---

## Monitoring and Observability

### Structured Logging

```typescript
// Winston + Consola integration
logger.info("Entity created", { 
  entityName: entity.name,
  entityType: entity.entityType,
  observationCount: entity.observations.length
})
```

### Error Tracking

```typescript
// Comprehensive error classification
export type ErrorCode = 
  | "INVALID_INPUT"      // User input validation failed
  | "ENTITY_NOT_FOUND"   // Requested entity doesn't exist  
  | "DATABASE_ERROR"     // SQLite operation failed
  | "INTERNAL_ERROR"     // Unexpected system error
```

### Performance Metrics

- Database operation timing
- Vector search performance
- Memory usage tracking
- Error rate monitoring

---

## Deployment Architecture

### Single Binary Deployment

```bash
# Production deployment
dfm mcp

# With custom database location
DFM_SQLITE_LOCATION=/data/knowledge.db dfm mcp

# With full configuration
DFM_SQLITE_LOCATION=/data/knowledge.db \
OPENAI_API_KEY=sk-... \
OPENAI_EMBEDDING_MODEL=text-embedding-3-small \
dfm mcp
```

### Zero External Dependencies

- **No Docker required** - native Node.js application
- **No database server** - embedded SQLite
- **No network services** - file-based storage
- **No complex setup** - works out of the box

### Backup and Recovery

```bash
# Backup (simple file copy)
cp knowledge.db knowledge.db.backup

# Recovery (simple file restore)
cp knowledge.db.backup knowledge.db

# Migration (export/import)
dfm export --output data.json
dfm import --input data.json
```

---

## Testing Architecture

### Test Strategy

- **Unit Tests**: Mock external dependencies, test business logic
- **Integration Tests**: Real SQLite database, test data flow
- **Type Tests**: Compile-time validation of type safety
- **E2E Tests**: Full MCP protocol testing

### Test Environment

```typescript
// Automatic test configuration
const testDb = new SqliteDb(":memory:", logger, {
  // Uses testing environment configuration automatically
})
```

### Continuous Integration

- **Zero external services** required for CI
- **Fast test execution** with in-memory SQLite
- **Comprehensive coverage** with type checking
- **Automated quality gates** (linting, type checking, tests)

---

## Future Architecture Considerations

### Scalability

- **Horizontal scaling**: Multiple SQLite files with sharding
- **Vertical scaling**: Larger memory configurations
- **Caching layers**: Redis or in-memory caches for hot data
- **Read replicas**: SQLite backup files for read-only access

### Extensibility

- **Plugin architecture**: MCP server extensions
- **Custom embeddings**: Support for additional embedding models
- **Schema evolution**: Versioned database migrations
- **Multi-modal support**: Images, audio, video embeddings

### Integration

- **API gateway**: REST/GraphQL API layer
- **Event streaming**: Change data capture for real-time updates
- **Backup services**: Automated cloud backup integration
- **Monitoring**: Integration with observability platforms

The architecture is designed to be **simple, reliable, and maintainable** while providing **excellent performance** and **developer experience**.
