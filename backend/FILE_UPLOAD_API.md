# Backend File Upload & Processing API

## Overview

This backend implementation provides a complete file upload and processing system for extracting epics and user stories from multiple source formats:

- **ARIS XML/AML files** - Process modeling exports
- **Image files (PNG/JPG/GIF/WEBP)** - Flowcharts and diagrams  
- **Markdown/Plain Text files** - Structured documentation

## Architecture

### Components

#### 1. **File Upload Routes** (`src/routes/fileUploadRoutes.ts`)
- Multer middleware for multipart/form-data handling
- File type validation and routing
- Batch upload support
- 10MB file size limit

#### 2. **Vision Processor** (`src/lib/visionProcessor.ts`)
- Uses Azure OpenAI GPT-4o vision API
- Interprets flowcharts and process diagrams
- Extracts epics, user stories, and acceptance criteria
- Returns structured JSON

#### 3. **ARIS Parser** (`src/lib/arisParser.ts`)
- Parses ARIS XML/AML exports (ADF, AML formats)
- Navigates hierarchical ARIS object types
- Extracts: Models, Groups, Functions, Events, Roles, Systems
- Maps to epics and user stories

#### 4. **Markdown Parser** (`src/lib/markdownParser.ts`)
- Parses structured markdown documents
- Recognizes user story format: "As a [role], I want to [action] so that [benefit]"
- Extracts acceptance criteria from lists
- Supports plain text fallback

## API Endpoints

### 1. Upload Single File

**Endpoint:** `POST /api/files/upload`

**Request:**
```http
POST /api/files/upload HTTP/1.1
Content-Type: multipart/form-data

file: [binary data]
```

**cURL Example:**
```bash
curl -X POST http://localhost:8080/api/files/upload \
  -F "file=@diagram.png"
```

**Response:**
```json
{
  "success": true,
  "data": {
    "epics": [
      {
        "id": "epic-1",
        "title": "Sales Order Processing",
        "description": "End-to-end sales order management",
        "stories": [
          {
            "id": "story-1",
            "title": "Create Sales Order",
            "description": "As a Sales Rep, I want to create a sales order so that the order is recorded",
            "role": "Sales Rep",
            "action": "create a sales order",
            "benefit": "the order is recorded",
            "acceptanceCriteria": [
              "Order is saved in system",
              "Order number is generated",
              "Customer details are validated"
            ]
          }
        ]
      }
    ],
    "metadata": {
      "processedAt": "2026-02-03T10:30:00.000Z",
      "fileName": "diagram.png",
      "processorType": "vision",
      "modelUsed": "gpt-4o"
    }
  },
  "fileInfo": {
    "name": "diagram.png",
    "size": 245678,
    "type": "image",
    "mimeType": "image/png"
  }
}
```

### 2. Upload Multiple Files (Batch)

**Endpoint:** `POST /api/files/upload-batch`

**Request:**
```http
POST /api/files/upload-batch HTTP/1.1
Content-Type: multipart/form-data

files: [binary data]
files: [binary data]
...
```

**cURL Example:**
```bash
curl -X POST http://localhost:8080/api/files/upload-batch \
  -F "files=@diagram1.png" \
  -F "files=@process.xml" \
  -F "files=@requirements.md"
```

**Response:**
```json
{
  "success": true,
  "processed": 3,
  "failed": 0,
  "results": [
    {
      "fileName": "diagram1.png",
      "fileType": "image",
      "success": true,
      "data": { "epics": [...], "metadata": {...} }
    },
    {
      "fileName": "process.xml",
      "fileType": "xml",
      "success": true,
      "data": { "epics": [...], "metadata": {...} }
    },
    {
      "fileName": "requirements.md",
      "fileType": "markdown",
      "success": true,
      "data": { "epics": [...], "metadata": {...} }
    }
  ],
  "errors": []
}
```

### 3. Get Supported File Types

**Endpoint:** `GET /api/files/supported-types`

**Response:**
```json
{
  "success": true,
  "supportedTypes": {
    "images": {
      "extensions": [".png", ".jpg", ".jpeg", ".gif", ".webp"],
      "mimeTypes": ["image/png", "image/jpeg", "image/gif", "image/webp"],
      "processor": "Vision Processor (GPT-4o)",
      "description": "Process flowcharts and diagrams using Vision-Language Models"
    },
    "xml": {
      "extensions": [".xml", ".aml"],
      "mimeTypes": ["application/xml", "text/xml"],
      "processor": "ARIS Parser",
      "description": "Navigate ARIS XML hierarchies and extract process models"
    },
    "markdown": {
      "extensions": [".md", ".txt"],
      "mimeTypes": ["text/markdown", "text/plain"],
      "processor": "Markdown Parser",
      "description": "Parse structured markdown documents and plain text"
    }
  },
  "limits": {
    "maxFileSize": "10MB",
    "maxBatchFiles": 10
  }
}
```

### 4. Check Processor Status

**Endpoint:** `GET /api/files/processors/status`

**Response:**
```json
{
  "success": true,
  "processors": {
    "visionProcessor": {
      "name": "Vision Processor",
      "status": "ready",
      "backend": "Azure OpenAI GPT-4o"
    },
    "arisParser": {
      "name": "ARIS XML Parser",
      "status": "ready",
      "backend": "fast-xml-parser"
    },
    "markdownParser": {
      "name": "Markdown Parser",
      "status": "ready",
      "backend": "marked"
    }
  }
}
```

## Configuration

### Environment Variables

Required for Vision Processor (Azure OpenAI GPT-4o):

```bash
# Azure OpenAI Configuration
AZURE_OPENAI_API_ENDPOINT=https://your-resource.openai.azure.com/
AZURE_OPENAI_API_KEY=your-api-key
AZURE_OPENAI_DEPLOYMENT_NAME=gpt-4o
AZURE_OPENAI_API_VERSION=2024-02-15-preview

# Or with VITE_ prefix (for frontend compatibility)
VITE_AZURE_OPENAI_API_ENDPOINT=https://your-resource.openai.azure.com/
VITE_AZURE_OPENAI_API_KEY=your-api-key
VITE_AZURE_OPENAI_DEPLOYMENT_NAME=gpt-4o
VITE_AZURE_OPENAI_API_VERSION=2024-02-15-preview
```

**Note:** ARIS Parser and Markdown Parser work without additional configuration.

## File Type Routing

The system automatically routes files to the appropriate processor:

| File Extension | MIME Type | Processor | Backend |
|---------------|-----------|-----------|---------|
| `.png`, `.jpg`, `.jpeg`, `.gif`, `.webp` | `image/*` | Vision Processor | Azure OpenAI GPT-4o |
| `.xml`, `.aml` | `application/xml`, `text/xml` | ARIS Parser | fast-xml-parser |
| `.md`, `.txt` | `text/markdown`, `text/plain` | Markdown Parser | marked |

## Usage Examples

### JavaScript/TypeScript Frontend

```typescript
// Single file upload
async function uploadDiagram(file: File) {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch('http://localhost:8080/api/files/upload', {
    method: 'POST',
    body: formData,
  });

  const result = await response.json();
  console.log('Extracted epics:', result.data.epics);
}

// Batch upload
async function uploadMultipleFiles(files: File[]) {
  const formData = new FormData();
  files.forEach(file => formData.append('files', file));

  const response = await fetch('http://localhost:8080/api/files/upload-batch', {
    method: 'POST',
    body: formData,
  });

  const result = await response.json();
  console.log(`Processed ${result.processed} files`);
  result.results.forEach(r => {
    console.log(`${r.fileName}: ${r.data.epics.length} epics`);
  });
}
```

### React Component Example

```tsx
import React, { useState } from 'react';

function FileUploader() {
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('/api/files/upload', {
        method: 'POST',
        body: formData,
      });
      const data = await response.json();
      setResult(data);
    } catch (error) {
      console.error('Upload failed:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <input type="file" onChange={handleUpload} accept=".png,.jpg,.xml,.md,.txt" />
      {loading && <p>Processing...</p>}
      {result && (
        <div>
          <h3>Extracted {result.data.epics.length} Epics</h3>
          {result.data.epics.map(epic => (
            <div key={epic.id}>
              <h4>{epic.title}</h4>
              <p>{epic.description}</p>
              <ul>
                {epic.stories.map(story => (
                  <li key={story.id}>{story.title}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

## Data Models

### Epic Structure

```typescript
interface Epic {
  id: string;              // Unique identifier (e.g., "epic-1")
  title: string;           // Epic title
  description: string;     // Detailed description
  stories: UserStory[];    // Array of user stories
}
```

### User Story Structure

```typescript
interface UserStory {
  id: string;                    // Unique identifier
  title: string;                 // Story title
  description: string;           // Full story description
  role?: string;                 // User role (e.g., "Sales Rep")
  action?: string;               // What they want to do
  benefit?: string;              // Why they want it
  acceptanceCriteria: string[];  // Array of testable criteria
}
```

### Processing Result

```typescript
interface ProcessingResult {
  epics: Epic[];
  metadata: {
    processedAt: string;      // ISO timestamp
    fileName: string;         // Original filename
    processorType: 'vision' | 'xml' | 'markdown';
    modelUsed?: string;       // For vision: "gpt-4o"
  };
}
```

## ARIS XML Support

### Supported ARIS Formats
- **ADF** (ARIS Design Format)
- **AML** (ARIS Markup Language)

### Extracted Object Types
- **OT_FUNC** - Function
- **OT_EVT** - Event
- **OT_RULE** - Rule
- **OT_PROC_IF** - Process Interface
- **OT_PERS** - Person
- **OT_ORG_UNIT** - Organizational Unit
- **OT_POS** - Position
- **OT_APPL_SYS** - Application System

### ARIS Structure Navigation
The parser navigates:
1. **Models** - Process diagrams (EPC, BPMN)
2. **Groups** - Organizational folders
3. **Objects** - Functions, events, roles, systems
4. **Connections** - Relationships between objects

## Vision Processor Capabilities

### What It Extracts from Diagrams
- Process flows and sequences
- Swim lanes and organizational roles
- Decision points and business rules
- System interactions
- Data flows
- Events and triggers

### Optimal Image Formats
- **PNG** - Best for diagrams (lossless)
- **JPEG** - Good for photos of whiteboards
- **Resolution** - 1024-2048px recommended
- **Max size** - 10MB

### Prompt Engineering
The Vision Processor uses a specialized prompt to:
- Focus on BPMN/EPC diagram conventions
- Extract swim lanes as roles
- Identify decision points as business rules
- Map process steps to user stories
- Generate actionable acceptance criteria

## Markdown Format Examples

### Structured Markdown

```markdown
# Epic: User Authentication

Secure user login and session management

## User Story: Login with Email

As a User, I want to log in with my email and password so that I can access my account

### Acceptance Criteria
- Email validation is performed
- Password is checked against stored hash
- Session token is generated on success
- Failed attempts are logged

## User Story: Password Reset

As a User, I want to reset my password so that I can regain access if I forget it

### Acceptance Criteria
- Reset email is sent to registered email
- Reset link expires after 24 hours
- New password must meet complexity requirements
```

### Plain Text with User Stories

```
As a Sales Manager, I want to view sales reports so that I can track team performance
As a Customer, I want to track my order so that I know when it will arrive
As an Admin, I want to manage user permissions so that I can control access
```

## Error Handling

### File Validation Errors

```json
{
  "success": false,
  "error": "Unsupported file type: application/pdf. Allowed types: .png, .jpg, .xml, .md, .txt"
}
```

### Processing Errors

```json
{
  "success": false,
  "error": "Failed to process image: Azure OpenAI credentials not configured"
}
```

### Batch Upload Errors

```json
{
  "success": true,
  "processed": 2,
  "failed": 1,
  "results": [...],
  "errors": [
    {
      "fileName": "invalid.pdf",
      "error": "Unsupported file type"
    }
  ]
}
```

## Testing

### Unit Testing (Example)

```typescript
import { visionProcessor } from '../lib/visionProcessor';
import fs from 'fs';

describe('Vision Processor', () => {
  it('should extract epics from flowchart', async () => {
    const imageBuffer = fs.readFileSync('./test/fixtures/flowchart.png');
    const result = await visionProcessor.processImage(imageBuffer, 'flowchart.png');
    
    expect(result.epics).toBeDefined();
    expect(result.epics.length).toBeGreaterThan(0);
    expect(result.metadata.processorType).toBe('vision');
  });
});
```

### Manual Testing

```bash
# Test single image upload
curl -X POST http://localhost:8080/api/files/upload \
  -F "file=@test-diagram.png"

# Test ARIS XML upload
curl -X POST http://localhost:8080/api/files/upload \
  -F "file=@process-model.xml"

# Test markdown upload
curl -X POST http://localhost:8080/api/files/upload \
  -F "file=@user-stories.md"

# Check processor status
curl http://localhost:8080/api/files/processors/status
```

## Performance Considerations

### File Size Limits
- Maximum single file: **10MB**
- Maximum batch files: **10 files**
- Recommended image size: **1024-2048px**

### Processing Time
- **Images (Vision)**: 5-15 seconds (depends on Azure OpenAI API)
- **XML (ARIS)**: < 1 second (local parsing)
- **Markdown**: < 1 second (local parsing)

### Rate Limiting
- Vision Processor is subject to Azure OpenAI rate limits
- Consider implementing queuing for large batches
- ARIS and Markdown parsers have no rate limits

## Security

### File Upload Security
- File type validation by extension and MIME type
- 10MB size limit to prevent DoS
- Memory storage (no persistent disk writes)
- No executable file types allowed

### API Security
- CORS configured via `CORS_ORIGIN` env variable
- Session-based authentication (inherited from server)
- No file persistence (processed in memory only)

## Next Steps

### Frontend Integration
1. Create file upload UI component ([FileIngestion.tsx](frontend/src/components/FileIngestion.tsx))
2. Build visual mapping review component ([VisualMapping.tsx](frontend/src/components/VisualMapping.tsx))
3. Add inline editing for epics/stories
4. Integrate with existing LLM settings

### Export Engine
1. Extend Jira integration to create issues from epics/stories
2. Add Azure DevOps integration
3. Implement batch work item creation
4. Add mapping/transformation layer

### Enhanced Processing
1. Add image preprocessing (resize, enhance)
2. Implement diagram segmentation for large images
3. Add LLM-based enhancement for markdown parsing
4. DeepEval quality scoring for generated stories

## Dependencies

```json
{
  "dependencies": {
    "multer": "^1.4.5-lts.1",
    "fast-xml-parser": "^4.5.0",
    "marked": "^15.0.6",
    "axios": "^1.6.2"
  },
  "devDependencies": {
    "@types/multer": "^1.4.12",
    "@types/marked": "^6.0.0"
  }
}
```

## License

ISC

---

**Implementation Status:** ✅ Complete

All backend components are implemented, tested, and ready for frontend integration.
