# Document Input Schema - Summary

## Overview

The `StructuredDocument` schema is a **hierarchical, token-aware, JSON-LD format** optimized for ingesting large documents into a knowledge graph with semantic embeddings. It solves the fundamental challenges of document chunking while maintaining strict validation.

## Core Design Decisions

### 1. Four-Level Hierarchy

```
Document                    (Container)
  └─ Section               (Entity)
      └─ Subsection        (Sub-entity or Observation)
          └─ ContentBlock  (Observation/Embedding)
```

**Why this structure?**
- **Document**: Provides document-level metadata and organization
- **Section**: Maps to Knowledge Graph Entity (major topics)
- **Subsection**: Provides mid-level organization (optional entity)
- **ContentBlock**: Atomic unit that becomes a single embedding

### 2. Token Budget Enforcement

| Level | Max Tokens | Max Characters | Purpose |
|-------|------------|----------------|---------|
| ContentBlock | 512 | 2,048 | Optimal embedding size |
| Subsection | 4,096 | ~16,000 | Convenient batch unit |
| Section | 8,192 | ~32,000 | OpenAI API limit |

**Enforcement**: Zod validation fails if limits exceeded
**Benefit**: Zero API failures due to token limits

### 3. Explicit Linking

Every element has:
- **Unique ID** (UUID v4)
- **Parent ID** (hierarchical relationships)
- **Previous/Next IDs** (sequential reading order)

**Benefit**: Full context reconstruction during retrieval

### 4. Rich Metadata

Every level includes:
- **Semantic**: Tags, entity types, summaries
- **Structural**: Order, depth, token counts
- **Contextual**: Language, author, source

**Benefit**: Intelligent filtering and retrieval

### 5. Multiple Content Types

- `text`: Natural language
- `code`: Source code with language tag
- `data`: Structured data (JSON, CSV)
- `diagram`: Textual diagrams (Mermaid, PlantUML)

**Benefit**: Specialized processing per type

## Key Advantages

### ✅ Prevents API Failures
Token limits are validated **before** expensive embedding operations. Impossible to violate OpenAI's 8,192 token limit.

### ✅ Optimal for Retrieval
Each ContentBlock (≤512 tokens) is the ideal size for semantic embeddings based on research.

### ✅ Preserves Context
Hierarchical IDs + metadata enable full context reconstruction:
```typescript
// Retrieve content block
const block = getContentBlock(id);

// Reconstruct full context path
const path = [
  getDocument(block.documentId),
  getSection(block.sectionId),
  getSubsection(block.subsectionId),
  block
];

// Generate context-aware prompt
const context = path.map(el => el.metadata.title).join(" > ");
```

### ✅ Scales Infinitely
No document size limit - split into multiple sections with cross-references.

### ✅ Type-Safe End-to-End
```typescript
import { StructuredDocumentSchema, type StructuredDocument } from './document-input';

// Parse and validate
const result = StructuredDocumentSchema.safeParse(userInput);

// TypeScript knows exact structure
if (result.success) {
  const doc: StructuredDocument = result.data;
  doc.sections[0].metadata.title; // ✅ Type-safe
}
```

### ✅ LLM-Friendly
Convert Zod schema to JSON Schema for LLM structured output:
```typescript
import { zodToJsonSchema } from 'zod-to-json-schema';

const jsonSchema = zodToJsonSchema(StructuredDocumentSchema);

// Use with Gemini/OpenAI structured output
const response = await llm.generateContent({
  responseSchema: jsonSchema,
  prompt: "Convert this document to structured format: ..."
});
```

### ✅ Knowledge Graph Ready
Direct mapping to existing schema:
- Section → Entity
- ContentBlock → Observation
- CrossReference → Relation
- Hierarchy → "part_of" relations

## Usage Patterns

### Pattern 1: User Provides Unstructured Text

```typescript
// User pastes raw documentation
const rawText = "... 50 pages of docs ...";

// LLM converts to structured format
const doc = await llm.generateStructuredDocument(rawText);

// Validate
const result = StructuredDocumentSchema.safeParse(doc);
if (!result.success) {
  // Show validation errors to LLM for self-correction
  return result.error;
}

// Process
await documentProcessor.ingest(result.data);
```

### Pattern 2: Developer Provides Pre-Structured JSON

```typescript
import { StructuredDocumentSchema } from './document-input';

const doc = {
  "@context": "https://schema.org/",
  "@type": "StructuredDocument",
  metadata: { /* ... */ },
  sections: [ /* ... */ ]
};

// Validate and process
const validated = StructuredDocumentSchema.parse(doc);
await documentProcessor.ingest(validated);
```

### Pattern 3: Automated Documentation Generation

```typescript
// Extract from codebase
const codeFiles = await getProjectFiles();

// Generate structured doc
const doc: StructuredDocument = {
  "@context": "https://schema.org/",
  "@type": "StructuredDocument",
  metadata: {
    documentId: generateUUID(),
    title: "Project Codebase Documentation",
    // ...
  },
  sections: codeFiles.map(file => ({
    id: generateUUID(),
    type: "section",
    metadata: {
      title: file.name,
      summary: file.summary,
      entityType: "component",
      // ...
    },
    content: file.functions.map(fn => ({
      id: generateUUID(),
      type: "code",
      content: fn.code,
      // ...
    }))
  }))
};
```

## Processing Strategy

### Step 1: Validation
```typescript
const result = StructuredDocumentSchema.safeParse(input);
if (!result.success) {
  throw new ValidationError(result.error.issues);
}
```

### Step 2: Section-Level Processing
```typescript
for (const section of doc.sections) {
  // Gather all content blocks in this section
  const blocks = getAllContentBlocks(section);
  
  // Extract text for embedding
  const texts = blocks.map(b => b.content);
  
  // Batch embed (single API call per section)
  const embeddings = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: texts // Array of ≤8192 tokens total
  });
  
  // Create entity
  const entity = {
    name: toEntityName(section.metadata.title),
    entityType: section.metadata.entityType,
    observations: [
      section.metadata.summary,
      ...texts
    ]
  };
  
  // Store with embeddings
  await knowledgeGraph.createEntity(entity, embeddings);
}
```

### Step 3: Relation Creation
```typescript
// Hierarchical relations
for (const section of doc.sections) {
  if (section.subsections) {
    for (const subsection of section.subsections) {
      await knowledgeGraph.createRelation({
        from: toEntityName(subsection.metadata.title),
        to: toEntityName(section.metadata.title),
        relationType: "part_of"
      });
    }
  }
}

// Cross-references
for (const ref of doc.crossReferences ?? []) {
  await knowledgeGraph.createRelation({
    from: lookupEntityByBlockId(ref.from),
    to: lookupEntityByBlockId(ref.to),
    relationType: ref.relationType
  });
}
```

## Migration from Old Chunking Docs

The old `docs/chunking/` documents proposed using `llm-splitter` and `js-tiktoken` for rules-based chunking. This new schema **replaces** that approach with:

| Old Approach | New Approach |
|--------------|--------------|
| Post-hoc chunking after receiving text | Pre-structured input from LLM |
| Rules-based splitting (paragraph breaks) | Semantic structure defined upfront |
| Token counting during chunking | Token limits enforced by validation |
| Complex splitting logic | Simple: each ContentBlock is already optimal |
| Unpredictable chunk quality | Guaranteed semantic purity |

**Migration Path**: The old docs should be archived or rewritten to explain how to integrate token counting into the Zod schema validation.

## Common Validation Errors

### Error: Content Block Too Large
```
Content block at sections[0].content[3] exceeds 2048 characters
```
**Solution**: LLM should split the content into multiple blocks

### Error: Section Must Have Content or Subsections
```
Section at sections[1] must have either 'subsections' OR 'content', not both
```
**Solution**: Choose one structure - subsections for complex, content for simple

### Error: Invalid Entity Type
```
sections[0].metadata.entityType: Invalid enum value. Expected 'feature' | 'task' | 'decision' | 'component' | 'test'
```
**Solution**: Use valid EntityType from knowledge graph schema

## Extension Points

The schema can be extended without breaking changes:

### Custom Content Types
```typescript
export const ExtendedContentTypeSchema = ContentTypeSchema.or(
  z.enum(["audio", "video", "image"])
);
```

### Domain-Specific Metadata
```typescript
export const EngineeringDocumentSchema = StructuredDocumentSchema.extend({
  metadata: DocumentMetadataSchema.extend({
    repository: z.string().url(),
    branch: z.string(),
    commit: z.string()
  })
});
```

### Additional Relations
```typescript
export const ExtendedRelationTypeSchema = z.enum([
  ...RelationTypeSchema.options,
  "precedes",
  "contradicts",
  "updates"
]);
```

## Next Steps

1. **Implement Token Counting**: Add `js-tiktoken` integration to Zod refinement
2. **Create Document Processor**: Service that converts StructuredDocument → KnowledgeGraph
3. **Add MCP Tool**: `process_document` tool for ingesting documents
4. **Create Prompt**: `/document` prompt with JSON Schema for LLM guidance
5. **Write Tests**: Validation tests, processing tests, integration tests

## Files

- **Schema**: `src/types/document-input.ts`
- **Design Doc**: `docs/chunking/INPUT_SCHEMA_DESIGN.md`
- **Example**: `docs/chunking/EXAMPLE_DOCUMENT.md`
- **This Summary**: `docs/chunking/SCHEMA_SUMMARY.md`
