# Quick Start Guide

Get started with the StructuredDocument schema in 5 minutes.

## Installation

The schema is already installed and exported from your types:

```typescript
import { 
  StructuredDocumentSchema, 
  type StructuredDocument,
  TOKEN_LIMITS 
} from '#types';
```

## Basic Usage

### 1. Create a Document

```typescript
import { StructuredDocumentSchema } from '#types';

const doc = {
  "@context": "https://schema.org/",
  "@type": "StructuredDocument",
  
  metadata: {
    documentId: crypto.randomUUID(),
    title: "Getting Started",
    version: "1.0.0",
    createdAt: Date.now(),
    language: "en"
  },
  
  sections: [{
    id: crypto.randomUUID(),
    type: "section" as const,
    
    metadata: {
      title: "Introduction",
      summary: "Overview of the system",
      entityType: "component" as const,
      order: 1
    },
    
    content: [{
      id: crypto.randomUUID(),
      parentId: sectionId,
      type: "text" as const,
      content: "Welcome to our system! This guide will help you...",
      metadata: {
        language: "en" as const,
        order: 1
      }
    }]
  }]
};
```

### 2. Validate

```typescript
const result = StructuredDocumentSchema.safeParse(doc);

if (result.success) {
  console.log("✅ Valid document!");
  const validated = result.data;
  // Use validated document
} else {
  console.error("❌ Validation failed:");
  console.error(result.error.issues);
}
```

### 3. Convert to JSON Schema (for LLM)

```typescript
import { zodToJsonSchema } from 'zod-to-json-schema';

const jsonSchema = zodToJsonSchema(StructuredDocumentSchema, {
  name: "StructuredDocument"
});

// Use with OpenAI
const response = await openai.chat.completions.create({
  model: "gpt-4",
  messages: [{
    role: "user",
    content: "Convert this text to structured format: [your text]"
  }],
  response_format: {
    type: "json_schema",
    json_schema: jsonSchema
  }
});

// Use with Gemini
const response = await gemini.generateContent({
  contents: [{ 
    role: "user", 
    parts: [{ text: "Convert this: [your text]" }] 
  }],
  generationConfig: {
    responseMimeType: "application/json",
    responseSchema: jsonSchema
  }
});
```

## Common Patterns

### Pattern 1: Simple Document (No Subsections)

```typescript
const simpleDoc: StructuredDocument = {
  "@context": "https://schema.org/",
  "@type": "StructuredDocument",
  metadata: {
    documentId: crypto.randomUUID(),
    title: "API Documentation",
    createdAt: Date.now(),
    language: "en"
  },
  sections: [{
    id: crypto.randomUUID(),
    type: "section",
    metadata: {
      title: "Authentication",
      summary: "How to authenticate API requests",
      entityType: "component",
      order: 1
    },
    // Direct content (no subsections)
    content: [
      {
        id: crypto.randomUUID(),
        parentId: sectionId,
        type: "text",
        content: "All API requests require authentication...",
        metadata: { language: "en", order: 1 }
      },
      {
        id: crypto.randomUUID(),
        parentId: sectionId,
        previousId: block1Id,
        type: "code",
        content: "curl -H 'Authorization: Bearer TOKEN' ...",
        metadata: { language: "bash", order: 2 }
      }
    ]
  }]
};
```

### Pattern 2: Complex Document (With Subsections)

```typescript
const complexDoc: StructuredDocument = {
  "@context": "https://schema.org/",
  "@type": "StructuredDocument",
  metadata: { /* ... */ },
  sections: [{
    id: sectionId,
    type: "section",
    metadata: {
      title: "User Management",
      summary: "Complete user management system",
      entityType: "feature",
      order: 1
    },
    // Subsections for organization
    subsections: [
      {
        id: subsection1Id,
        parentId: sectionId,
        type: "subsection",
        metadata: {
          title: "User Registration",
          summary: "How users sign up",
          order: 1
        },
        content: [/* blocks */]
      },
      {
        id: subsection2Id,
        parentId: sectionId,
        type: "subsection",
        metadata: {
          title: "User Login",
          summary: "Authentication flow",
          order: 2
        },
        content: [/* blocks */]
      }
    ]
  }]
};
```

### Pattern 3: With Cross-References

```typescript
const docWithRefs: StructuredDocument = {
  "@context": "https://schema.org/",
  "@type": "StructuredDocument",
  metadata: { /* ... */ },
  sections: [
    { id: "section-1", /* ... */ },
    { id: "section-2", /* ... */ }
  ],
  // Link sections together
  crossReferences: [{
    from: "section-2",
    to: "section-1",
    relationType: "depends_on",
    description: "Section 2 depends on concepts from Section 1"
  }]
};
```

## Token Limits Reference

```typescript
import { TOKEN_LIMITS } from '#types';

// Maximum tokens per level
TOKEN_LIMITS.CONTENT_BLOCK    // 512 tokens
TOKEN_LIMITS.SUBSECTION        // 4,096 tokens  
TOKEN_LIMITS.SECTION           // 8,192 tokens

// Character approximations (1 token ≈ 4 chars)
TOKEN_LIMITS.CONTENT_BLOCK_CHARS  // 2,048 characters
TOKEN_LIMITS.SUMMARY_CHARS        // 400 characters
TOKEN_LIMITS.TITLE_CHARS          // 200 characters
```

## Common Validation Errors

### Error: Content Too Long

```
❌ Content exceeds 2048 characters
```

**Fix**: Split into multiple ContentBlocks
```typescript
// ❌ Bad: One huge block
{ content: "..." } // 5000 characters

// ✅ Good: Multiple smaller blocks
{ content: "Part 1..." }, // 1500 chars
{ content: "Part 2..." }, // 1500 chars
{ content: "Part 3..." }  // 1500 chars
```

### Error: Section Must Have Content or Subsections

```
❌ Section must have either 'subsections' OR 'content', not both
```

**Fix**: Choose one structure
```typescript
// ❌ Bad: Both
{
  subsections: [...],
  content: [...]
}

// ✅ Good: Pick one
{
  content: [...] // For simple sections
}

// or

{
  subsections: [...] // For complex sections
}
```

### Error: Invalid Entity Type

```
❌ Invalid enum value. Expected 'feature' | 'task' | 'decision' | 'component' | 'test'
```

**Fix**: Use valid entity types
```typescript
// ❌ Bad
entityType: "module"

// ✅ Good
entityType: "component"
```

## Helper Functions

### Generate UUIDs

```typescript
function generateId(): UUID {
  return crypto.randomUUID();
}
```

### Create Entity Name

```typescript
function toEntityName(title: string): string {
  return title
    .replace(/\s+/g, '_')
    .replace(/[^a-zA-Z0-9_-]/g, '')
    .replace(/^[0-9]/, '_$&'); // Can't start with number
}

toEntityName("User Authentication") // "User_Authentication"
```

### Count Characters

```typescript
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

if (estimateTokens(content) > TOKEN_LIMITS.CONTENT_BLOCK) {
  console.warn("Content might exceed token limit");
}
```

### Build Sequential IDs

```typescript
function linkBlocks(blocks: ContentBlock[]): ContentBlock[] {
  return blocks.map((block, index) => ({
    ...block,
    previousId: index > 0 ? blocks[index - 1].id : null,
    nextId: index < blocks.length - 1 ? blocks[index + 1].id : null
  }));
}
```

## Testing Your Documents

```typescript
import { describe, it, expect } from 'vitest';
import { StructuredDocumentSchema } from '#types';

describe('Document Validation', () => {
  it('should validate a simple document', () => {
    const doc = createSimpleDocument();
    const result = StructuredDocumentSchema.safeParse(doc);
    expect(result.success).toBe(true);
  });

  it('should reject document with oversized content', () => {
    const doc = createDocumentWithHugeBlock();
    const result = StructuredDocumentSchema.safeParse(doc);
    expect(result.success).toBe(false);
    expect(result.error.issues[0].message).toContain('exceeds');
  });
});
```

## Next Steps

1. **Read the full docs**: Start with [Schema Summary](./SCHEMA_SUMMARY.md)
2. **See complete example**: Check [Example Document](./EXAMPLE_DOCUMENT.md)
3. **Understand design**: Read [Design Rationale](./INPUT_SCHEMA_DESIGN.md)
4. **Plan implementation**: Review [Implementation Roadmap](./IMPLEMENTATION_ROADMAP.md)

## Getting Help

- **Schema errors**: Check `src/types/document-input.ts` for field descriptions
- **Validation failures**: Use Zod's error messages to identify the issue
- **Design questions**: Refer to `docs/chunking/INPUT_SCHEMA_DESIGN.md`
- **Implementation**: Follow `docs/chunking/IMPLEMENTATION_ROADMAP.md`
