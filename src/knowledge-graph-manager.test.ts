// biome-ignore-all lint/style/noDoneCallback: node:test uses a context object 't' not a callback

/**
 * Test file for KnowledgeGraphManager
 */

// biome-ignore lint/performance/noNamespaceImport: Required for tsc to correctly type-check node:assert/strict
import * as assert from "node:assert/strict"
import { afterEach, beforeEach, describe, it, mock } from "node:test"
import {
  type Entity,
  type KnowledgeGraph,
  KnowledgeGraphManager,
  type Relation,
  type SemanticSearchOptions,
} from "#knowledge-graph-manager"
import type { StorageProvider } from "#storage/storage-provider"
import type { TemporalEntityType } from "#types"

// Define EntityObservation type based on the addObservations method parameter
type EntityObservation = {
  entityName: string
  contents: string[]
  [key: string]: unknown
}

const EMPTY_GRAPH: KnowledgeGraph = { entities: [], relations: [] }
const ONE_SECOND_IN_MS = 1000
const VECTOR_DIMENSIONS = 1536
const EMBEDDING_VALUE = 0.1
const MIN_SIMILARITY = 0.8
const SEARCH_LIMIT = 20
const RELATION_STRENGTH = 0.8
const RELATION_CONFIDENCE = 0.9
const UPDATED_STRENGTH = 0.9
const UPDATED_CONFIDENCE = 0.95

describe("KnowledgeGraphManager with Enhanced Relations", () => {
  it("should use StorageProvider getRelation for retrieving a relation", async (t) => {
    const timestamp = Date.now()
    const enhancedRelation: Relation = {
      from: "entity1",
      to: "entity2",
      relationType: "knows",
      strength: RELATION_STRENGTH,
      confidence: RELATION_CONFIDENCE,
      metadata: {
        createdAt: timestamp,
        updatedAt: timestamp,
        inferredFrom: [],
        lastAccessed: timestamp,
      },
    }

    const getRelationMock = t.mock.fn((..._args: unknown[]) =>
      Promise.resolve(enhancedRelation)
    )
    const mockProvider: Partial<StorageProvider> = {
      getRelation: getRelationMock,
    }

    const manager = new KnowledgeGraphManager({
      storageProvider: mockProvider as StorageProvider,
    })

    const relation = await manager.getRelation("entity1", "entity2", "knows")

    assert.strictEqual(getRelationMock.mock.callCount(), 1)
    assert.deepStrictEqual(getRelationMock.mock.calls[0]?.arguments, [
      "entity1",
      "entity2",
      "knows",
    ])
    assert.deepStrictEqual(relation, enhancedRelation)
  })

  it("should use StorageProvider updateRelation for updating a relation", async (t) => {
    const timestamp = Date.now()
    const updatedRelation: Relation = {
      from: "entity1",
      to: "entity2",
      relationType: "knows",
      strength: UPDATED_STRENGTH,
      confidence: UPDATED_CONFIDENCE,
      metadata: {
        createdAt: timestamp,
        updatedAt: timestamp + ONE_SECOND_IN_MS,
        inferredFrom: [],
        lastAccessed: timestamp,
      },
    }

    const updateRelationMock = t.mock.fn((..._args: unknown[]) =>
      Promise.resolve(undefined)
    )
    const mockProvider: Partial<StorageProvider> = {
      updateRelation: updateRelationMock,
    }

    const manager = new KnowledgeGraphManager({
      storageProvider: mockProvider as StorageProvider,
    })

    await manager.updateRelation(updatedRelation)

    assert.strictEqual(updateRelationMock.mock.callCount(), 1)
    assert.deepStrictEqual(updateRelationMock.mock.calls[0]?.arguments, [
      updatedRelation,
    ])
  })
})

describe("KnowledgeGraphManager with StorageProvider", () => {
  it("should accept a StorageProvider in constructor", (t) => {
    const loadGraphMock = t.mock.fn(() => Promise.resolve(EMPTY_GRAPH))
    const mockProvider: Partial<StorageProvider> = {
      loadGraph: loadGraphMock,
    }

    const manager = new KnowledgeGraphManager({
      storageProvider: mockProvider as StorageProvider,
    })
    assert.ok(manager instanceof KnowledgeGraphManager)
  })

  it("should use StorageProvider loadGraph when reading graph", async (t) => {
    const mockGraph: KnowledgeGraph = {
      entities: [{ name: "test", entityType: "test", observations: [] }],
      relations: [],
    }

    const loadGraphMock = t.mock.fn(() => Promise.resolve(mockGraph))
    const mockProvider: Partial<StorageProvider> = {
      loadGraph: loadGraphMock,
    }

    const manager = new KnowledgeGraphManager({
      storageProvider: mockProvider as StorageProvider,
    })
    const result = await manager.readGraph()

    assert.strictEqual(loadGraphMock.mock.callCount(), 1)
    assert.deepStrictEqual(result, mockGraph)
  })

  it("should use StorageProvider createEntities when creating entities", async (t) => {
    const createEntitiesMock = t.mock.fn(
      async (entities: Entity[]): Promise<TemporalEntityType[]> =>
        entities.map((e) => ({
          id: `id-${e.name}`,
          name: e.name,
          entityType: e.entityType,
          observations: e.observations,
          version: 1,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          validFrom: Date.now(),
          embedding: e.embedding,
        })) as TemporalEntityType[]
    )
    const mockProvider: Partial<StorageProvider> = {
      createEntities: createEntitiesMock,
      loadGraph: t.mock.fn(() => Promise.resolve(EMPTY_GRAPH)),
    }

    const manager = new KnowledgeGraphManager({
      storageProvider: mockProvider as StorageProvider,
    })
    const newEntity: Entity = {
      name: "newEntity",
      entityType: "test",
      observations: [],
    }
    await manager.createEntities([newEntity])

    assert.strictEqual(createEntitiesMock.mock.callCount(), 1)
    assert.deepStrictEqual(createEntitiesMock.mock.calls[0]?.arguments, [
      [newEntity],
    ])
  })

  it("should use StorageProvider searchNodes when searching", async (t) => {
    const mockSearchResult: KnowledgeGraph = {
      entities: [{ name: "test", entityType: "test", observations: [] }],
      relations: [],
    }

    const searchNodesMock = t.mock.fn(() => Promise.resolve(mockSearchResult))
    const mockProvider: Partial<StorageProvider> = {
      searchNodes: searchNodesMock,
    }

    const manager = new KnowledgeGraphManager({
      storageProvider: mockProvider as StorageProvider,
    })
    const query = "test"
    const result = await manager.searchNodes(query)

    assert.strictEqual(searchNodesMock.mock.callCount(), 1)
    assert.deepStrictEqual(searchNodesMock.mock.calls[0]?.arguments, [query])
    assert.deepStrictEqual(result, mockSearchResult)
  })

  it("should use StorageProvider openNodes when opening nodes", async (t) => {
    const mockOpenResult: KnowledgeGraph = {
      entities: [{ name: "test", entityType: "test", observations: [] }],
      relations: [],
    }

    const openNodesMock = t.mock.fn(() => Promise.resolve(mockOpenResult))
    const mockProvider: Partial<StorageProvider> = {
      openNodes: openNodesMock,
    }

    const manager = new KnowledgeGraphManager({
      storageProvider: mockProvider as StorageProvider,
    })
    const nodeNames = ["test"]
    const result = await manager.openNodes(nodeNames)

    assert.strictEqual(openNodesMock.mock.callCount(), 1)
    assert.deepStrictEqual(openNodesMock.mock.calls[0]?.arguments, [nodeNames])
    assert.deepStrictEqual(result, mockOpenResult)
  })

  it("should use StorageProvider when creating relations", async (t) => {
    const createRelationsMock = t.mock.fn(
      async (relations: Relation[]) => relations
    )
    const loadGraphMock = t.mock.fn(() => Promise.resolve(EMPTY_GRAPH))
    const saveGraphMock = t.mock.fn(() => Promise.resolve())
    const mockProvider: Partial<StorageProvider> = {
      createRelations: createRelationsMock,
      loadGraph: loadGraphMock,
      saveGraph: saveGraphMock,
    }

    const manager = new KnowledgeGraphManager({
      storageProvider: mockProvider as StorageProvider,
    })
    const newRelation: Relation = {
      from: "entity1",
      to: "entity2",
      relationType: "test",
    }
    await manager.createRelations([newRelation])

    assert.strictEqual(createRelationsMock.mock.callCount(), 1)
    assert.deepStrictEqual(createRelationsMock.mock.calls[0]?.arguments, [
      [newRelation],
    ])
    assert.strictEqual(loadGraphMock.mock.callCount(), 0)
    assert.strictEqual(saveGraphMock.mock.callCount(), 0)
  })

  it("should use StorageProvider when adding observations", async (t) => {
    const observations: EntityObservation[] = [
      {
        entityName: "entity1",
        contents: ["new observation"],
      },
    ]

    const expectedResult = [
      {
        entityName: "entity1",
        addedObservations: ["new observation"],
      },
    ]

    const addObservationsMock = t.mock.fn(() => Promise.resolve(expectedResult))
    const loadGraphMock = t.mock.fn(() => Promise.resolve(EMPTY_GRAPH))
    const saveGraphMock = t.mock.fn(() => Promise.resolve())
    const mockProvider: Partial<StorageProvider> = {
      addObservations: addObservationsMock,
      loadGraph: loadGraphMock,
      saveGraph: saveGraphMock,
    }

    const manager = new KnowledgeGraphManager({
      storageProvider: mockProvider as StorageProvider,
    })
    const result = await manager.addObservations(observations)

    assert.strictEqual(addObservationsMock.mock.callCount(), 1)
    assert.deepStrictEqual(addObservationsMock.mock.calls[0]?.arguments, [
      observations,
    ])
    assert.deepStrictEqual(result, expectedResult)
    assert.strictEqual(loadGraphMock.mock.callCount(), 0)
    assert.strictEqual(saveGraphMock.mock.callCount(), 0)
  })

  it("should directly delegate to StorageProvider for createRelations", async (t) => {
    const newRelation: Relation = {
      from: "entity1",
      to: "entity2",
      relationType: "test",
    }

    const createRelationsMock = t.mock.fn(
      async (relations: Relation[]) => relations
    )
    const loadGraphMock = t.mock.fn(() => Promise.resolve(EMPTY_GRAPH))
    const saveGraphMock = t.mock.fn(() => Promise.resolve())
    const mockProvider: Partial<StorageProvider> = {
      createRelations: createRelationsMock,
      loadGraph: loadGraphMock,
      saveGraph: saveGraphMock,
    }

    const manager = new KnowledgeGraphManager({
      storageProvider: mockProvider as StorageProvider,
    })

    const result = await manager.createRelations([newRelation])

    assert.strictEqual(createRelationsMock.mock.callCount(), 1)
    assert.deepStrictEqual(createRelationsMock.mock.calls[0]?.arguments, [
      [newRelation],
    ])
    assert.deepStrictEqual(result, [newRelation])
    assert.strictEqual(loadGraphMock.mock.callCount(), 0)
    assert.strictEqual(saveGraphMock.mock.callCount(), 0)
  })
})

// From src/__vitest__/KnowledgeGraphManagerSearch.test.ts
describe("KnowledgeGraphManager Search", () => {
  let manager: KnowledgeGraphManager
  let mockStorageProvider: Partial<StorageProvider>
  let searchNodesMock: any
  let semanticSearchMock: any

  beforeEach(() => {
    searchNodesMock = mock.fn(() =>
      Promise.resolve({
        entities: [
          {
            name: "KeywordResult",
            entityType: "Test",
            observations: ["keyword result"],
          },
        ],
        relations: [],
      })
    )

    semanticSearchMock = mock.fn(() =>
      Promise.resolve({
        entities: [
          {
            name: "SemanticResult",
            entityType: "Test",
            observations: ["semantic result"],
          },
        ],
        relations: [],
        total: 1,
        facets: { entityType: { counts: { Test: 1 } } },
        timeTaken: 10,
      })
    )

    mockStorageProvider = {
      searchNodes: searchNodesMock,
      semanticSearch: semanticSearchMock,
    }

    const mockEmbeddingService = {
      generateEmbedding: mock.fn(() =>
        Promise.resolve(new Array(VECTOR_DIMENSIONS).fill(EMBEDDING_VALUE))
      ),
    }

    const mockEmbeddingJobManager = {
      embeddingService: mockEmbeddingService,
      scheduleEntityEmbedding: mock.fn(() => Promise.resolve("mock-job-id")),
    }

    manager = new KnowledgeGraphManager({
      storageProvider: mockStorageProvider as StorageProvider,
      embeddingJobManager: mockEmbeddingJobManager as any,
    })
  })

  afterEach(() => {
    mock.reset()
  })

  it("should use basic searchNodes when no options are provided", async () => {
    const result = await manager.search("test query")

    assert.strictEqual(searchNodesMock.mock.callCount(), 1)
    assert.deepStrictEqual(searchNodesMock.mock.calls[0]?.arguments, [
      "test query",
    ])
    assert.strictEqual(semanticSearchMock.mock.callCount(), 0)

    assert.strictEqual(result.entities.length, 1)
    assert.strictEqual(result.entities[0]?.name, "KeywordResult")
  })

  it("should use semanticSearch when semanticSearch option is true", async () => {
    const result = await manager.search("test query", { semanticSearch: true })

    assert.strictEqual(semanticSearchMock.mock.callCount(), 1)
    const callArgs = semanticSearchMock.mock.calls[0]?.arguments
    assert.strictEqual(callArgs[0], "test query")
    assert.strictEqual(callArgs[1].semanticSearch, true)
    assert.ok(Array.isArray(callArgs[1].queryVector))

    assert.strictEqual(searchNodesMock.mock.callCount(), 0)

    assert.strictEqual(result.entities.length, 1)
    assert.strictEqual(result.entities[0]?.name, "SemanticResult")
  })

  it("should use semanticSearch when hybridSearch option is true", async () => {
    const result = await manager.search("test query", { hybridSearch: true })

    assert.strictEqual(semanticSearchMock.mock.callCount(), 1)
    const callArgs = semanticSearchMock.mock.calls[0]?.arguments
    assert.strictEqual(callArgs[0], "test query")
    assert.strictEqual(callArgs[1].hybridSearch, true)
    assert.strictEqual(callArgs[1].semanticSearch, true)
    assert.ok(Array.isArray(callArgs[1].queryVector))

    assert.strictEqual(result.entities.length, 1)
    assert.strictEqual(result.entities[0]?.name, "SemanticResult")
  })

  it("should fall back to searchNodes if semanticSearch is not available", async () => {
    mockStorageProvider.semanticSearch = undefined

    const result = await manager.search("test query", { semanticSearch: true })

    assert.strictEqual(searchNodesMock.mock.callCount(), 1)
    assert.deepStrictEqual(searchNodesMock.mock.calls[0]?.arguments, [
      "test query",
    ])

    assert.strictEqual(result.entities.length, 1)
    assert.strictEqual(result.entities[0]?.name, "KeywordResult")
  })

  it("should fall back to basic search for file-based implementation", async () => {
    const mockProvider: Partial<StorageProvider> = {
      searchNodes: mock.fn(() =>
        Promise.resolve({
          entities: [
            {
              name: "FileResult",
              entityType: "Test",
              observations: ["file result"],
            },
          ],
          relations: [],
        })
      ),
    }

    const fileBasedManager = new KnowledgeGraphManager({
      storageProvider: mockProvider as StorageProvider,
    })

    const fileSearchMock = mock.fn(() =>
      Promise.resolve({
        entities: [
          {
            name: "FileResult",
            entityType: "Test",
            observations: ["file result"],
          },
        ],
        relations: [],
      })
    )
    fileBasedManager.searchNodes = fileSearchMock

    const result = await fileBasedManager.search("test query", {
      semanticSearch: true,
    })

    assert.strictEqual(fileSearchMock.mock.callCount(), 1)
    assert.deepStrictEqual(fileSearchMock.mock.calls[0]?.arguments, [
      "test query",
    ])

    assert.strictEqual(result.entities.length, 1)
    assert.strictEqual(result.entities[0]?.name, "FileResult")
  })

  it("should pass additional search options to semanticSearch", async () => {
    const searchOptions: SemanticSearchOptions = {
      semanticSearch: true,
      minSimilarity: MIN_SIMILARITY,
      limit: SEARCH_LIMIT,
      includeExplanations: true,
      filters: [{ field: "entityType", operator: "eq", value: "Person" }],
    }

    await manager.search("test query", searchOptions)

    assert.strictEqual(semanticSearchMock.mock.callCount(), 1)
    const callArgs = semanticSearchMock.mock.calls[0]?.arguments
    assert.strictEqual(callArgs[0], "test query")
    assert.strictEqual(callArgs[1].semanticSearch, true)
    assert.strictEqual(callArgs[1].minSimilarity, MIN_SIMILARITY)
    assert.strictEqual(callArgs[1].limit, SEARCH_LIMIT)
    assert.strictEqual(callArgs[1].includeExplanations, true)
    assert.deepStrictEqual(callArgs[1].filters, [
      { field: "entityType", operator: "eq", value: "Person" },
    ])
    assert.ok(Array.isArray(callArgs[1].queryVector))
  })
})

describe("KnowledgeGraphManager with VectorStore", () => {
  it("should add entity embeddings to vector store when created", async (t) => {
    const addVectorMock = t.mock.fn(() => Promise.resolve(undefined))

    const mockVectorStore = {
      initialize: t.mock.fn(() => Promise.resolve(undefined)),
      addVector: addVectorMock,
      removeVector: t.mock.fn(() => Promise.resolve(undefined)),
      search: t.mock.fn(() =>
        Promise.resolve([
          {
            id: "Entity1",
            similarity: 0.95,
            metadata: { entityType: "Person" },
          },
        ])
      ),
    }

    const createEntitiesMock = t.mock.fn(
      (entities: Entity[]): Promise<TemporalEntityType[]> =>
        Promise.resolve(
          entities.map((e) => ({
            id: `id-${e.name}`,
            name: e.name,
            entityType: e.entityType,
            observations: e.observations,
            version: 1,
            createdAt: Date.now(),
            updatedAt: Date.now(),
            validFrom: Date.now(),
            embedding: e.embedding,
          })) as TemporalEntityType[]
        )
    )

    const mockProvider: Partial<StorageProvider> = {
      createEntities: createEntitiesMock,
      loadGraph: t.mock.fn(() => Promise.resolve(EMPTY_GRAPH)),
    }

    const manager = new KnowledgeGraphManager({
      storageProvider: mockProvider as StorageProvider,
    })

    // Manually inject the mock vector store (in a real scenario, this would use dependency injection)
    // @ts-expect-error - accessing private property for testing
    manager.vectorStore = mockVectorStore

    const entity = {
      name: "TestEntity",
      entityType: "Test",
      observations: ["Test observation"],
      embedding: {
        vector: new Array(VECTOR_DIMENSIONS)
          .fill(0)
          .map((_, i) => i / VECTOR_DIMENSIONS),
        model: "test-model",
        lastUpdated: Date.now(),
      },
    }

    await manager.createEntities([entity])

    assert.strictEqual(createEntitiesMock.mock.callCount(), 1)
    assert.strictEqual(addVectorMock.mock.callCount(), 1)
    // Check the first call's arguments - type assertion needed for node:test mock API
    const firstCall = addVectorMock.mock.calls[0]
    // @ts-expect-error - node:test mock calls have empty tuple type, but contain actual arguments at runtime
    assert.strictEqual(firstCall?.arguments[0], "TestEntity")
    // @ts-expect-error - node:test mock calls have empty tuple type, but contain actual arguments at runtime
    assert.deepStrictEqual(firstCall?.arguments[2], {
      entityType: "Test",
      name: "TestEntity",
    })
  })

  it("should remove vectors from store when entities are deleted", async (t) => {
    const removeVectorMock = t.mock.fn(() => Promise.resolve(undefined))
    const deleteEntitiesMock = t.mock.fn(() => Promise.resolve(undefined))

    const mockVectorStore = {
      initialize: t.mock.fn(() => Promise.resolve(undefined)),
      addVector: t.mock.fn(() => Promise.resolve(undefined)),
      removeVector: removeVectorMock,
      search: t.mock.fn(() => Promise.resolve([])),
    }

    const mockProvider: Partial<StorageProvider> = {
      deleteEntities: deleteEntitiesMock,
      loadGraph: t.mock.fn(() => Promise.resolve(EMPTY_GRAPH)),
    }

    const manager = new KnowledgeGraphManager({
      storageProvider: mockProvider as StorageProvider,
    })

    // Manually inject the mock vector store
    // @ts-expect-error - accessing private property for testing
    manager.vectorStore = mockVectorStore

    await manager.deleteEntities(["Entity1", "Entity2"])

    assert.strictEqual(removeVectorMock.mock.callCount(), 2)
    // @ts-expect-error - node:test mock calls have empty tuple type, but contain actual arguments at runtime
    assert.strictEqual(removeVectorMock.mock.calls[0]?.arguments[0], "Entity1")
    // @ts-expect-error - node:test mock calls have empty tuple type, but contain actual arguments at runtime
    assert.strictEqual(removeVectorMock.mock.calls[1]?.arguments[0], "Entity2")
    assert.strictEqual(deleteEntitiesMock.mock.callCount(), 1)
    // @ts-expect-error - node:test mock calls have empty tuple type, but contain actual arguments at runtime
    assert.deepStrictEqual(deleteEntitiesMock.mock.calls[0]?.arguments[0], [
      "Entity1",
      "Entity2",
    ])
  })
})
