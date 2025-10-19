# Document Chunking & Structured Input

**Status**: ✅ Schema Implemented (Processing Implementation Pending)

Comprehensive documentation for ingesting large documents into the DevFlow MCP knowledge graph using a token-aware, hierarchical input schema.

## Overview

Instead of post-hoc chunking of raw text, DevFlow MCP uses a **pre-structured JSON-LD format** that:
- ✅ Enforces token limits via Zod validation (prevents API failures)
- ✅ Provides optimal chunk sizes (≤512 tokens per content block)
- ✅ Preserves semantic structure (hierarchical sections)
- ✅ Enables context reconstruction (parent-child relationships)
- ✅ Maps cleanly to knowledge graph (sections → entities, content → observations)

## Quick Start

```typescript
import { StructuredDocumentSchema, type StructuredDocument } from '#types';

// Create a structured document
const doc: StructuredDocument = {
  "@context": "https://schema.org/",
  "@type": "StructuredDocument",
  metadata: {
    documentId: crypto.randomUUID(),
    title: "My Documentation",
    version: "1.0.0",
    createdAt: Date.now(),
    language: "en"
  },
  sections: [{
    id: crypto.randomUUID(),
    type: "section",
    metadata: {
      title: "Introduction",
      summary: "Overview of the system",
      entityType: "component",
      order: 1
    },
    content: [{
      id: crypto.randomUUID(),
      parentId: sectionId,
      type: "text",
      content: "This system provides...",
      metadata: {
        language: "en",
        order: 1
      }
    }]
  }]
};

// Validate
const result = StructuredDocumentSchema.safeParse(doc);
if (!result.success) {
  console.error(result.error.issues);
}
```

## Core Documents

### 📋 [Schema Summary](./SCHEMA_SUMMARY.md)
Quick reference for the entire schema design, usage patterns, and benefits.

### 📐 [Design Rationale](./INPUT_SCHEMA_DESIGN.md)
Deep dive into design decisions, token budgets, hierarchical structure, and knowledge graph mapping.

### 📝 [Complete Example](./EXAMPLE_DOCUMENT.md)
Full working example of an authentication system documentation showing all schema features.

## Schema Structure

```
StructuredDocument (JSON-LD)
├─ metadata: DocumentMetadata
├─ sections: Section[]
│   ├─ metadata: SectionMetadata
│   ├─ subsections?: Subsection[]
│   │   ├─ metadata: SubsectionMetadata
│   │   └─ content: ContentBlock[]
│   │       ├─ id, parentId, previousId, nextId
│   │       ├─ type: "text" | "code" | "data" | "diagram"
│   │       ├─ content: string (≤512 tokens)
│   │       └─ metadata: ContentBlockMetadata
│   └─ content?: ContentBlock[] (if no subsections)
└─ crossReferences?: CrossReference[]
```

## Token Limits (Enforced by Zod)

| Element | Max Tokens | Max Characters | Maps To |
|---------|------------|----------------|---------|
| ContentBlock | 512 | 2,048 | Single embedding |
| Subsection | 4,096 | ~16,000 | Batch processing unit |
| Section | 8,192 | ~32,000 | Knowledge graph Entity |

## Knowledge Graph Mapping

```typescript
// Input: Section
{
  id: "uuid-123",
  metadata: {
    title: "Authentication System",
    summary: "JWT-based authentication",
    entityType: "component"
  },
  content: [
    { content: "The system uses JWT tokens..." },
    { content: "Token validation checks..." }
  ]
}

// Output: Entity
{
  name: "Authentication_System",
  entityType: "component",
  observations: [
    "JWT-based authentication",           // summary
    "The system uses JWT tokens...",      // content[0]
    "Token validation checks..."          // content[1]
  ]
}

// Output: Embeddings (batch generated)
[
  { embedding: [...], observation: "JWT-based authentication" },
  { embedding: [...], observation: "The system uses JWT tokens..." },
  { embedding: [...], observation: "Token validation checks..." }
]
```

## Implementation Status

### ✅ Completed
- [x] Zod schema definition (`src/types/document-input.ts`)
- [x] TypeScript type exports (`src/types/index.ts`)
- [x] Design documentation
- [x] Example document
- [x] Schema summary

### 🚧 Pending
- [ ] Token counting utility with `js-tiktoken`
- [ ] Document processor service
- [ ] MCP tool `process_document`
- [ ] MCP prompt `/document`
- [ ] Integration tests
- [ ] Batch embedding optimization

## Usage Patterns

### Pattern 1: LLM Generates Structure
```typescript
// User provides raw text
const rawText = userInput;

// LLM converts using structured output
const doc = await llm.generateContent({
  responseSchema: zodToJsonSchema(StructuredDocumentSchema),
  prompt: `Convert this to structured format: ${rawText}`
});

// Validate and process
const validated = StructuredDocumentSchema.parse(doc);
await documentProcessor.ingest(validated);
```

### Pattern 2: Direct JSON Input
```typescript
// Developer provides pre-structured JSON
const doc = loadDocumentFromFile('./docs/api.json');

// Validate
const result = StructuredDocumentSchema.safeParse(doc);

// Process
if (result.success) {
  await documentProcessor.ingest(result.data);
}
```

### Pattern 3: Programmatic Generation
```typescript
// Generate from codebase analysis
const sections = analyzeCodebase('./src');

const doc: StructuredDocument = {
  "@context": "https://schema.org/",
  "@type": "StructuredDocument",
  metadata: buildMetadata(),
  sections: sections.map(toSection)
};

await documentProcessor.ingest(doc);
```

## Benefits Over Traditional Chunking

| Traditional Approach | This Schema |
|---------------------|-------------|
| Post-hoc splitting of raw text | Pre-structured by LLM |
| Arbitrary chunk boundaries | Semantic boundaries defined |
| Token counting during processing | Token limits enforced by validation |
| Unpredictable chunk quality | Guaranteed optimal size |
| Lost context at boundaries | Full hierarchical context |
| Complex splitting algorithms | Simple: already chunked |
| API failures possible | Validated before API call |

## Next Steps

To complete the implementation:

1. **Add Token Counting**: Integrate `js-tiktoken` into Zod refinement
2. **Create Processor**: Service to convert StructuredDocument → KnowledgeGraph
3. **Add MCP Tool**: Tool for ingesting documents
4. **Create Prompt**: Prompt template with JSON Schema for LLM
5. **Write Tests**: Validation, processing, and integration tests

## Related Files

### Source Code
- `src/types/document-input.ts` - Complete Zod schema
- `src/types/validation.ts` - Knowledge graph schemas
- `src/types/index.ts` - Type exports

### Documentation
- `docs/chunking/SCHEMA_SUMMARY.md` - Quick reference
- `docs/chunking/INPUT_SCHEMA_DESIGN.md` - Design rationale
- `docs/chunking/EXAMPLE_DOCUMENT.md` - Working example

### Archive
- `docs/chunking/implementation-plan.md` - Old approach (archived)
- `docs/chunking/integration-points.md` - Old approach (archived)
