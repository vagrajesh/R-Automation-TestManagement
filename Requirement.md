### 1. Frontend:
- **Multi-Source Ingestion:** Support for ARIS XML/AML, Image files (PNG/JPG), and Markdown/Plain Text.
- **Visual Mapping Review:** A side-by-side view where users see the source diagram and the generated backlog.
- **Refinement UI:** Inline editing of User Stories and Acceptance Criteria.

### 2. Backend: Express.js API
- **File Interceptor:** Middleware (Multer) to handle file uploads and routing to specific parsers.
- **The Processors:**
    - **Vision Processor:** Utilizes VLMs (Vision-Language Models) to interpret flowcharts.
    - **Structured Parser:** Custom logic to navigate ARIS XML hierarchies.

### 3. Backend: Express.js (Node.js)
- **LLM Integration:** Orchestrates calls to preferred LLM for vision and text analysis defined in env file
- **ARIS Parser:** A specialized utility to navigate the hierarchical nature of ARIS Object Types.
- **Export Engine:** Connectors to push data directly to Jira and ServiceNow