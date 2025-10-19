# Document Input Schema Design

## Design Goals

1. **Token-Aware Structure**: Enforce maximum token sizes at every level to prevent API limit violations
2. **Hierarchical Linking**: Support arbitrary document depth with explicit parent-child relationships
3. **Chunk Optimization**: Pre-structure content to create semantically pure, optimally-sized chunks
4. **Knowledge Graph Ready**: Map cleanly to Entity/Relation schema with minimal transformation
5. **Flexible Length**: Allow documents of any size through proper segmentation
6. **Validation First**: Use Zod to catch issues before expensive embedding operations

## Core Design Principles

### 1. Hierarchical Block Structure

Documents are composed of nested **blocks** rather than flat chunks. This mirrors how humans structure information:

```
Document
  ├─ Section (e.g., "Authentication System")
  │   ├─ Subsection (e.g., "JWT Implementation")
  │   │   ├─ Content Block (actual text)
  │   │   └─ Content Block (actual text)
  │   └─ Subsection (e.g., "OAuth Integration")
  └─ Section (e.g., "Database Schema")
```

**Benefits**:
- Natural semantic boundaries (sections define topics)
- Easy to link related content (parent-child relationships)
- Chunking logic is simplified (process one section at a time)
- Maps to knowledge graph (sections → entities, hierarchy → relations)

### 2. Token Budget Enforcement

Each structural level has a token budget:

```typescript
MAX_CONTENT_BLOCK_TOKENS = 512   // ~2048 characters (single chunk)
MAX_SUBSECTION_TOKENS = 4096     // ~8 content blocks
MAX_SECTION_TOKENS = 8192        // ~2 subsections (API limit)
```

**Why this matters**:
- Content blocks become individual embeddings (optimal size for retrieval)
- Subsections can be embedded as summaries (mid-level context)
- Sections fit within single API calls for batch embedding
- LLM cannot violate these constraints due to Zod validation

### 3. Explicit Linking via IDs

Every block has a unique ID and knows its relationships:

```typescript
{
  id: "block-uuid-123",
  parentId: "section-uuid-456",
  previousId: "block-uuid-122",  // Sequential reading order
  nextId: "block-uuid-124"
}
```

**Benefits**:
- Reconstruct full context during retrieval (traverse parent chain)
- Maintain reading order (previous/next pointers)
- Create graph relations automatically (parent_of, follows, etc.)
- Enable "semantic neighbors" search (find adjacent content)

### 4. Metadata at Every Level

Rich metadata enables intelligent retrieval:

```typescript
{
  // Descriptive
  title: "User Authentication Flow",
  summary: "Describes JWT token generation and validation",
  
  // Semantic
  tags: ["authentication", "security", "jwt"],
  entityType: "component",
  
  // Structural
  depth: 2,  // How many levels deep in hierarchy
  order: 3,  // Position among siblings
  
  // Technical
  tokenCount: 487,
  language: "en"
}
```

### 5. Multiple Content Types

Support different content modalities within a single document:

- **Text**: Narrative, descriptions, documentation
- **Code**: Source code with language metadata
- **Data**: Structured data (JSON, tables)
- **Diagram**: Mermaid, PlantUML (stored as text, rendered separately)

Each type can have specialized chunking rules.

## Schema Structure

### Top Level: Document

```typescript
{
  "@context": "https://schema.org/",
  "@type": "StructuredDocument",
  
  metadata: {
    documentId: "uuid",
    title: "System Architecture",
    version: "1.0.0",
    createdAt: timestamp,
    author: "user_id"
  },
  
  sections: [Section, Section, ...]
}
```

### Mid Level: Section

A major topical division (maps to Entity in knowledge graph):

```typescript
{
  id: "uuid",
  type: "section",
  
  metadata: {
    title: "Authentication System",
    summary: "JWT-based authentication with OAuth2 fallback",
    entityType: "component",
    tags: ["auth", "security"],
    order: 1,
    estimatedTokens: 3500
  },
  
  subsections: [Subsection, Subsection, ...],
  
  // Optional: Direct content if no subsections
  content: [ContentBlock, ContentBlock, ...]
}
```

### Low Level: Subsection

A focused subtopic (may become Entity or Observation):

```typescript
{
  id: "uuid",
  parentId: "section-uuid",
  type: "subsection",
  
  metadata: {
    title: "JWT Token Generation",
    summary: "Process for creating signed JWT tokens",
    tags: ["jwt", "tokens"],
    order: 1,
    estimatedTokens: 800
  },
  
  content: [ContentBlock, ContentBlock, ...]
}
```

### Atomic Level: ContentBlock

The actual text that gets embedded (becomes Observation):

```typescript
{
  id: "uuid",
  parentId: "subsection-uuid",
  previousId: "previous-block-uuid" | null,
  nextId: "next-block-uuid" | null,
  
  type: "text" | "code" | "data" | "diagram",
  
  // The actual content (max 512 tokens enforced by Zod)
  content: "The JWT generation process begins with...",
  
  metadata: {
    language: "en" | "typescript" | "json" | ...,
    tags: ["implementation", "crypto"],
    tokenCount: 487,
    order: 1
  }
}
```

## Token Counting Strategy

Use `js-tiktoken` for accurate token counting at validation time:

```typescript
const tokenCounter = new Tiktoken(cl100k_base);

const ContentBlockSchema = z.object({
  content: z.string()
    .min(1)
    .refine(
      (text) => {
        const tokens = tokenCounter.encode(text);
        return tokens.length <= 512;
      },
      { message: "Content block exceeds 512 tokens" }
    )
});
```

## Chunking Strategy

Given this input format:

1. **Each ContentBlock = 1 Embedding**
   - Already optimal size (≤512 tokens)
   - Semantically pure (single focused idea)
   - Store with full metadata path

2. **Each Subsection = 1 Summary Embedding** (optional)
   - LLM generates 1-2 sentence summary
   - Useful for high-level semantic search
   - Links to all child ContentBlocks

3. **Each Section = Knowledge Graph Entity**
   - Title becomes entity name
   - Summary becomes first observation
   - All ContentBlocks become additional observations
   - Subsections create `part_of` relations

4. **Batch Process by Section**
   - Gather all ContentBlocks in a Section
   - Send to OpenAI in single batch call
   - Respect 8192 token API limit (enforced by schema)

## Knowledge Graph Mapping

### Entities

```typescript
// Section → Entity
{
  name: "Authentication_System",
  entityType: "component",
  observations: [
    "JWT-based authentication with OAuth2 fallback",  // section summary
    "The JWT generation process begins with...",      // content block 1
    "Token validation checks signature and expiry",   // content block 2
    ...
  ]
}

// Subsection → Entity (if substantial)
{
  name: "JWT_Token_Generation",
  entityType: "component",
  observations: [
    "Process for creating signed JWT tokens",
    "Uses RS256 algorithm for signing",
    ...
  ]
}
```

### Relations

```typescript
// Subsection part of Section
{
  from: "JWT_Token_Generation",
  to: "Authentication_System",
  relationType: "part_of"
}

// Sequential content (reading order)
{
  from: "ContentBlock_123",
  to: "ContentBlock_124",
  relationType: "precedes",  // Custom relation type needed
}

// Cross-references
{
  from: "Authentication_System",
  to: "User_Database",
  relationType: "depends_on"
}
```

## Validation Benefits

By enforcing this schema with Zod:

1. **No API Failures**: Token limits are checked before expensive operations
2. **Type Safety**: TypeScript types derived from schema
3. **Clear Errors**: "ContentBlock at path 'sections[0].content[5]' exceeds 512 tokens"
4. **LLM Guidance**: JSON Schema from Zod tells LLM exact structure
5. **Self-Documenting**: Schema describes valid input completely

## Usage Pattern

### For Users (Natural Language)

User provides unstructured text to LLM:

```
User: "Store this documentation: [pastes 10 pages of docs]"

LLM: [Uses structured output with our JSON Schema]
     - Analyzes text
     - Identifies sections and hierarchy
     - Chunks content into ≤512 token blocks
     - Generates JSON matching StructuredDocument schema
     
System: [Validates with Zod]
        ✅ Pass → Process and embed
        ❌ Fail → Return specific validation errors to LLM
```

### For Developers (Direct Integration)

Developer provides pre-structured JSON:

```typescript
import { StructuredDocumentSchema } from './document-schema';

const doc = {
  "@context": "https://schema.org/",
  "@type": "StructuredDocument",
  metadata: { ... },
  sections: [ ... ]
};

// Validate
const result = StructuredDocumentSchema.safeParse(doc);
if (!result.success) {
  console.error(result.error.issues);
  return;
}

// Process
await documentProcessor.ingest(result.data);
```

## Extension Points

The schema can be extended without breaking existing functionality:

1. **Custom Content Types**: Add `"table"`, `"image"`, `"video"` content types
2. **Additional Metadata**: Add domain-specific fields to metadata objects
3. **Specialized Sections**: Create `"@type": "CodeModule"` with language-specific fields
4. **Validation Rules**: Add custom refinements for domain logic

## Next Steps

1. Implement Zod schema in `src/types/document-input.ts`
2. Create token counter utility in `src/utils/token-counter.ts`
3. Add document processor service in `src/services/document-processor.ts`
4. Create MCP tool `process_document` in `src/server/tools/`
5. Add prompt `/document` that uses the JSON Schema
