# Integration Tests

This directory contains integration tests that require a real Neo4j database.

## Running Integration Tests

### Prerequisites

1. **Start Neo4j with Docker:**
   ```bash
   # Simple Docker command (no docker-compose needed)
   docker run -d \
     --name dfm-neo4j-test \
     -p 7474:7474 -p 7687:7687 \
     -e NEO4J_AUTH=neo4j/dfm_password \
     -e NEO4J_ACCEPT_LICENSE_AGREEMENT=yes \
     neo4j:2025.03.0-enterprise
   ```

   **Alternative:** Use docker-compose if you prefer:
   ```bash
   docker-compose up -d neo4j
   ```

2. **Wait for Neo4j to be ready** (about 10-30 seconds):
   ```bash
   # Check if Neo4j is ready
   docker logs dfm-neo4j-test 2>&1 | grep -i "started"
   
   # Or with docker-compose:
   # docker-compose logs neo4j | grep "Started"
   ```

3. **Initialize the schema:**
   ```bash
   pnpm run neo4j:init
   ```

### Run Tests

```bash
# Run all integration tests
pnpm run test:integration

# Run specific integration test file
NODE_ENV=testing TEST_INTEGRATION=true tsx --test src/tests/integration/neo4j-storage.integration.test.ts
```

## Test Database

Integration tests connect to:
- **Connection:** `bolt://localhost:7687`
- **Username:** `neo4j`
- **Password:** `dfm_password`
- **Database:** `neo4j` (default)

### Test Isolation

Each test:
1. Creates test data with unique names (timestamped prefixes)
2. Cleans up after itself in the `after()` hook
3. Uses transactions where possible

**Note:** Tests may modify the database. For a clean state, restart Neo4j:
```bash
# With plain Docker:
docker restart dfm-neo4j-test

# With docker-compose:
docker-compose restart neo4j

# Then reinitialize schema:
pnpm run neo4j:init
```

### Stopping Neo4j

```bash
# With plain Docker:
docker stop dfm-neo4j-test
docker rm dfm-neo4j-test

# With docker-compose:
docker-compose down neo4j
```

## What We Test

Integration tests verify:
- ✅ Neo4j queries work correctly
- ✅ Data persists to database
- ✅ Vector search returns accurate results
- ✅ Strength and confidence are saved/retrieved
- ✅ Metadata is stored correctly
- ✅ Confidence decay calculations work
- ✅ Temporal queries return correct history
- ✅ Relations are created with correct properties

## Test Structure

```
src/tests/integration/
├── README.md (this file)
├── neo4j-storage.integration.test.ts  # Storage provider tests
├── vector-search.integration.test.ts  # Vector search tests
└── temporal.integration.test.ts       # Temporal/history tests
```

## CI/CD

Integration tests can run in CI using GitHub Actions with a Neo4j service container. See `.github/workflows/test.yml` for configuration.

## Troubleshooting

### Neo4j Connection Failed
```
Error: Failed to connect to Neo4j
```
**Solution:** Make sure Neo4j is running: `docker-compose ps neo4j`

### Schema Not Initialized
```
Error: Vector index not found
```
**Solution:** Run `pnpm run neo4j:init`

### Tests Failing Randomly
**Solution:** Tests may have leftover data. Clean the database:
```bash
# With plain Docker:
docker stop dfm-neo4j-test
docker rm dfm-neo4j-test
# Then start fresh (see step 1 above)

# With docker-compose:
docker-compose down -v neo4j
docker-compose up -d neo4j

# Then reinitialize:
pnpm run neo4j:init
```
