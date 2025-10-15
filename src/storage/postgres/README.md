# PostgreSQL Storage Provider

This directory contains a prototype PostgreSQL storage provider for DevFlow MCP using Apache AGE for graph operations and pgvector for vector embeddings.

## Status: Prototype

This is a **prototype implementation** created as an alternative to the Neo4j storage provider. It demonstrates how DevFlow MCP could work with PostgreSQL + Apache AGE + pgvector.

## Architecture

- **Apache AGE**: Provides graph database capabilities on top of PostgreSQL
- **pgvector**: Adds vector similarity search to PostgreSQL
- **Hybrid Storage**: Combines relational tables for entities/relations with graph operations via AGE

## Key Differences from Neo4j Implementation

### Query Language
- **Neo4j**: Native Cypher queries
- **PostgreSQL/AGE**: Cypher-like syntax wrapped in PostgreSQL functions

### Vector Search
- **Neo4j**: Integrated vector indexes with native graph queries
- **PostgreSQL**: Separate pgvector operations coordinated with AGE graph queries

### Schema Management
- **Neo4j**: Dynamic schema with constraints and indexes
- **PostgreSQL**: Traditional relational tables + AGE graph + vector indexes

## Prerequisites

- PostgreSQL 15+ with extensions:
  - Apache AGE (graph database)
  - pgvector (vector similarity search)

## Installation

```bash
# Install PostgreSQL dependencies
pnpm add pg @types/pg

# Set up PostgreSQL with required extensions
# (Installation instructions for AGE and pgvector vary by platform)
```

## Configuration

```typescript
const config: PostgresConfig = {
  host: 'localhost',
  port: 5432,
  database: 'devflow_mcp',
  username: 'postgres',
  password: 'password',
  graphName: 'knowledge_graph',
  vectorDimensions: 1536,
  vectorSimilarityFunction: 'cosine'
}
```

## Current Implementation Status

### ✅ Implemented
- Basic entity CRUD operations
- Relation management
- Text-based search
- Vector storage with pgvector
- Schema initialization
- Connection management

### 🚧 Partial Implementation
- Semantic search (basic pgvector integration)
- Temporal features (schema ready, logic needed)

### ❌ Not Yet Implemented
- Apache AGE graph queries
- Advanced semantic search
- Confidence decay
- History/versioning
- Full StorageProvider interface compliance

## Next Steps

1. **Complete AGE Integration**: Implement actual graph queries using Apache AGE
2. **Semantic Search**: Full integration between pgvector and graph operations
3. **Temporal Features**: Implement history and point-in-time queries
4. **Testing**: Comprehensive test suite
5. **Performance**: Optimize queries and indexing
6. **Documentation**: Complete setup and usage guides

## Usage Example

```typescript
import { PostgresStorageProvider } from './postgres/index.js'

const provider = new PostgresStorageProvider({
  host: 'localhost',
  port: 5432,
  database: 'devflow_mcp',
  username: 'postgres',
  password: 'password',
  graphName: 'knowledge_graph',
  vectorDimensions: 1536,
  vectorSimilarityFunction: 'cosine'
})

await provider.initialize()
const graph = await provider.loadGraph()
```

## Notes

This implementation serves as a proof-of-concept for PostgreSQL-based storage. The goal is to evaluate whether PostgreSQL + AGE + pgvector can provide equivalent functionality to Neo4j while offering the benefits of a familiar relational database foundation.
