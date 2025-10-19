# Implementation Roadmap

**Status**: Schema Complete ✅ | Processing Implementation Pending 🚧

Step-by-step guide to completing the document chunking feature.

## Phase 1: Token Counting Utility ⏱️ 2-3 hours

### Goal
Add accurate token counting to Zod validation using `js-tiktoken`.

### Tasks

1. **Install dependency**
   ```bash
   npm install js-tiktoken
   ```

2. **Create utility** (`src/utils/token-counter.ts`)
   ```typescript
   import { Tiktoken } from "js-tiktoken/lite";
   import cl100k_base from "js-tiktoken/ranks/cl100k_base";
   
   export class TokenCounter {
     private encoder: Tiktoken;
     
     constructor() {
       this.encoder = new Tiktoken(cl100k_base);
     }
     
     count(text: string): number {
       return this.encoder.encode(text).length;
     }
     
     cleanup(): void {
       this.encoder.free();
     }
   }
   
   // Singleton for reuse
   export const tokenCounter = new TokenCounter();
   ```

3. **Update ContentBlock schema** (`src/types/document-input.ts`)
   ```typescript
   import { tokenCounter } from "#utils/token-counter";
   
   export const ContentBlockSchema = z.object({
     // ... existing fields
     content: z
       .string()
       .min(1)
       .max(TOKEN_LIMITS.CONTENT_BLOCK_CHARS)
       .refine(
         (text) => tokenCounter.count(text) <= TOKEN_LIMITS.CONTENT_BLOCK,
         (text) => ({
           message: `Content exceeds ${TOKEN_LIMITS.CONTENT_BLOCK} tokens (actual: ${tokenCounter.count(text)})`
         })
       ),
   });
   ```

4. **Add token calculation helper**
   ```typescript
   export function calculateTokens(doc: StructuredDocument): {
     total: number;
     bySectionId: Map<UUID, number>;
   } {
     const bySectionId = new Map<UUID, number>();
     let total = 0;
     
     for (const section of doc.sections) {
       const blocks = getAllContentBlocks(section);
       const sectionTokens = blocks.reduce(
         (sum, block) => sum + tokenCounter.count(block.content),
         0
       );
       bySectionId.set(section.id, sectionTokens);
       total += sectionTokens;
     }
     
     return { total, bySectionId };
   }
   ```

### Tests
- `token-counter.test.ts`: Verify token counting accuracy
- `document-input.test.ts`: Test validation with token limits

---

## Phase 2: Document Processor Service ⏱️ 4-6 hours

### Goal
Create service to convert `StructuredDocument` to knowledge graph entities and embeddings.

### Tasks

1. **Create service** (`src/services/document-processor.ts`)
   ```typescript
   import type {
     StructuredDocument,
     Section,
     ContentBlock,
   } from "#types";
   import type { KnowledgeGraphManager } from "#knowledge-graph-manager";
   import type { EmbeddingService } from "#embeddings/embedding-service";
   
   export class DocumentProcessor {
     constructor(
       private knowledgeGraph: KnowledgeGraphManager,
       private embeddingService: EmbeddingService,
       private logger: Logger
     ) {}
     
     async ingest(doc: StructuredDocument): Promise<IngestResult> {
       // 1. Validate
       const validated = StructuredDocumentSchema.parse(doc);
       
       // 2. Process each section
       const results = await Promise.all(
         validated.sections.map(section => this.processSection(section, doc.metadata))
       );
       
       // 3. Create relations
       await this.createRelations(validated);
       
       return this.aggregateResults(results);
     }
     
     private async processSection(
       section: Section,
       docMetadata: DocumentMetadata
     ): Promise<SectionProcessResult> {
       // Extract all content blocks
       const blocks = this.extractContentBlocks(section);
       
       // Batch generate embeddings
       const texts = blocks.map(b => b.content);
       const embeddings = await this.embeddingService.generateEmbeddings(texts);
       
       // Create entity
       const entity = {
         name: this.toEntityName(section.metadata.title),
         entityType: section.metadata.entityType,
         observations: [
           section.metadata.summary,
           ...texts
         ]
       };
       
       // Store
       await this.knowledgeGraph.createEntities([entity]);
       
       // Store embeddings
       await this.storeEmbeddings(entity.name, embeddings, blocks);
       
       return {
         entityName: entity.name,
         blocksProcessed: blocks.length,
         embeddingsCreated: embeddings.length
       };
     }
     
     private extractContentBlocks(section: Section): ContentBlock[] {
       const blocks: ContentBlock[] = [];
       
       if (section.content) {
         blocks.push(...section.content);
       }
       
       if (section.subsections) {
         for (const subsection of section.subsections) {
           blocks.push(...subsection.content);
         }
       }
       
       return blocks;
     }
     
     private toEntityName(title: string): EntityName {
       return title.replace(/\s+/g, '_') as EntityName;
     }
     
     private async createRelations(doc: StructuredDocument): Promise<void> {
       const relations: Relation[] = [];
       
       // Hierarchical relations (subsection → section)
       for (const section of doc.sections) {
         if (section.subsections) {
           for (const subsection of section.subsections) {
             relations.push({
               from: this.toEntityName(subsection.metadata.title),
               to: this.toEntityName(section.metadata.title),
               relationType: "part_of"
             });
           }
         }
       }
       
       // Cross-references
       if (doc.crossReferences) {
         for (const ref of doc.crossReferences) {
           relations.push({
             from: this.lookupEntityByBlockId(ref.from, doc),
             to: this.lookupEntityByBlockId(ref.to, doc),
             relationType: ref.relationType
           });
         }
       }
       
       await this.knowledgeGraph.createRelations(relations);
     }
   }
   ```

2. **Create types** (`src/types/document-processor.ts`)
   ```typescript
   export interface IngestResult {
     success: boolean;
     documentId: UUID;
     entitiesCreated: number;
     embeddingsCreated: number;
     relationsCreated: number;
     processedSections: number;
     errors?: ProcessingError[];
   }
   
   export interface SectionProcessResult {
     entityName: EntityName;
     blocksProcessed: number;
     embeddingsCreated: number;
   }
   
   export interface ProcessingError {
     sectionId: UUID;
     blockId?: UUID;
     error: string;
   }
   ```

3. **Add factory** (`src/services/document-processor-factory.ts`)
   ```typescript
   export function createDocumentProcessor(
     knowledgeGraph: KnowledgeGraphManager,
     embeddingService: EmbeddingService,
     logger: Logger
   ): DocumentProcessor {
     return new DocumentProcessor(knowledgeGraph, embeddingService, logger);
   }
   ```

### Tests
- `document-processor.test.ts`: Unit tests for each method
- `document-processor.integration.test.ts`: Full ingestion flow

---

## Phase 3: MCP Tool Integration ⏱️ 3-4 hours

### Goal
Expose document processing as an MCP tool.

### Tasks

1. **Add tool definition** (`src/server/tools/list-tools-handler.ts`)
   ```typescript
   {
     name: "process_document",
     description: "Ingest a structured document into the knowledge graph. " +
                  "The document must follow the StructuredDocument schema with " +
                  "sections, subsections, and content blocks.",
     inputSchema: zodToJsonSchema(ProcessDocumentInputSchema, {
       name: "ProcessDocumentInput"
     })
   }
   ```

2. **Create input schema** (`src/types/validation.ts`)
   ```typescript
   export const ProcessDocumentInputSchema = z.object({
     document: StructuredDocumentSchema,
     options: z.object({
       createSubsectionEntities: z.boolean().default(false)
         .describe("Create separate entities for subsections"),
       batchSize: z.number().int().positive().default(20)
         .describe("Maximum content blocks per batch embedding call"),
       skipExistingEntities: z.boolean().default(false)
         .describe("Skip processing if entity already exists")
     }).optional()
   }).strict();
   
   export type ProcessDocumentInput = z.infer<typeof ProcessDocumentInputSchema>;
   ```

3. **Create tool handler** (`src/server/tools/process-document-handler.ts`)
   ```typescript
   import type { CallToolRequest } from "@modelcontextprotocol/sdk/types.js";
   import { ProcessDocumentInputSchema } from "#types/validation";
   import type { DocumentProcessor } from "#services/document-processor";
   
   export async function handleProcessDocument(
     request: CallToolRequest,
     processor: DocumentProcessor
   ): Promise<CallToolResult> {
     try {
       // Validate input
       const input = ProcessDocumentInputSchema.parse(request.params.arguments);
       
       // Process document
       const result = await processor.ingest(
         input.document,
         input.options
       );
       
       // Return result
       return {
         content: [{
           type: "text",
           text: JSON.stringify(result, null, 2)
         }]
       };
     } catch (error) {
       if (error instanceof z.ZodError) {
         return {
           content: [{
             type: "text",
             text: `Validation error: ${formatZodError(error)}`
           }],
           isError: true
         };
       }
       throw error;
     }
   }
   ```

4. **Integrate in call-tool-handler** (`src/server/tools/call-tool-handler.ts`)
   ```typescript
   case "process_document":
     return handleProcessDocument(request, documentProcessor);
   ```

### Tests
- `process-document-handler.test.ts`: Tool handler tests
- `e2e/document-ingestion.test.ts`: End-to-end test

---

## Phase 4: MCP Prompt Creation ⏱️ 2-3 hours

### Goal
Create user-friendly prompt that guides LLMs to generate structured documents.

### Tasks

1. **Add prompt definition** (`src/prompts/handlers.ts`)
   ```typescript
   {
     name: "document",
     description: "Convert raw text or documentation into a structured format " +
                  "optimized for knowledge graph ingestion and semantic search.",
     arguments: [
       {
         name: "text",
         description: "The raw text, documentation, or content to structure",
         required: true
       },
       {
         name: "documentTitle",
         description: "Title for the document",
         required: true
       },
       {
         name: "entityType",
         description: "Primary entity type (component, feature, decision, task, test)",
         required: false
       }
     ]
   }
   ```

2. **Create prompt handler** (`src/prompts/document-prompt.ts`)
   ```typescript
   export function generateDocumentPrompt(args: DocumentPromptArgs): string {
     const jsonSchema = zodToJsonSchema(StructuredDocumentSchema);
     
     return `
   You are a documentation structuring expert. Your task is to convert raw text 
   into a StructuredDocument that follows strict JSON Schema validation.
   
   ## Input Text
   ${args.text}
   
   ## Requirements
   1. Create a valid StructuredDocument matching this JSON Schema:
   ${JSON.stringify(jsonSchema, null, 2)}
   
   2. Token Limits (CRITICAL):
      - Each content block: ≤512 tokens (~2000 characters)
      - Each section: ≤8192 tokens total
      - If content exceeds limits, split into multiple blocks/sections
   
   3. Structure Guidelines:
      - Identify major topics → Create Sections
      - Identify subtopics → Create Subsections (optional)
      - Break content into ≤512 token chunks → Create ContentBlocks
      - Link content with previousId/nextId for reading order
   
   4. Metadata:
      - Set entityType: "${args.entityType || 'component'}"
      - Add semantic tags to each level
      - Provide clear summaries
   
   5. Content Types:
      - Use "text" for narrative
      - Use "code" for code snippets (set language metadata)
      - Use "data" for structured data
      - Use "diagram" for Mermaid/PlantUML
   
   ## Output
   Generate ONLY the JSON object. No markdown, no explanation, just raw JSON.
   `;
   }
   ```

3. **Add to prompt list** (`src/prompts/index.ts`)
   ```typescript
   case "document":
     return {
       messages: [{
         role: "user",
         content: {
           type: "text",
           text: generateDocumentPrompt(args)
         }
       }]
     };
   ```

### Tests
- `document-prompt.test.ts`: Prompt generation tests

---

## Phase 5: Testing & Documentation ⏱️ 4-5 hours

### Goal
Comprehensive testing and user documentation.

### Tasks

1. **Unit Tests**
   - Token counter accuracy
   - Schema validation edge cases
   - Document processor methods
   - Entity/relation creation

2. **Integration Tests**
   - Full document ingestion flow
   - Batch embedding efficiency
   - Error handling and recovery
   - Cross-reference resolution

3. **E2E Tests**
   ```typescript
   describe("Document Ingestion E2E", () => {
     it("should ingest complete documentation", async () => {
       // 1. LLM generates structured doc
       const doc = await llm.generateStructuredDocument(rawText);
       
       // 2. Validate
       const validated = StructuredDocumentSchema.parse(doc);
       
       // 3. Process
       const result = await processor.ingest(validated);
       
       // 4. Verify entities created
       const entity = await kg.getEntity(result.entities[0]);
       expect(entity.observations).toHaveLength(expected);
       
       // 5. Verify embeddings exist
       const searchResults = await kg.semanticSearch(query);
       expect(searchResults).toContain(entity);
     });
   });
   ```

4. **User Documentation**
   - Update main README with document ingestion feature
   - Add examples to docs/
   - Create video/GIF demo
   - Document common validation errors and fixes

5. **Performance Testing**
   - Benchmark batch embedding vs individual calls
   - Test with large documents (100+ sections)
   - Memory usage profiling
   - Token counting performance

---

## Phase 6: Optimization & Advanced Features ⏱️ 3-5 hours (Optional)

### Goal
Enhance performance and add advanced capabilities.

### Tasks

1. **Streaming Support**
   ```typescript
   async *ingestStreaming(doc: StructuredDocument): AsyncGenerator<ProgressEvent> {
     for (const section of doc.sections) {
       yield { type: "section_start", sectionId: section.id };
       await this.processSection(section);
       yield { type: "section_complete", sectionId: section.id };
     }
   }
   ```

2. **Parallel Section Processing**
   ```typescript
   // Process sections in parallel (respect rate limits)
   const results = await pMap(
     doc.sections,
     section => this.processSection(section),
     { concurrency: 3 }
   );
   ```

3. **Smart Subsection Handling**
   ```typescript
   // Decide whether to create separate entities for subsections
   private shouldCreateSubsectionEntity(subsection: Subsection): boolean {
     const blockCount = subsection.content.length;
     const hasComplexMetadata = subsection.metadata.tags.length > 3;
     return blockCount > 5 || hasComplexMetadata;
   }
   ```

4. **Embedding Cache**
   ```typescript
   // Cache embeddings for identical content
   private async getCachedOrGenerateEmbedding(text: string): Promise<number[]> {
     const hash = createHash('sha256').update(text).digest('hex');
     const cached = await this.cache.get(hash);
     if (cached) return cached;
     
     const embedding = await this.embeddingService.generateEmbedding(text);
     await this.cache.set(hash, embedding);
     return embedding;
   }
   ```

5. **Incremental Updates**
   ```typescript
   // Update existing document without reprocessing everything
   async updateDocument(
     documentId: UUID,
     updates: Partial<StructuredDocument>
   ): Promise<UpdateResult> {
     // Detect changes, only reprocess changed sections
   }
   ```

---

## Success Metrics

### Correctness
- ✅ All validation tests pass
- ✅ Zero API failures due to token limits
- ✅ Entities created match document structure
- ✅ Relations correctly represent hierarchy

### Performance
- ⚡ Batch embedding reduces API calls by 80%+
- ⚡ Token validation adds <10ms overhead
- ⚡ Processing 100-section document in <30 seconds

### Usability
- 📖 Clear error messages with field paths
- 📖 Self-correcting LLM workflow
- 📖 Easy manual JSON creation
- 📖 Comprehensive examples

---

## Risk Mitigation

### Risk: Token Counting Performance
**Mitigation**: Lazy validation (only count when needed), cache results

### Risk: Large Documents OOM
**Mitigation**: Stream processing, section-by-section ingestion

### Risk: LLM Generates Invalid Structure
**Mitigation**: Strong error messages → self-correction loop

### Risk: Batch Embedding Failures
**Mitigation**: Retry logic, fall back to individual calls

---

## Timeline Summary

| Phase | Duration | Dependencies |
|-------|----------|--------------|
| Phase 1: Token Counter | 2-3 hours | None |
| Phase 2: Processor Service | 4-6 hours | Phase 1 |
| Phase 3: MCP Tool | 3-4 hours | Phase 2 |
| Phase 4: MCP Prompt | 2-3 hours | Phase 3 |
| Phase 5: Testing | 4-5 hours | Phases 1-4 |
| Phase 6: Optimization | 3-5 hours | Phase 5 (Optional) |

**Total: 18-26 hours** (3-4 days of focused development)

---

## Next Steps

1. Review this roadmap
2. Prioritize phases based on project needs
3. Start with Phase 1 (Token Counter)
4. Iterate with testing after each phase
5. Gather feedback on schema design before Phase 2
