# Changelog

All notable changes to DevFlow MCP will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2025-01-18

### Added

- **MAJOR**: Complete migration to SQLite-only architecture
- Zod v4 compatibility with forked MCP SDK (@socotra/modelcontextprotocol-sdk)
- Self-initializing database architecture with environment-aware configuration
- Enhanced type safety throughout codebase (zero TypeScript errors)
- Comprehensive test coverage with proper type guards
- sqlite-vec integration for vector search capabilities
- Environment-specific pragma configuration (development/testing/production)

### Changed

- **BREAKING**: Migrated from Neo4j to SQLite-only architecture
- **BREAKING**: Simplified configuration - removed 9+ Neo4j environment variables
- **BREAKING**: Updated SqliteDb constructor to be self-initializing
- **BREAKING**: Removed Docker requirements for development
- Enhanced vector search capabilities with sqlite-vec integration
- Improved error handling with proper type safety
- Streamlined CLI interface focused on SQLite operations
- Updated all dependencies to latest versions

### Removed

- **BREAKING**: All Neo4j dependencies and implementation (~4,000 lines of code)
- **BREAKING**: Docker Compose configuration for Neo4j
- **BREAKING**: Neo4j CLI commands and utilities
- Complex multi-backend abstraction layers
- Unused configuration options and environment variables

### Fixed

- Zod v4 compatibility issues throughout codebase
- TypeScript strict mode compliance (achieved zero errors)
- Logger interface compatibility between application and sqlite-x
- Test reliability and type safety in all test files
- Linting configuration to focus on main application code

## [0.3.9] - 2025-05-08

### Changed

- Updated dependencies to latest versions:
  - @modelcontextprotocol/sdk from 1.8.0 to 1.11.0
  - axios from 1.8.4 to 1.9.0
  - dotenv from 16.4.7 to 16.5.0
  - eslint from 9.23.0 to 9.26.0
  - eslint-config-prettier from 10.1.1 to 10.1.3
  - glob from 11.0.1 to 11.0.2
  - openai from 4.91.1 to 4.97.0
  - tsx from 4.19.3 to 4.19.4
  - typescript from 5.8.2 to 5.8.3
  - vitest and @vitest/coverage-v8 from 3.1.1 to 3.1.3
  - zod from 3.24.2 to 3.24.4
  - @typescript-eslint/eslint-plugin and @typescript-eslint/parser from 8.29.0 to 8.32.0

## [0.3.8] - 2025-04-01

### Added

- Initial public release
- Knowledge graph memory system with entities and relations
- SQLite storage backend with unified graph and vector storage
- Semantic search using OpenAI embeddings
- Temporal awareness with version history for all graph elements
- Time-based confidence decay for relations
- Rich metadata support for entities and relations
- MCP tools for entity and relation management
- Support for Claude Desktop, Cursor, and other MCP-compatible clients
- CLI utilities for database management
- Comprehensive documentation and examples

### Changed

- Enhanced vector search capabilities with sqlite-vec integration
- Improved performance for large knowledge graphs

## [0.3.0] - [Unreleased]

### Added

- Initial beta version with SQLite support
- Vector search integration
- Basic MCP server functionality

## [0.2.0] - [Unreleased]

### Added

- SQLite storage backend
- Core knowledge graph data structures
- Basic entity and relation management

## [0.1.0] - [Unreleased]

### Added

- Project initialization
- Basic MCP server framework
- Core interfaces and types
