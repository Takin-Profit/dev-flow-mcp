# MCP Protocol Compliance Requirements

**Critical Reference Document**

This document defines the CORRECT way to implement MCP tools, prompts, and resources based on the official Model Context Protocol specification.

## Table of Contents

1. [Error Handling](#error-handling)
2. [Tool Response Format](#tool-response-format)
3. [Input/Output Schemas](#inputoutput-schemas)
4. [Content Types](#content-types)
5. [Best Practices](#best-practices)

---

## Error Handling

### The Golden Rule

> **Tool errors should be reported within the result object, not as MCP protocol-level errors.**
>
> This allows the LLM to see and potentially handle the error.

Source: [MCP Documentation - Error Handling](https://modelcontextprotocol.io/docs/concepts/tools#error-handling-2)

### Two Types of Errors

#### 1. Protocol-Level Errors (JSON-RPC)

Use for:
- Unknown tool names
- Invalid JSON
- Missing required fields
- Server crashes

Format:
```json
{
  "jsonrpc": "2.0",
  "id": 3,
  "error": {
    "code": -32602,
    "message": "Unknown tool: invalid_tool_name"
  }
}
```

Standard error codes:
- `-32700`: Parse error (invalid JSON)
- `-32600`: Invalid request (missing jsonrpc, method, id)
- `-32601`: Method not found (unknown method)
- `-32602`: Invalid params (validation failed)
- `-32603`: Internal error (server exception)
- `-32800`: Request cancelled (MCP-specific)
- `-32801`: Content too large (MCP-specific)
- `-32802`: Resource unavailable (MCP-specific)

**TypeScript SDK handles these automatically** - you rarely need to throw them manually.

#### 2. Tool Execution Errors (Application-Level)

Use for:
- Business logic failures
- API failures
- Invalid input data
- Database errors
- External service failures

**Format - THE CORRECT WAY:**
```typescript
return {
  isError: true,  // ← This is the key field!
  content: [{
    type: "text",
    text: "Failed to fetch weather data: API rate limit exceeded"
  }]
}
```

**NOT THIS (our current wrong approach):**
```typescript
// ❌ WRONG - Don't do this
return {
  content: [{
    type: "text",
    text: JSON.stringify({
      success: false,
      error: {
        code: "ERROR_CODE",
        message: "error message"
      }
    })
  }]
}
```

### Error Handling Pattern

From MCP documentation:
```typescript
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  try {
    const result = await executeTool(request.params.name, request.params.arguments);
    return {
      content: [{ type: "text", text: JSON.stringify(result) }]
    };
  } catch (error) {
    console.error("Tool failed:", error);
    return {
      isError: true,
      content: [{
        type: "text",
        text: error instanceof Error ? error.message : "Unknown error"
      }]
    };
  }
});
```

---

## Tool Response Format

### Success Response

```typescript
{
  content: [
    {
      type: "text",
      text: "Current weather in New York:\nTemperature: 72°F\nConditions: Partly cloudy"
    }
  ],
  isError: false  // Optional - false is default
}
```

### Error Response

```typescript
{
  content: [
    {
      type: "text",
      text: "Failed to fetch weather data: API rate limit exceeded"
    }
  ],
  isError: true  // Required for errors
}
```

### Structured Content (Recommended)

For data-heavy tools, provide BOTH text and structured content:

```typescript
{
  content: [
    {
      type: "text",
      text: JSON.stringify({ temperature: 22.5, conditions: "Partly cloudy", humidity: 65 })
    }
  ],
  structuredContent: {
    temperature: 22.5,
    conditions: "Partly cloudy",
    humidity: 65
  }
}
```

**Why both?**
- `content` (text): Backwards compatibility, always required
- `structuredContent`: Enables typed parsing, validation, better tooling

---

## Input/Output Schemas

### Input Schema (Required)

Every tool MUST have an `inputSchema` (JSON Schema):

```typescript
{
  name: "get_weather",
  description: "Get current weather information for a location",
  inputSchema: {
    type: "object",
    properties: {
      location: {
        type: "string",
        description: "City name or zip code"
      }
    },
    required: ["location"]
  }
}
```

### Output Schema (STRONGLY Recommended)

Tools SHOULD provide `outputSchema` for structured responses:

```typescript
{
  name: "get_weather_data",
  description: "Get current weather data for a location",
  inputSchema: {
    type: "object",
    properties: {
      location: {
        type: "string",
        description: "City name or zip code"
      }
    },
    required: ["location"]
  },
  outputSchema: {  // ← Add this!
    type: "object",
    properties: {
      temperature: {
        type: "number",
        description: "Temperature in celsius"
      },
      conditions: {
        type: "string",
        description: "Weather conditions description"
      },
      humidity: {
        type: "number",
        description: "Humidity percentage"
      }
    },
    required: ["temperature", "conditions", "humidity"]
  }
}
```

**Benefits of Output Schemas:**
1. Enable strict schema validation
2. Provide type information for programming languages
3. Guide LLMs to properly parse and use returned data
4. Support better documentation and DX
5. Catch implementation errors early

**Contract:**
- Servers MUST return structured content that conforms to the output schema
- Clients SHOULD validate structured results against the output schema

---

## Content Types

Tools can return multiple content types:

### 1. Text Content (Most Common)

```typescript
{
  type: "text",
  text: "The result text"
}
```

### 2. Image Content

```typescript
{
  type: "image",
  data: "base64-encoded-image-data",
  mimeType: "image/png"
}
```

### 3. Audio Content

```typescript
{
  type: "audio",
  data: "base64-encoded-audio-data",
  mimeType: "audio/wav"
}
```

### 4. Resource Links

Reference resources without embedding full content:

```typescript
{
  type: "resource_link",
  uri: "file:///project/src/main.rs",
  name: "main.rs",
  description: "Primary application entry point",
  mimeType: "text/x-rust"
}
```

**Use case**: Tools that list files or return references to large resources.

### 5. Embedded Resources

Embed full resource content:

```typescript
{
  type: "resource",
  resource: {
    uri: "file:///project/src/main.rs",
    title: "Project Rust Main File",
    mimeType: "text/x-rust",
    text: "fn main() {\n    println!(\"Hello world!\");\n}"
  }
}
```

### Annotations (Optional Metadata)

All content types support annotations:

```typescript
{
  type: "text",
  text: "Important result",
  annotations: {
    audience: ["user"],        // Who should see this: ["user"], ["assistant"], or both
    priority: 0.9,             // 0.0 to 1.0, higher = more important
    lastModified: "2025-05-03T14:30:00Z"  // ISO 8601 timestamp
  }
}
```

---

## Best Practices

### 1. Validate Early

```typescript
// Check inputs before processing
if (!name) {
  return {
    isError: true,
    content: [{ type: "text", text: "Tool name is required" }]
  };
}
```

### 2. Provide Clear Error Messages

```typescript
// ✅ Good - helpful, actionable
"Location 'xyz' not found. Please provide a valid city name or zip code."

// ❌ Bad - vague, unhelpful
"Error occurred"
```

### 3. Don't Leak System Information

```typescript
// ✅ Good - safe for users
"Database connection failed. Please try again later."

// ❌ Bad - exposes internals
"PostgreSQL connection refused at localhost:5432 with user 'admin'"
```

### 4. Log Internally, Return Safely

```typescript
try {
  await operation();
} catch (error) {
  logger.error("Full error details", { error, stack: error.stack });
  return {
    isError: true,
    content: [{ type: "text", text: "Operation failed. Please try again." }]
  };
}
```

### 5. Use Structured Content for Data

```typescript
// ✅ Good - provides both formats
return {
  content: [{
    type: "text",
    text: JSON.stringify(data)
  }],
  structuredContent: data
};

// ❌ Acceptable but less useful
return {
  content: [{
    type: "text",
    text: JSON.stringify(data)
  }]
};
```

### 6. Implement Retry Logic for Transient Failures

```typescript
async function retryWithBackoff(operation, maxAttempts = 3) {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      if (attempt === maxAttempts - 1) throw error;
      const delay = 2 ** attempt + Math.random(); // Exponential backoff with jitter
      await sleep(delay * 1000);
    }
  }
}
```

### 7. Use Circuit Breakers for External Services

```typescript
class CircuitBreaker {
  private failureCount = 0;
  private isOpen = false;

  async call(func) {
    if (this.isOpen) {
      return {
        isError: true,
        content: [{ type: "text", text: "Service temporarily unavailable" }]
      };
    }

    try {
      const result = await func();
      this.failureCount = 0; // Reset on success
      return result;
    } catch (error) {
      this.failureCount++;
      if (this.failureCount >= 3) {
        this.isOpen = true;
      }
      throw error;
    }
  }
}
```

---

## TypeScript SDK Patterns

### Using registerTool (Recommended)

```typescript
import { z } from "zod";

server.registerTool(
  'calculate-bmi',
  {
    title: 'BMI Calculator',
    description: 'Calculate Body Mass Index',
    inputSchema: {
      weightKg: z.number(),
      heightM: z.number()
    },
    outputSchema: {
      bmi: z.number()
    }
  },
  async ({ weightKg, heightM }) => {
    const output = { bmi: weightKg / (heightM * heightM) };
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(output)
      }],
      structuredContent: output
    };
  }
);
```

### Error Handling in Tools

```typescript
server.registerTool(
  'fetch-weather',
  {
    title: 'Weather Fetcher',
    description: 'Get weather data for a city',
    inputSchema: { city: z.string() },
    outputSchema: { temperature: z.number(), conditions: z.string() }
  },
  async ({ city }) => {
    try {
      const response = await fetch(`https://api.weather.com/${city}`);
      if (!response.ok) {
        return {
          isError: true,
          content: [{
            type: 'text',
            text: `Weather API returned ${response.status}: ${response.statusText}`
          }]
        };
      }

      const data = await response.json();
      const output = { temperature: data.temp, conditions: data.conditions };

      return {
        content: [{ type: 'text', text: JSON.stringify(output) }],
        structuredContent: output
      };
    } catch (error) {
      return {
        isError: true,
        content: [{
          type: 'text',
          text: error instanceof Error ? error.message : "Failed to fetch weather"
        }]
      };
    }
  }
);
```

---

## Migration Checklist for DevFlow MCP

### Current Issues

- [ ] Using JSON-encoded success/error objects instead of `isError` flag
- [ ] No output schemas defined for any tools
- [ ] Not providing structured content for data-heavy tools
- [ ] Complex error objects instead of simple error messages
- [ ] Custom `ErrorCode` enum not aligned with MCP approach

### Required Changes

#### 1. Update Response Type

```typescript
// src/types/responses.ts
export const MCPToolResponseSchema = z.object({
  content: z.array(
    z.object({
      type: z.literal("text"),
      text: z.string(),
    }),
  ),
  isError: z.boolean().optional(),  // ← Add this
  structuredContent: z.record(z.unknown()).optional(),  // ← Add this
})
```

#### 2. Simplify Response Builders

```typescript
// src/utils/response-builders.ts

export function buildSuccessResponse<T>(data: T): MCPToolResponse {
  return {
    content: [{
      type: "text",
      text: JSON.stringify(data)
    }],
    structuredContent: data  // For typed access
  }
}

export function buildErrorResponse(message: string): MCPToolResponse {
  return {
    isError: true,
    content: [{
      type: "text",
      text: message
    }]
  }
}
```

#### 3. Add Output Schemas

For every tool input schema, create corresponding output schema:

```typescript
// src/types/validation.ts

export const CreateEntitiesOutputSchema = z.object({
  created: z.number().int().nonnegative(),
  entities: z.array(EntitySchema),
})

export const DeleteEntitiesOutputSchema = z.object({
  deleted: z.number().int().nonnegative(),
  entityNames: z.array(EntityNameSchema),
})

// ... repeat for all 17 tools
```

#### 4. Update Error Classes

Add method to convert to MCP error message:

```typescript
// src/errors/index.ts

export class DFMError extends Error {
  toMCPMessage(): string {
    return `${this.code}: ${this.message}${
      this.details ? ` (${JSON.stringify(this.details)})` : ''
    }`
  }
}
```

#### 5. Simplify Error Handler

```typescript
// src/utils/error-handler.ts

export function handleError(error: unknown, logger?: Logger): MCPToolResponse {
  // Log full error internally
  logger?.error("Tool error", error)

  // Return simple error message
  let message = "Operation failed"

  if (error instanceof DFMError) {
    message = error.toMCPMessage()
  } else if (error instanceof Error) {
    message = error.message
  }

  return buildErrorResponse(message)
}
```

#### 6. Update All Handlers

Every handler should follow this pattern:

```typescript
export async function handleCreateEntities(
  args: unknown,
  manager: KnowledgeGraphManager,
  logger?: Logger,
): Promise<MCPToolResponse> {
  try {
    // 1. Validate input
    const result = CreateEntitiesInputSchema.safeParse(args)
    if (!result.success) {
      return buildErrorResponse(
        `Invalid input: ${fromZodError(result.error).message}`
      )
    }

    // 2. Perform operation
    const entities = await manager.createEntities(result.data.entities)

    // 3. Build response (text + structured)
    const output = {
      created: entities.length,
      entities
    }

    return {
      content: [{ type: "text", text: JSON.stringify(output) }],
      structuredContent: output
    }
  } catch (error) {
    return handleError(error, logger)
  }
}
```

---

## References

- [MCP Specification - Tools](https://modelcontextprotocol.io/docs/concepts/tools)
- [MCP Specification - Error Handling](https://modelcontextprotocol.io/docs/concepts/tools#error-handling-2)
- [GitHub Issue #547 - Error Handling Ambiguity](https://github.com/modelcontextprotocol/modelcontextprotocol/issues/547)
- [MCP TypeScript SDK - Tools Examples](https://github.com/modelcontextprotocol/typescript-sdk)

---

## Summary

**The Three Rules:**

1. **Use `isError: true` for tool failures** - Never encode errors in JSON strings
2. **Provide output schemas** - Help clients validate and understand your data
3. **Keep error messages simple** - Log internally, return safely

**The Pattern:**

```typescript
try {
  const validated = InputSchema.safeParse(args)
  if (!validated.success) {
    return buildErrorResponse("Validation failed: ...")
  }

  const result = await doWork(validated.data)

  return buildSuccessResponse(result)
} catch (error) {
  return handleError(error, logger)
}
```
