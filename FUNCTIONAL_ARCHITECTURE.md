# Functional Architecture - R-Automation Test Management System

## System Overview

The R-Automation Test Management System is a comprehensive platform designed to automate test case generation, requirement analysis, and quality assurance workflows using LLM-powered intelligence and evaluation metrics via DeepEval.

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Frontend (React + TypeScript)                 │
│                          (Port 3002)                                 │
├─────────────────────────────────────────────────────────────────────┤
│ 
     • Epic Story Extraction     
   • Requirement Analysis         • Test Case Generator
                                  • Feature File Generator 
                                  • Test Plan Management                │
│  • LLM Settings                             │
│      • Integration Settings                  │
└──────────────────┬──────────────────────────────┬────────────────────┘
                   │                              │
                   ▼                              ▼
        ┌──────────────────┐        ┌──────────────────┐
        │  Backend API     │        │  DeepEval Server │
        │  (Node.js)       │        │  (Python)        │
        │  (Port 3000)     │◄──────►│  (Port 3001)     │
        └──────────────────┘        └──────────────────┘
                   │                              │
        ┌──────────┼──────────────┐               │
        │          │              │               │
        ▼          ▼              ▼               ▼
    ┌────────┐ ┌────────┐ ┌────────────┐ ┌──────────────┐
    │  Jira  │ │ServiceNow│ │ File      │ │  DeepEval    │
    │        │ │         │ │ Upload    │ │  Evaluation  │
    │ Client │ │ Client  │ │ Processing│ │  Engine      │
    └────────┘ └────────┘ └────────────┘ └──────────────┘
```

---

## Core Components

### 1. Frontend Application
**Technology:** React 18 + TypeScript + Vite + Tailwind CSS

#### Key Modules:
- **EpicStoryExtraction**: Breaks down epics into user stories and test cases
- **RequirementAnalysis**: Analyzes business requirements and extracts test scenarios
- **TestCasesGenerator**: Generates test cases from requirements using LLM and run thorgh DeepEval Metrics
- **TestPlan**: Organize and manage test plans
- **Integration**: with ServiceNow and Jira realtime
- **FeatureFileGenerator**: Creates Gherkin/BDD feature files
- **LLMSettings**: Configure and manage LLM provider connections

#### Configuration:
```typescript
// src/config/integrationConfig.ts
- Multiple LLM provider support (OpenAI, Azure, Groq, Claude)
- Integration with Jira and ServiceNow
- Backend API communication
```

---

### 2. Backend API Server
**Technology:** Node.js + TypeScript + Express

#### Port: 3000

#### Key Routes:
```
/api/
  ├── /upload          - File upload and processing
  ├── /config          - System configuration
  ├── /jira           - Jira integration endpoints
  ├── /servicenow      - ServiceNow integration endpoints
  ├── /eval           - DeepEval evaluation endpoints
  └── /test-cases     - Test case management
```

#### Core Services:
- **connectionManager.ts**: Manages Jira/ServiceNow connections
- **fileUploadRoutes.ts**: Handles file uploads and parsing
- **exportEngine.ts**: Exports test cases in various formats
- **arisParser.ts**: Parses ARIS files
- **markdownParser.ts**: Converts requirements to markdown
- **visionProcessor.ts**: Processes images and documents

---

### 3. DeepEval Integration Service
**Technology:** Python + DeepEval Framework

#### Port: 3001

#### Purpose:
Provides AI evaluation metrics for test quality assessment, requirement validation, and test coverage analysis.

#### Key Modules:
```
deepeval-demo/
├── src/
│   ├── routes/
│   │   ├── evalRoutes.ts       - Evaluation endpoints
│   │   └── testCaseRoutes.ts   - Test case routes
│   ├── services/
│   │   ├── evalClient.ts       - DeepEval client
│   │   ├── llmClient.ts        - LLM communication
│   │   ├── ragService.ts       - RAG service
│   │   └── testCaseEvalService.ts - Test case evaluation
│   └── config/
│       └── env.ts              - Environment config
└── deepeval_server.py          - Python evaluation engine
```

---

## DeepEval Metrics & Evaluation Framework

### Supported LLM Providers for Evaluation:
1. **Groq** (Default) - Fast inference
2. **OpenAI** - GPT-4 models
3. **Azure OpenAI** - Enterprise deployment

### Key Evaluation Metrics

#### 1. **Requirement Validation Metrics**
- **Clarity Score**: Measures how clearly requirements are written
- **Completeness Score**: Evaluates if requirements cover all aspects
- **Ambiguity Detection**: Identifies vague or ambiguous requirements
- **Feasibility Score**: Assesses requirement feasibility

#### 2. **Test Case Quality Metrics**
• **Faithfulness**: This metric will ensure that the generated test cases are factually consistent with the source requirements and do not contradict the business logic provided in the input markdown or ARIS files.
• **Answer Relevance**: While the system currently tracks a "Relevance Score," this specific DeepEval metric would more precisely measure how directly the test steps address the specific requirements extracted by the EpicStoryExtraction module.
• **Hallucination**: This is critical for the LLM-powered generation flow to identify scenarios where the system creates test steps or conditions that were never present in the original documentation.
• **PII Leakage**: To align with the Security Architecture and Sensitive Data Handling protocols, this metric will scan generated test cases to ensure no Personally Identifiable Information is accidentally exposed during the LLM inference process.
• **Completeness**: While the architecture currently lists "Requirement Completeness" and "Scenario Completeness," adding this specifically to test case generation ensures that every user story and acceptance criterion identified has at least one corresponding test case

#### 3. **Feature File Quality Metrics**
- **Gherkin Syntax Validation**: Ensures proper BDD syntax
- **Scenario Completeness**: Validates Given/When/Then structure
- **Business Readability**: Measures stakeholder understandability
- **Automation Readiness**: Assesses automation feasibility

#### 4. **Story Quality Metrics**
- **Acceptance Criteria Completeness**: Validates AC coverage
- **Story Point Estimation**: Evaluates story complexity
- **INVEST Principle Compliance**: Independent, Negotiable, Valuable, Estimable, Small, Testable

#### 5. **Document Quality Metrics**
- **Readability Score**: Flesch-Kincaid grade level
- **Structure Validation**: Document organization assessment
- **Consistency Check**: Terminology and format consistency

---

## Data Flow Architecture

### Test Case Generation Flow:
```
1. User Input (Requirement/Epic)
   │
   ▼
2. LLM Processing (Backend)
   │
   ├── Requirement Analysis
   ├── Test Case Generation
   └── Feature File Creation
   │
   ▼
3. DeepEval Validation
   │
   ├── Faithfulness
   ├── Hallucination
   ├── Answer Relevance
   ├── PII Leakage
   └── Completeness
   │
   ▼
4. Results Presentation (Frontend)
   │
   ├── Generated Test Cases
   ├── Quality Scores
   ├── Recommendations
   └── Export Options
```

### Evaluation Pipeline:
```
Input Artifact (Requirement/Test Case)
   │
   ▼
DeepEval Engine
   │
   ├── Parse Content
   ├── Apply Metrics
   ├── LLM Evaluation
   └── Score Generation
   │
   ▼
Metrics Output
   │
   ├── Scores (0-1 scale)
   ├── Reasoning
   ├── Recommendations
   └── Improvement Suggestions
```

---

## Integration Connectors

### Jira Integration
- **Endpoint**: `VITE_JIRA_API_ENDPOINT`
- **Authentication**: API Key-based
- **Capabilities**:
  - Fetch epics and stories
  - Create test case issues
  - Update issue descriptions
  - Link test cases to requirements

### ServiceNow Integration
- **Endpoint**: `VITE_SERVICENOW_API_ENDPOINT`
- **Authentication**: Username/Password
- **Capabilities**:
  - Retrieve requirements from change requests
  - Create test records
  - Link test cases to requirements
  - Update test status

---

## LLM Provider Configuration

### Available Providers:

#### Azure OpenAI (Primary)
```
Endpoint: https://r-automations.openai.azure.com
Deployment: gpt-4.1
API Version: 2025-01-01-preview
```

#### Groq (Fallback)
```
Model: llama-3.3-70b-versatile
Endpoint: https://api.groq.com/openai/v1
```

#### OpenAI
```
Model: gpt-4-turbo
Endpoint: https://api.openai.com/v1
```

#### Claude (Anthropic)
```
Model: claude-3-opus-20240229
Endpoint: https://api.anthropic.com
```

---

## File Processing Pipeline

### Supported Formats:
1. **ARIS Files** (.aris) → Parsed via arisParser.ts
2. **Markdown** (.md) → Parsed via markdownParser.ts
3. **Documents** (PDF, Word) → Processed via visionProcessor.ts
4. **Images** → Vision processing for document extraction

### Processing Steps:
```
1. File Upload
   │
   ▼
2. Format Detection
   │
   ├── ARIS → arisParser
   ├── Markdown → markdownParser
   └── Images/Documents → visionProcessor
   │
   ▼
3. Content Extraction
   │
   ├── Requirements identification
   ├── Scenario extraction
   └── Test data collection
   │
   ▼
4. LLM Enhancement
   │
   ├── Requirement clarification
   ├── Test case generation
   └── Feature file creation
   │
   ▼
5. DeepEval Validation
   │
   └── Quality metrics calculation
```

---

## Environment Configuration

### Backend (.env)
```
NODE_ENV=development
PORT=3000
CORS_ORIGIN=http://localhost:3002
SESSION_SECRET=<generated-secret>
DEFAULT_LLM_PROVIDER=azure-openai
DEFAULT_INTEGRATION=servicenow
```

### DeepEval (.env)
```
PORT=3001
LLM_PROVIDER=azure-openai
AZURE_OPENAI_API_KEY=<key>
AZURE_OPENAI_API_ENDPOINT=<endpoint>
```

### Frontend (.env)
```
VITE_API_BASE_URL=http://localhost:3000
VITE_DEFAULT_LLM_PROVIDER=azure-openai
VITE_DEFAULT_INTEGRATION=servicenow
```

---

## Deployment Architecture

### Development Stack:
```
Local Development
├── Frontend: Vite Dev Server (Port 3002)
├── Backend: Node.js (Port 3000)
└── DeepEval: Python (Port 3001)
```

### Production Considerations:
- **Frontend**: Azure Static Web Apps or CDN
- **Backend**: Azure App Service or Container Apps
- **DeepEval**: Azure Container Apps or AKS
- **Database**: Azure SQL Database or CosmosDB
- **Storage**: Azure Blob Storage for file uploads
- **Cache**: Azure Redis Cache
- **Secrets**: Azure Key Vault

---

## Security Architecture

### Authentication & Authorization:
- Session-based authentication (backend)
- API key validation for external integrations
- Environment variable-based credential management
- CORS protection for frontend-backend communication

### Sensitive Data Handling:
- API keys stored in environment variables
- `.env` files excluded from version control
- Credentials rotated regularly
- Audit logging for API access

---

## Monitoring & Metrics

### Key Metrics to Track:
1. **API Response Time**: Backend endpoint performance
2. **Evaluation Latency**: DeepEval processing time
3. **Test Case Quality Scores**: Average metric values
4. **LLM API Usage**: Token consumption and costs
5. **Error Rates**: Failed operations and retries
6. **Integration Success Rate**: Jira/ServiceNow connectivity

---

## Error Handling & Resilience

### Retry Mechanisms:
- Failed LLM calls with exponential backoff
- Integration retry logic for Jira/ServiceNow
- DeepEval fallback strategies

### Graceful Degradation:
- LLM provider fallback chain
- Cached results for failed evaluations
- Partial result delivery when components unavailable

---

## Future Enhancements

1. **Advanced Metrics**:
   - Machine learning-based quality prediction
   - Historical trend analysis
   - Benchmark comparison

2. **Additional Integrations**:
   - Azure DevOps
   - TestRail
   - Xray for Jira

3. **Scalability**:
   - Distributed evaluation engine
   - Multi-region deployment
   - Async processing for large documents

4. **Analytics Dashboard**:
   - Quality trends
   - LLM provider performance comparison
   - ROI metrics for test automation

---

## Component Dependencies

```
Frontend
├── react-dom
├── axios (API calls)
├── tailwindcss (styling)
└── typescript

Backend
├── express
├── axios
├── dotenv
└── typescript

DeepEval
├── deepeval
├── fastapi
├── python-dotenv
└── pydantic
```

---

**Last Updated:** February 6, 2026
