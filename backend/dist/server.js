import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import session from 'express-session';
import axios from 'axios';
import { connectionManager } from './services/connectionManager.js';
import fileUploadRoutes from './routes/fileUploadRoutes.js';
const app = express();
const PORT = parseInt(process.env.PORT || '8080', 10);
const CORS_ORIGIN = process.env.CORS_ORIGIN;
const SESSION_SECRET = process.env.SESSION_SECRET;
const NODE_ENV = process.env.NODE_ENV || 'development';
// Validate required environment variables at startup
function validateEnvironment() {
    const required = ['CORS_ORIGIN', 'SESSION_SECRET'];
    const missing = required.filter(key => !process.env[key]);
    if (missing.length > 0) {
        console.error(`❌ Missing required environment variables: ${missing.join(', ')}`);
        console.error('Please set these in your .env file');
        process.exit(1);
    }
}
validateEnvironment();
// CORS configuration with strict options
const corsOptions = {
    origin: CORS_ORIGIN?.split(',').map(o => o.trim()),
    credentials: true,
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Accept'],
    optionsSuccessStatus: 200,
};
app.use(cors(corsOptions));
app.use(bodyParser.json());
app.use(session({
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    name: 'sessionId',
    cookie: {
        secure: NODE_ENV === 'production',
        httpOnly: true,
        sameSite: NODE_ENV === 'production' ? 'strict' : 'lax',
        maxAge: 1000 * 60 * 60 * 24, // 24 hours
    },
}));
// Middleware to auto-populate session from env-initialized connections
app.use((req, _res, next) => {
    if (req.session && !(req.session.jira) && connectionManager.isJiraConnected()) {
        const jiraConn = connectionManager.getJiraConnection();
        if (jiraConn) {
            req.session.jira = jiraConn;
        }
    }
    if (req.session && !(req.session.servicenow) && connectionManager.isServiceNowConnected()) {
        const snConn = connectionManager.getServiceNowConnection();
        if (snConn) {
            req.session.servicenow = snConn;
        }
    }
    next();
});
// Register file upload routes
app.use('/api/files', fileUploadRoutes);
// Health check endpoint with connection status
app.get('/api/health', (_req, res) => {
    const connections = connectionManager.getState();
    res.json({
        status: 'ok',
        message: 'Backend is running',
        connections: {
            jira: {
                isConnected: connections.jira.isConnected,
                error: connections.jira.error,
            },
            servicenow: {
                isConnected: connections.servicenow.isConnected,
                error: connections.servicenow.error,
            },
            llmProviders: Object.keys(connections.llmProviders),
        },
    });
});
/**
 * GET /api/config
 * Returns default LLM provider and integrations configuration from backend
 * This is the single source of truth for configuration
 */
app.get('/api/config', (_req, res) => {
    const connections = connectionManager.getState();
    res.json({
        llm: {
            defaultProvider: process.env.VITE_DEFAULT_LLM_PROVIDER || process.env.DEFAULT_LLM_PROVIDER || 'groq',
            defaultModel: process.env.VITE_DEFAULT_LLM_MODEL || process.env.DEFAULT_LLM_MODEL || 'openai/gpt-4o',
            configuredProviders: Object.keys(connections.llmProviders),
        },
        integrations: {
            defaultIntegration: process.env.DEFAULT_INTEGRATION || 'jira',
            jiraConfigured: connections.jira.isConnected,
            serviceNowConfigured: connections.servicenow.isConnected,
        },
    });
});
/**
 * POST /api/jira/connect
 * Stores Jira credentials in session and validates connection
 */
app.post('/api/jira/connect', async (req, res) => {
    try {
        const { baseUrl, email, apiToken } = req.body;
        if (!baseUrl || !email || !apiToken) {
            return res.status(400).json({ error: 'Missing required fields: baseUrl, email, apiToken' });
        }
        // Test connection to Jira
        const testUrl = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
        const credentials = btoa(`${email}:${apiToken}`);
        const response = await axios.get(`${testUrl}rest/api/3/myself`, {
            headers: {
                Authorization: `Basic ${credentials}`,
                Accept: 'application/json',
            },
        });
        // Store in session
        if (req.session) {
            req.session.jira = { baseUrl, email, apiToken };
        }
        return res.json({
            success: true,
            message: `Connected to Jira as ${response.data.displayName || email}`,
            user: response.data.displayName || email,
        });
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return res.status(401).json({ error: `Jira connection failed: ${errorMessage}` });
    }
});
/**
 * GET /api/jira/stories
 * Fetch user stories from Jira using session-stored credentials
 */
app.get('/api/jira/stories', async (req, res) => {
    try {
        let jiraSession = req.session.jira;
        // Fallback to connectionManager if session is empty (e.g., new user/session)
        if (!jiraSession && connectionManager.isJiraConnected()) {
            jiraSession = connectionManager.getJiraConnection();
            console.log('[Jira Stories] Using auto-initialized credentials from connectionManager');
        }
        if (!jiraSession) {
            return res.status(401).json({ error: 'Not connected to Jira. Call /api/jira/connect first.' });
        }
        const { baseUrl, email, apiToken } = jiraSession;
        const searchQuery = req.query.q || 'type=Story';
        const testUrl = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
        const credentials = btoa(`${email}:${apiToken}`);
        const response = await axios.get(`${testUrl}rest/api/3/search?jql=${encodeURIComponent(searchQuery)}&maxResults=50`, {
            headers: {
                Authorization: `Basic ${credentials}`,
                Accept: 'application/json',
            },
        });
        const stories = (response.data.issues || []).map((issue) => ({
            id: issue.key,
            key: issue.key,
            title: issue.fields.summary,
            description: extractDescription(issue.fields.description),
            acceptanceCriteria: issue.fields.customfield_10000 ? extractDescription(issue.fields.customfield_10000) : undefined,
            status: issue.fields.status?.name || 'Unknown',
            priority: issue.fields.priority?.name || 'Medium',
            assignee: issue.fields.assignee?.displayName,
            source: 'jira',
        }));
        return res.json({ stories });
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return res.status(500).json({ error: `Failed to fetch Jira stories: ${errorMessage}` });
    }
});
/**
 * POST /api/servicenow/connect
 * Stores ServiceNow credentials in session and validates connection to rm_story table
 * Body: { instanceUrl, username, password }
 */
app.post('/api/servicenow/connect', async (req, res) => {
    try {
        const { instanceUrl, username, password } = req.body;
        console.log('[ServiceNow Connect] Request received:', { instanceUrl, username });
        if (!instanceUrl || !username || !password) {
            console.log('[ServiceNow Connect] Missing fields:', { instanceUrl: !!instanceUrl, username: !!username, password: !!password });
            return res.status(400).json({ error: 'Missing required fields: instanceUrl, username, password' });
        }
        // Validate URL format
        try {
            new URL(instanceUrl);
        }
        catch (urlError) {
            console.log('[ServiceNow Connect] Invalid URL format:', instanceUrl);
            return res.status(400).json({ error: 'Invalid instanceUrl format' });
        }
        // Test connection to ServiceNow
        const testUrl = instanceUrl.endsWith('/') ? instanceUrl : `${instanceUrl}/`;
        const credentials = btoa(`${username}:${password}`);
        console.log('[ServiceNow Connect] Testing connection to:', `${testUrl}api/now/table/sys_user`);
        const response = await axios.get(`${testUrl}api/now/table/sys_user?sysparm_limit=1`, {
            headers: {
                Authorization: `Basic ${credentials}`,
                Accept: 'application/json',
            },
            timeout: 15000, // 15 second timeout for production
        });
        // Validate response structure
        if (!response.data || !Array.isArray(response.data.result)) {
            console.log('[ServiceNow Connect] Invalid response format:', typeof response.data);
            return res.status(500).json({ error: 'Invalid ServiceNow response format' });
        }
        // Store in session
        if (req.session) {
            req.session.servicenow = { instanceUrl, username, password };
        }
        console.log('[ServiceNow Connect] Successfully connected');
        return res.json({
            success: true,
            message: 'Connected to ServiceNow successfully',
            recordCount: response.data.result?.length || 0,
        });
    }
    catch (error) {
        console.error('[ServiceNow Connect] Error:', error);
        if (error instanceof axios.AxiosError) {
            if (error.response?.status === 401) {
                return res.status(401).json({ error: 'ServiceNow authentication failed. Check username and password.' });
            }
            if (error.code === 'ECONNABORTED') {
                return res.status(504).json({ error: 'ServiceNow connection timeout. Check instanceUrl.' });
            }
            if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
                return res.status(400).json({ error: 'Cannot reach ServiceNow instance. Check instanceUrl.' });
            }
            const errorMessage = error.response?.data?.error?.message || error.message;
            return res.status(error.response?.status || 500).json({ error: `ServiceNow error: ${errorMessage}` });
        }
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return res.status(500).json({ error: `Connection failed: ${errorMessage}` });
    }
});
/**
 * GET /api/servicenow/stories
 * Fetch user stories from ServiceNow rm_story table using session-stored credentials
 * Query param: q (optional ServiceNow query syntax)
 */
app.get('/api/servicenow/stories', async (req, res) => {
    try {
        let snowSession = req.session.servicenow;
        // Fallback to connectionManager if session is empty (e.g., new user/session)
        if (!snowSession && connectionManager.isServiceNowConnected()) {
            snowSession = connectionManager.getServiceNowConnection();
            console.log('[ServiceNow Stories] Using auto-initialized credentials from connectionManager');
        }
        if (!snowSession) {
            return res.status(401).json({ error: 'Not connected to ServiceNow. Call /api/servicenow/connect first.' });
        }
        const { instanceUrl, username, password } = snowSession;
        const queryParam = req.query.q || 'state!=7^ORDERBYDESCsys_created_on'; // Exclude closed stories, order by created date
        const testUrl = instanceUrl.endsWith('/') ? instanceUrl : `${instanceUrl}/`;
        const credentials = btoa(`${username}:${password}`);
        const response = await axios.get(`${testUrl}api/now/table/rm_story?sysparm_limit=50&sysparm_query=${encodeURIComponent(queryParam)}&sysparm_fields=sys_id,number,short_description,description,state,priority,acceptance_criteria,epic`, {
            headers: {
                Authorization: `Basic ${credentials}`,
                Accept: 'application/json',
            },
            timeout: 15000, // 15 second timeout for production
        });
        // Validate response structure
        if (!response.data || !Array.isArray(response.data.result)) {
            return res.status(500).json({ error: 'Invalid ServiceNow response format' });
        }
        const statusMap = {
            '1': 'New',
            '2': 'In Progress',
            '3': 'On Hold',
            '4': 'Resolved',
            '5': 'Closed',
            '6': 'Cancelled',
            '7': 'Closed',
        };
        const priorityMap = {
            '1': 'Critical',
            '2': 'High',
            '3': 'Medium',
            '4': 'Low',
            '5': 'Planning',
        };
        const stories = await Promise.all(response.data.result.map(async (story) => {
            console.log('ServiceNow Story Fields:', Object.keys(story));
            let epicNumber = undefined;
            let epicTitle = undefined;
            // If story has an epic, fetch epic details
            if (story.epic && story.epic.value) {
                try {
                    const epicResponse = await axios.get(`${testUrl}api/now/table/rm_epic?sysparm_limit=1&sysparm_query=sys_id=${story.epic.value}&sysparm_fields=number,short_description`, {
                        headers: {
                            Authorization: `Basic ${credentials}`,
                            Accept: 'application/json',
                        },
                        timeout: 5000,
                    });
                    if (epicResponse.data.result && epicResponse.data.result.length > 0) {
                        const epic = epicResponse.data.result[0];
                        epicNumber = epic.number;
                        epicTitle = epic.short_description;
                    }
                }
                catch (epicError) {
                    console.log('Failed to fetch epic details:', epicError);
                }
            }
            return {
                id: story.sys_id,
                key: story.number,
                title: story.short_description || 'Untitled',
                description: story.description || '',
                acceptanceCriteria: story.acceptance_criteria || undefined,
                status: statusMap[story.state] || 'Unknown',
                priority: priorityMap[story.priority] || 'Medium',
                assignee: story.assigned_to?.display_value || undefined,
                epicKey: epicNumber,
                epicTitle: epicTitle,
                source: 'servicenow',
            };
        }));
        return res.json({ stories });
    }
    catch (error) {
        if (error instanceof axios.AxiosError) {
            if (error.response?.status === 401) {
                return res.status(401).json({ error: 'ServiceNow authentication failed. Invalid credentials.' });
            }
            if (error.code === 'ECONNABORTED') {
                return res.status(504).json({ error: 'ServiceNow request timeout. Service may be slow.' });
            }
            const errorMessage = error.response?.data?.error?.message || error.message;
            return res.status(error.response?.status || 500).json({ error: `ServiceNow error: ${errorMessage}` });
        }
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return res.status(500).json({ error: `Failed to fetch ServiceNow stories: ${errorMessage}` });
    }
});
/**
 * Helper function to split and format assertions
 */
function splitAndFormatAssertions(assertionText) {
    if (!assertionText)
        return [];
    // Split by common assertion delimiters: semicolon, "and", period
    const assertions = assertionText
        .split(/[;]|(?:\s+and\s+)|(?:\s*\.\s*)/)
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
    return assertions.map((assertion) => {
        // Add action verb if missing
        const actionVerbs = ['Verify', 'Check', 'Validate', 'Ensure', 'Confirm', 'Assert', 'Should'];
        const startsWithVerb = actionVerbs.some(verb => assertion.toLowerCase().startsWith(verb.toLowerCase()));
        if (!startsWithVerb) {
            // Determine appropriate verb based on assertion content
            if (assertion.toLowerCase().includes('disabled') || assertion.toLowerCase().includes('hidden') || assertion.toLowerCase().includes('not ')) {
                return `Verify ${assertion}`;
            }
            else if (assertion.toLowerCase().includes('show') || assertion.toLowerCase().includes('display') || assertion.toLowerCase().includes('appear')) {
                return `Verify ${assertion}`;
            }
            else if (assertion.toLowerCase().includes('error') || assertion.toLowerCase().includes('message')) {
                return `Check ${assertion}`;
            }
            else {
                return `Verify ${assertion}`;
            }
        }
        return assertion;
    });
}
/**
 * POST /api/test-cases/generate
 * Generate test cases from story using LLM
 */
app.post('/api/test-cases/generate', async (req, res) => {
    try {
        const { story, numTestCases, provider, model } = req.body;
        if (!story || !numTestCases) {
            return res.status(400).json({ error: 'story and numTestCases are required' });
        }
        const prompt = `You are a QA test case generation expert. Generate ${numTestCases} comprehensive test cases based on the following user story:

STORY ID: ${story.key}
TITLE: ${story.title}
DESCRIPTION: ${story.description}
${story.acceptanceCriteria ? `ACCEPTANCE CRITERIA:\n${story.acceptanceCriteria}` : ''}
STATUS: ${story.status}
PRIORITY: ${story.priority}
SOURCE: ${story.source.toUpperCase()}

IMPORTANT: Return ONLY valid JSON with NO markdown formatting, NO code blocks, NO \`\`\` markers. Just raw JSON.

Generate test cases in the following FLAT JSON format (NO NESTED OBJECTS):

{
  "test_cases": [
    {
      "name": "Test Case Name",
      "short_description": "Detailed description of Test Case",
      "description": "Detailed description of Test Case",
      "test_type": "Positive",
      "priority": "High",
      "state": "draft",
      "version": "1.0",
      "steps": [
        {
          "order": 100,
          "step": "Step description",
          "expected_result": "Expected outcome",
          "test_data": "Test data if applicable"
        }
      ]
    }
  ]
}

Requirements:
- Each test case MUST have: name, short_description, description, test_type, priority, state, version, steps
- short_description and description MUST start with an action verb (Verify, Check, Validate, Test, Ensure, Confirm, etc.)
- Examples: "Verify user can login with valid credentials", "Check that error message displays", "Validate page loads successfully"
- NO nested testData or versionData objects - use flat properties only
- Include steps array with ordered steps (order field: 100, 200, 300, etc.)
- Each step must have: order, step, expected_result, and test_data fields
- Priority values: "Critical", "High", "Medium", "Low"
- test_type values: "Positive", "Negative", "End to End", "Edge Cases"
- Return valid JSON object with a "test_cases" array containing exactly ${numTestCases} test cases
- DO NOT wrap the JSON in markdown code blocks (no \`\`\`json)
- DO NOT add any text before or after the JSON
- Return ONLY the JSON object`;
        let url = '';
        let headers = { 'Content-Type': 'application/json' };
        if (provider === 'azure-openai') {
            const endpoint = process.env.VITE_AZURE_OPENAI_API_ENDPOINT;
            const apiKey = process.env.VITE_AZURE_OPENAI_API_KEY;
            const deploymentName = process.env.VITE_AZURE_OPENAI_DEPLOYMENT_NAME || model;
            const apiVersion = process.env.VITE_AZURE_OPENAI_API_VERSION || '2024-02-15-preview';
            if (!endpoint || !apiKey) {
                return res.status(500).json({ error: 'Azure OpenAI not configured' });
            }
            const baseUrl = endpoint.endsWith('/') ? endpoint : `${endpoint}/`;
            url = `${baseUrl}openai/deployments/${deploymentName}/chat/completions?api-version=${apiVersion}`;
            headers['api-key'] = apiKey;
        }
        else if (provider === 'openai') {
            const apiKey = process.env.VITE_OPENAI_API_KEY;
            if (!apiKey) {
                return res.status(500).json({ error: 'OpenAI not configured' });
            }
            url = 'https://api.openai.com/v1/chat/completions';
            headers['Authorization'] = `Bearer ${apiKey}`;
        }
        else if (provider === 'groq') {
            const apiKey = process.env.VITE_GROQ_API_KEY;
            if (!apiKey) {
                return res.status(500).json({ error: 'Groq not configured' });
            }
            url = 'https://api.groq.com/openai/v1/chat/completions';
            headers['Authorization'] = `Bearer ${apiKey}`;
        }
        else {
            return res.status(400).json({ error: `Provider ${provider} not supported` });
        }
        const response = await axios.post(url, {
            model,
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.7,
            max_tokens: Math.min(8000, numTestCases * 600),
        }, { headers, timeout: 60000 });
        const content = response.data.choices[0]?.message?.content;
        if (!content) {
            return res.status(500).json({ error: 'Empty response from LLM' });
        }
        const cleanText = content.replace(/^```[\w]*\n/m, '').replace(/\n```\s*$/m, '').trim();
        const parsed = JSON.parse(cleanText);
        if (!parsed.test_cases || !Array.isArray(parsed.test_cases)) {
            return res.status(500).json({ error: 'Invalid response format from LLM' });
        }
        return res.json({ testCases: parsed.test_cases });
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return res.status(500).json({ error: `Test case generation failed: ${errorMessage}` });
    }
});
/**
 * POST /api/test-cases/evaluate
 * Evaluate test cases quality using DeepEval service
 * Proxies to deepeval-demo service
 */
app.post('/api/test-cases/evaluate', async (req, res) => {
    try {
        const { testCases, userStory, metrics } = req.body;
        // Validation
        if (!testCases || !Array.isArray(testCases) || testCases.length === 0) {
            return res.status(400).json({
                error: 'testCases is required and must be a non-empty array'
            });
        }
        if (!userStory || !userStory.title || !userStory.description) {
            return res.status(400).json({
                error: 'userStory is required with title and description'
            });
        }
        const deepevalUrl = process.env.DEEPEVAL_SERVICE_URL || 'http://localhost:3001';
        console.log(`[Test Case Evaluate] Sending ${testCases.length} test cases to DeepEval`);
        const response = await axios.post(`${deepevalUrl}/api/test-cases/evaluate`, { testCases, userStory, metrics }, {
            headers: { 'Content-Type': 'application/json' },
            timeout: 120000 // 2 minutes timeout for evaluation
        });
        console.log(`[Test Case Evaluate] Received evaluation results`);
        return res.json(response.data);
    }
    catch (error) {
        if (axios.isAxiosError(error)) {
            if (error.code === 'ECONNREFUSED') {
                return res.status(503).json({
                    error: 'DeepEval service unavailable. Please ensure deepeval-demo is running on port 3001.'
                });
            }
            const errorDetail = error.response?.data?.error || error.message;
            return res.status(error.response?.status || 500).json({
                error: `DeepEval error: ${errorDetail}`
            });
        }
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return res.status(500).json({ error: `Test case evaluation failed: ${errorMessage}` });
    }
});
/**
 * POST /api/test-cases/generate-with-eval
 * Generate test cases AND evaluate their quality in one call
 * Combines /api/test-cases/generate and /api/test-cases/evaluate
 */
app.post('/api/test-cases/generate-with-eval', async (req, res) => {
    try {
        const { story, numTestCases, provider, model } = req.body;
        if (!story || !numTestCases) {
            return res.status(400).json({ error: 'story and numTestCases are required' });
        }
        console.log(`[Generate+Eval] Starting generation of ${numTestCases} test cases with quality evaluation`);
        // Step 1: Generate test cases (same logic as /api/test-cases/generate)
        const prompt = `You are a QA test case generation expert. Generate ${numTestCases} comprehensive test cases based on the following user story:

STORY ID: ${story.key}
TITLE: ${story.title}
DESCRIPTION: ${story.description}
${story.acceptanceCriteria ? `ACCEPTANCE CRITERIA:\n${story.acceptanceCriteria}` : ''}
STATUS: ${story.status}
PRIORITY: ${story.priority}
SOURCE: ${story.source.toUpperCase()}

IMPORTANT: Return ONLY valid JSON with NO markdown formatting, NO code blocks, NO \`\`\` markers. Just raw JSON.

Generate test cases in the following FLAT JSON format (NO NESTED OBJECTS):

{
  "test_cases": [
    {
      "name": "Test Case Name",
      "short_description": "Detailed description of Test Case",
      "description": "Detailed description of Test Case",
      "test_type": "Positive",
      "priority": "High",
      "state": "draft",
      "version": "1.0",
      "steps": [
        {
          "order": 100,
          "step": "Step description",
          "expected_result": "Expected outcome",
          "test_data": "Test data if applicable"
        }
      ]
    }
  ]
}

Requirements:
- Each test case MUST have: name, short_description, description, test_type, priority, state, version, steps
- short_description and description MUST start with an action verb (Verify, Check, Validate, Test, Ensure, Confirm, etc.)
- Include steps array with ordered steps (order field: 100, 200, 300, etc.)
- Each step must have: order, step, expected_result, and test_data fields
- Priority values: "Critical", "High", "Medium", "Low"
- test_type values: "Positive", "Negative", "End to End", "Edge Cases"
- Return valid JSON object with a "test_cases" array containing exactly ${numTestCases} test cases
- DO NOT wrap the JSON in markdown code blocks
- Return ONLY the JSON object`;
        let url = '';
        let headers = { 'Content-Type': 'application/json' };
        if (provider === 'azure-openai') {
            const endpoint = process.env.VITE_AZURE_OPENAI_API_ENDPOINT;
            const apiKey = process.env.VITE_AZURE_OPENAI_API_KEY;
            const deploymentName = process.env.VITE_AZURE_OPENAI_DEPLOYMENT_NAME || model;
            const apiVersion = process.env.VITE_AZURE_OPENAI_API_VERSION || '2024-02-15-preview';
            if (!endpoint || !apiKey) {
                return res.status(500).json({ error: 'Azure OpenAI not configured' });
            }
            const baseUrl = endpoint.endsWith('/') ? endpoint : `${endpoint}/`;
            url = `${baseUrl}openai/deployments/${deploymentName}/chat/completions?api-version=${apiVersion}`;
            headers['api-key'] = apiKey;
        }
        else if (provider === 'openai') {
            const apiKey = process.env.VITE_OPENAI_API_KEY;
            if (!apiKey) {
                return res.status(500).json({ error: 'OpenAI not configured' });
            }
            url = 'https://api.openai.com/v1/chat/completions';
            headers['Authorization'] = `Bearer ${apiKey}`;
        }
        else if (provider === 'groq') {
            const apiKey = process.env.VITE_GROQ_API_KEY;
            if (!apiKey) {
                return res.status(500).json({ error: 'Groq not configured' });
            }
            url = 'https://api.groq.com/openai/v1/chat/completions';
            headers['Authorization'] = `Bearer ${apiKey}`;
        }
        else {
            return res.status(400).json({ error: `Provider ${provider} not supported` });
        }
        console.log(`[Generate+Eval] Calling LLM to generate test cases...`);
        const llmResponse = await axios.post(url, {
            model,
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.7,
            max_tokens: Math.min(8000, numTestCases * 600),
        }, { headers, timeout: 60000 });
        const content = llmResponse.data.choices[0]?.message?.content;
        if (!content) {
            return res.status(500).json({ error: 'Empty response from LLM' });
        }
        const cleanText = content.replace(/^```[\w]*\n/m, '').replace(/\n```\s*$/m, '').trim();
        const parsed = JSON.parse(cleanText);
        if (!parsed.test_cases || !Array.isArray(parsed.test_cases)) {
            return res.status(500).json({ error: 'Invalid response format from LLM' });
        }
        console.log(`[Generate+Eval] Generated ${parsed.test_cases.length} test cases, now evaluating quality...`);
        // Step 2: Prepare test cases for evaluation (add IDs)
        const testCasesForEval = parsed.test_cases.map((tc, index) => ({
            id: `TC-${index + 1}`,
            name: tc.name,
            description: tc.description || tc.short_description,
            steps: tc.steps?.map((s) => ({
                step: s.step,
                expected_result: s.expected_result,
                test_data: s.test_data
            })) || []
        }));
        // Step 3: Call DeepEval service for quality evaluation
        const deepevalUrl = process.env.DEEPEVAL_SERVICE_URL || 'http://localhost:3001';
        let qualitySummary = null;
        let evaluations = [];
        try {
            const evalResponse = await axios.post(`${deepevalUrl}/api/test-cases/evaluate`, {
                testCases: testCasesForEval,
                userStory: {
                    title: story.title,
                    description: story.description,
                    acceptanceCriteria: story.acceptanceCriteria
                },
                metrics: ['faithfulness', 'relevancy', 'hallucination', 'completeness', 'pii_leakage'],
                provider: provider
            }, {
                headers: { 'Content-Type': 'application/json' },
                timeout: 300000
            });
            evaluations = evalResponse.data.evaluations || [];
            qualitySummary = evalResponse.data.summary;
            console.log(`[Generate+Eval] Quality evaluation complete. Average score: ${qualitySummary?.averageScore}`);
        }
        catch (evalError) {
            console.warn(`[Generate+Eval] Quality evaluation failed, returning test cases without scores:`, evalError);
            // Continue without quality scores if evaluation fails
        }
        // Step 4: Merge quality scores into test cases
        const testCasesWithQuality = parsed.test_cases.map((tc, index) => {
            const evaluation = evaluations.find((e) => e.testCaseId === `TC-${index + 1}`);
            return {
                ...tc,
                id: `TC-${index + 1}`,
                quality: evaluation ? {
                    overallScore: evaluation.overallScore,
                    qualityLevel: evaluation.qualityLevel,
                    metrics: evaluation.metrics,
                    suggestions: evaluation.suggestions
                } : undefined
            };
        });
        console.log(`[Generate+Eval] Returning ${testCasesWithQuality.length} test cases with quality scores`);
        return res.json({
            testCases: testCasesWithQuality,
            qualitySummary: qualitySummary || {
                averageScore: null,
                highQualityCount: 0,
                mediumQualityCount: 0,
                lowQualityCount: 0,
                evaluationSkipped: true
            }
        });
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error(`[Generate+Eval] Error:`, errorMessage);
        return res.status(500).json({ error: `Test case generation with evaluation failed: ${errorMessage}` });
    }
});
/**
 * POST /api/test-cases/generate-servicenow
 * Generate ServiceNow AI test cases with nested format
 */
app.post('/api/test-cases/generate-servicenow', async (req, res) => {
    try {
        const { story, numTestCases, provider, model } = req.body;
        if (!story || !numTestCases) {
            return res.status(400).json({ error: 'story and numTestCases are required' });
        }
        const prompt = `You are a ServiceNow QA test case generation expert. Generate ${numTestCases} comprehensive test cases based on the following user story:

STORY ID: ${story.key}
TITLE: ${story.title}
DESCRIPTION: ${story.description}
${story.acceptanceCriteria ? `ACCEPTANCE CRITERIA:\n${story.acceptanceCriteria}` : ''}
STATUS: ${story.status}
PRIORITY: ${story.priority}
SOURCE: ${story.source.toUpperCase()}

IMPORTANT: Return ONLY valid JSON with NO markdown formatting, NO code blocks, NO \`\`\` markers. Just raw JSON.

Generate test cases in the following NESTED JSON format:

{
  "test_cases": [
    {
      "testData": {
        "name": "Test Case Name",
        "short_description": "Detailed description of Test Case",
        "description": "description of Test Case",
        "test_type": "functional",
        "priority": "High",
        "state": "draft"
      },
      "versionData": {
        "version": "1.0",
        "state": "draft",
        "short_description": "Same as testData short_description",
        "description": "Version description",
        "priority": "High"
      },
      "stepsData": [
        {
          "order": 100,
          "step": "Step description",
          "expected_result": "Expected outcome",
          "test_data": "Test data if applicable",
          "description": "Step description details"
        }
      ]
    }
  ]
}

Requirements:
- Each test case MUST have: testData, versionData, stepsData
- short_description MUST start with an action verb (Verify, Check, Validate, Test, Ensure, Confirm, etc.)
- test_type values: "functional", "integration", "regression", "smoke"
- Priority values: "Critical", "High", "Medium", "Low"
- stepsData array with ordered steps (order field: 100, 200, 300, etc.)
- Each step must have: order, step, expected_result, test_data, description
- Return valid JSON object with a "test_cases" array containing exactly ${numTestCases} test cases
- DO NOT wrap the JSON in markdown code blocks
- Return ONLY the JSON object`;
        let url = '';
        let headers = { 'Content-Type': 'application/json' };
        if (provider === 'azure-openai') {
            const endpoint = process.env.VITE_AZURE_OPENAI_API_ENDPOINT;
            const apiKey = process.env.VITE_AZURE_OPENAI_API_KEY;
            const deploymentName = process.env.VITE_AZURE_OPENAI_DEPLOYMENT_NAME || model;
            const apiVersion = process.env.VITE_AZURE_OPENAI_API_VERSION || '2024-02-15-preview';
            if (!endpoint || !apiKey) {
                return res.status(500).json({ error: 'Azure OpenAI not configured' });
            }
            const baseUrl = endpoint.endsWith('/') ? endpoint : `${endpoint}/`;
            url = `${baseUrl}openai/deployments/${deploymentName}/chat/completions?api-version=${apiVersion}`;
            headers['api-key'] = apiKey;
        }
        else if (provider === 'openai') {
            const apiKey = process.env.VITE_OPENAI_API_KEY;
            if (!apiKey) {
                return res.status(500).json({ error: 'OpenAI not configured' });
            }
            url = 'https://api.openai.com/v1/chat/completions';
            headers['Authorization'] = `Bearer ${apiKey}`;
        }
        else if (provider === 'groq') {
            const apiKey = process.env.VITE_GROQ_API_KEY;
            if (!apiKey) {
                return res.status(500).json({ error: 'Groq not configured' });
            }
            url = 'https://api.groq.com/openai/v1/chat/completions';
            headers['Authorization'] = `Bearer ${apiKey}`;
        }
        else {
            return res.status(400).json({ error: `Provider ${provider} not supported` });
        }
        const response = await axios.post(url, {
            model,
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.7,
            max_tokens: Math.min(8000, numTestCases * 600),
        }, { headers, timeout: 60000 });
        const content = response.data.choices[0]?.message?.content;
        if (!content) {
            return res.status(500).json({ error: 'Empty response from LLM' });
        }
        const cleanText = content.replace(/^```[\w]*\n/m, '').replace(/\n```\s*$/m, '').trim();
        const parsed = JSON.parse(cleanText);
        if (!parsed.test_cases || !Array.isArray(parsed.test_cases)) {
            return res.status(500).json({ error: 'Invalid response format from LLM' });
        }
        return res.json({ testCases: parsed.test_cases });
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return res.status(500).json({ error: `ServiceNow test case generation failed: ${errorMessage}` });
    }
});
/**
 * POST /api/feature-file/generate
 * Generate Gherkin Feature File from test cases with optional LLM enhancement
 */
app.post('/api/feature-file/generate', async (req, res) => {
    try {
        const { testCases, story, featureName, llmProvider } = req.body;
        if (!testCases || !Array.isArray(testCases) || testCases.length === 0) {
            return res.status(400).json({ error: 'testCases array is required and must not be empty' });
        }
        const scenarioName = generateScenarioName(testCases);
        const feature = featureName || story?.title || 'Generated Feature';
        let content = `Feature: ${feature}\n`;
        if (story?.epicTitle) {
            content += `  Epic: ${story.epicTitle}\n`;
        }
        if (story?.description) {
            content += `  ${story.description}\n`;
        }
        content += '\n';
        // Extract steps from first test case for Given/When/Then
        if (testCases.length > 0) {
            const firstTestCase = testCases[0];
            const steps = firstTestCase.steps || [];
            content += `  Scenario Outline: ${scenarioName}\n`;
            // Organize steps by Given/When/Then
            const givenSteps = [];
            const whenSteps = [];
            const thenSteps = [];
            steps.forEach((step, index) => {
                const stepText = step.step.trim();
                const ratio = steps.length > 1 ? index / (steps.length - 1) : 0;
                if (ratio < 0.33) {
                    givenSteps.push(stepText);
                }
                else if (ratio < 0.67) {
                    whenSteps.push(stepText);
                }
                else {
                    thenSteps.push({
                        step: stepText,
                        assertion: step.expected_result?.trim(),
                    });
                }
            });
            // Output Given steps
            givenSteps.forEach((step) => {
                content += `    Given ${step}\n`;
            });
            // Output When steps
            whenSteps.forEach((step) => {
                content += `    When ${step}\n`;
            });
            // Output Then steps with split assertions
            thenSteps.forEach((stepObj, idx) => {
                if (idx === 0) {
                    content += `    Then ${stepObj.step}\n`;
                }
                else {
                    content += `    And ${stepObj.step}\n`;
                }
                // Split and output each assertion as a separate step
                if (stepObj.assertion) {
                    const assertions = splitAndFormatAssertions(stepObj.assertion);
                    assertions.forEach((assertion) => {
                        content += `    And ${assertion}\n`;
                    });
                }
            });
            // Extract dynamic example columns from test data
            const exampleColumns = extractExampleColumns(testCases);
            const columnHeaders = Array.from(exampleColumns.keys());
            if (columnHeaders.length > 0) {
                content += '\n    Examples:\n';
                content += `      | ${columnHeaders.join(' | ')} |\n`;
                testCases.forEach((testCase) => {
                    const values = columnHeaders.map((header) => exampleColumns.get(header)?.get(testCase.id) || '-');
                    content += `      | ${values.join(' | ')} |\n`;
                });
            }
        }
        // If LLM provider specified, enhance with LLM
        if (llmProvider && llmProvider !== 'none') {
            try {
                content = await enhanceFeatureFileWithLLM(content, testCases, story, llmProvider);
            }
            catch (llmError) {
                console.warn('[Feature File] LLM enhancement failed, returning base content:', llmError);
                // Continue with base content if LLM fails
            }
        }
        const lines = content.split('\n').length;
        const scenarios = (content.match(/Scenario Outline:/g) || []).length;
        const examplesCount = testCases.length;
        return res.json({
            featureFile: content,
            stats: {
                lines,
                scenarios,
                examplesCount,
            },
        });
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return res.status(500).json({ error: `Feature file generation failed: ${errorMessage}` });
    }
});
/**
 * POST /api/user-story/analyze
 * Analyze user story quality using INVEST methodology
 */
app.post('/api/user-story/analyze', async (req, res) => {
    try {
        console.log('[User Story Analyze] Request received');
        const { story, provider, model } = req.body;
        if (!story) {
            console.log('[User Story Analyze] Missing story in request');
            return res.status(400).json({ error: 'story is required' });
        }
        console.log('[User Story Analyze] Story:', story.key, 'Provider:', provider, 'Model:', model);
        const acceptanceCriteriaText = story.acceptanceCriteria || 'No acceptance criteria provided';
        const prompt = `You are an expert QA analyst specializing in user story quality assessment. Review the following user story and provide a comprehensive analysis using the INVEST methodology.

USER STORY DETAILS:
================
Story ID: ${story.key}
Title: ${story.title}
Description: ${story.description}

Acceptance Criteria:
${acceptanceCriteriaText}

Status: ${story.status}
Priority: ${story.priority}
${story.epicKey ? `Epic Number: ${story.epicKey}` : ''}
${story.epicTitle ? `Epic Title: ${story.epicTitle}` : ''}

ANALYSIS REQUIREMENTS:
====================
Provide a comprehensive analysis covering:

1. INVEST CRITERIA ASSESSMENT:
   - Independent: Can this story be developed independently?
   - Negotiable: Is there room for discussion on implementation details?
   - Valuable: Does it deliver clear business value?
   - Estimable: Can the team estimate effort required?
   - Small: Is the scope manageable for a single iteration?
   - Testable: Are there clear acceptance criteria?

2. QUALITY ANALYSIS:
   - Clarity and completeness of requirements
   - Potential ambiguities or missing information
   - Adequacy of acceptance criteria
   - Risk assessment

3. RECOMMENDATIONS:
   - Suggested improvements to the story
   - Missing details that should be added
   - Potential edge cases to consider
   - Testing considerations

4. OVERALL ASSESSMENT:
   - Quality rating (Excellent/Good/Fair/Poor)
   - Readiness for development (Ready/Needs Work/Not Ready)
   - Key strengths and weaknesses

Please provide a structured, professional analysis.`;
        let url = '';
        let headers = { 'Content-Type': 'application/json' };
        if (provider === 'azure-openai') {
            const endpoint = process.env.VITE_AZURE_OPENAI_API_ENDPOINT;
            const apiKey = process.env.VITE_AZURE_OPENAI_API_KEY;
            const deploymentName = process.env.VITE_AZURE_OPENAI_DEPLOYMENT_NAME || model;
            const apiVersion = process.env.VITE_AZURE_OPENAI_API_VERSION || '2024-02-15-preview';
            if (!endpoint || !apiKey) {
                return res.status(500).json({ error: 'Azure OpenAI not configured' });
            }
            const baseUrl = endpoint.endsWith('/') ? endpoint : `${endpoint}/`;
            url = `${baseUrl}openai/deployments/${deploymentName}/chat/completions?api-version=${apiVersion}`;
            headers['api-key'] = apiKey;
        }
        else if (provider === 'openai') {
            const apiKey = process.env.VITE_OPENAI_API_KEY;
            if (!apiKey) {
                return res.status(500).json({ error: 'OpenAI not configured' });
            }
            url = 'https://api.openai.com/v1/chat/completions';
            headers['Authorization'] = `Bearer ${apiKey}`;
        }
        else if (provider === 'groq') {
            const apiKey = process.env.VITE_GROQ_API_KEY;
            if (!apiKey) {
                return res.status(500).json({ error: 'Groq not configured' });
            }
            url = 'https://api.groq.com/openai/v1/chat/completions';
            headers['Authorization'] = `Bearer ${apiKey}`;
        }
        else if (provider === 'claude') {
            const apiKey = process.env.VITE_CLAUDE_API_KEY;
            if (!apiKey) {
                return res.status(500).json({ error: 'Claude not configured' });
            }
            url = 'https://api.anthropic.com/v1/messages';
            headers['x-api-key'] = apiKey;
            headers['anthropic-version'] = '2023-06-01';
            // Claude uses different request format
            const response = await axios.post(url, {
                model: model || 'claude-3-5-sonnet-20241022',
                max_tokens: 2048,
                messages: [{ role: 'user', content: prompt }],
            }, { headers, timeout: 60000 });
            const analysis = response.data.content[0]?.text;
            if (!analysis) {
                return res.status(500).json({ error: 'Empty response from Claude' });
            }
            return res.json({ analysis });
        }
        else {
            return res.status(400).json({ error: `Provider ${provider} not supported` });
        }
        // For OpenAI-compatible providers
        const response = await axios.post(url, {
            model,
            messages: [
                {
                    role: 'system',
                    content: 'You are an expert QA analyst specializing in user story quality assessment using INVEST methodology.',
                },
                {
                    role: 'user',
                    content: prompt,
                },
            ],
            temperature: 0.7,
            max_tokens: 2048,
        }, { headers, timeout: 60000 });
        const analysis = response.data.choices[0]?.message?.content;
        if (!analysis) {
            console.log('[User Story Analyze] Empty response from LLM');
            return res.status(500).json({ error: 'Empty response from LLM' });
        }
        console.log('[User Story Analyze] Analysis complete, sending response');
        return res.json({ analysis });
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error('[User Story Analyze] Error:', errorMessage);
        return res.status(500).json({ error: `User story analysis failed: ${errorMessage}` });
    }
});
/**
 * POST /api/test-plan/generate
 * Generate a comprehensive QA test plan from user stories
 */
app.post('/api/test-plan/generate', async (req, res) => {
    try {
        const { stories, provider, model } = req.body;
        if (!stories || !Array.isArray(stories) || stories.length === 0) {
            return res.status(400).json({ error: 'stories array is required and must not be empty' });
        }
        const storiesText = stories
            .map((story) => `- ${story.id}: ${story.title} (Priority: ${story.priority}, Status: ${story.status})\n  Description: ${story.description}`)
            .join('\n');
        const prompt = `You are an expert QA test planning specialist. Review the following user stories and create a comprehensive test plan. For each testing type, provide specific test cases and scenarios.

SELECTED STORIES:
=================
${storiesText}

TASK:
=====
Based on these stories, create a detailed test plan in the following structure:

1. SYSTEM TESTING
   - List specific functional test cases for the features
   - Include positive and negative scenarios
   - Consider edge cases and error handling

2. SYSTEM INTEGRATION TESTING
   - List integration points that need testing
   - Include inter-component and API integration tests
   - Consider data flow across systems

3. REGRESSION TESTING
   - List existing features that could be impacted
   - Include backward compatibility tests
   - Consider potential side effects

Format the response as JSON with the following structure:
{
  "systemTesting": ["test case 1", "test case 2", ...],
  "systemIntegrationTesting": ["integration test 1", "integration test 2", ...],
  "regressionTesting": ["regression test 1", "regression test 2", ...]
}

Provide only valid JSON without any additional text.`;
        let url = '';
        let headers = { 'Content-Type': 'application/json' };
        if (provider === 'azure-openai') {
            const endpoint = process.env.VITE_AZURE_OPENAI_API_ENDPOINT;
            const apiKey = process.env.VITE_AZURE_OPENAI_API_KEY;
            const deploymentName = process.env.VITE_AZURE_OPENAI_DEPLOYMENT_NAME || model;
            const apiVersion = process.env.VITE_AZURE_OPENAI_API_VERSION || '2024-02-15-preview';
            if (!endpoint || !apiKey) {
                return res.status(500).json({ error: 'Azure OpenAI not configured' });
            }
            const baseUrl = endpoint.endsWith('/') ? endpoint : `${endpoint}/`;
            url = `${baseUrl}openai/deployments/${deploymentName}/chat/completions?api-version=${apiVersion}`;
            headers['api-key'] = apiKey;
        }
        else if (provider === 'openai') {
            const apiKey = process.env.VITE_OPENAI_API_KEY;
            if (!apiKey) {
                return res.status(500).json({ error: 'OpenAI not configured' });
            }
            url = 'https://api.openai.com/v1/chat/completions';
            headers['Authorization'] = `Bearer ${apiKey}`;
        }
        else if (provider === 'groq') {
            const apiKey = process.env.VITE_GROQ_API_KEY;
            if (!apiKey) {
                return res.status(500).json({ error: 'Groq not configured' });
            }
            url = 'https://api.groq.com/openai/v1/chat/completions';
            headers['Authorization'] = `Bearer ${apiKey}`;
        }
        else if (provider === 'claude') {
            const apiKey = process.env.VITE_CLAUDE_API_KEY;
            if (!apiKey) {
                return res.status(500).json({ error: 'Claude not configured' });
            }
            url = 'https://api.anthropic.com/v1/messages';
            headers['x-api-key'] = apiKey;
            headers['anthropic-version'] = '2023-06-01';
        }
        else {
            return res.status(400).json({ error: `Provider ${provider} not supported` });
        }
        const response = await axios.post(url, provider === 'claude'
            ? {
                model: model || 'claude-3-5-sonnet-20241022',
                max_tokens: 2048,
                messages: [{ role: 'user', content: prompt }],
            }
            : {
                model,
                messages: [{ role: 'user', content: prompt }],
                temperature: 0.7,
                max_tokens: 2048,
            }, { headers, timeout: 60000 });
        let responseText = '';
        if (provider === 'claude') {
            responseText = response.data.content[0]?.text;
        }
        else {
            responseText = response.data.choices[0]?.message?.content;
        }
        if (!responseText) {
            return res.status(500).json({ error: 'Empty response from LLM' });
        }
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            return res.status(500).json({ error: 'Invalid response format from LLM' });
        }
        const parsedResult = JSON.parse(jsonMatch[0]);
        return res.json(parsedResult);
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return res.status(500).json({ error: `Test plan generation failed: ${errorMessage}` });
    }
});
/**
 * Helper: Generate scenario name from test cases
 */
function generateScenarioName(testCases) {
    if (testCases.length === 1) {
        return `Verify ${testCases[0].name}`;
    }
    const types = [...new Set(testCases.map((tc) => tc.test_type))];
    return `Execute ${types.length === 1 ? types[0] : 'multiple'} test scenarios`;
}
/**
 * Helper: Extract example columns from test cases
 */
function extractExampleColumns(testCases) {
    const columns = new Map();
    testCases.forEach((testCase) => {
        if (!testCase.steps || testCase.steps.length === 0)
            return;
        // Extract test data from steps
        testCase.steps.forEach((step) => {
            if (!step.test_data)
                return;
            // Parse test_data format: "field_name: value" or just "value"
            const parts = step.test_data.split(':');
            if (parts.length === 2) {
                const key = sanitizeForTable(parts[0].trim());
                const value = sanitizeForTable(parts[1].trim());
                if (!columns.has(key)) {
                    columns.set(key, new Map());
                }
                columns.get(key).set(testCase.id, value);
            }
        });
        // Add test case metadata columns
        if (!columns.has('test_case')) {
            columns.set('test_case', new Map());
        }
        columns.get('test_case').set(testCase.id, sanitizeForTable(testCase.name));
        if (!columns.has('expected_result')) {
            columns.set('expected_result', new Map());
        }
        const lastStep = testCase.steps[testCase.steps.length - 1];
        columns.get('expected_result').set(testCase.id, sanitizeForTable(lastStep?.expected_result || ''));
        if (!columns.has('priority')) {
            columns.set('priority', new Map());
        }
        columns.get('priority').set(testCase.id, testCase.priority);
        if (!columns.has('type')) {
            columns.set('type', new Map());
        }
        columns.get('type').set(testCase.id, testCase.test_type);
    });
    return columns;
}
/**
 * Helper: Sanitize text for table display
 */
function sanitizeForTable(text) {
    if (!text)
        return '-';
    return text.replace(/\|/g, ' ').replace(/\n/g, ' ').substring(0, 50);
}
/**
 * Helper: Enhance feature file with LLM
 */
async function enhanceFeatureFileWithLLM(baseContent, testCases, _story, provider) {
    try {
        // Get LLM configuration from environment
        let url = '';
        let headers = { 'Content-Type': 'application/json' };
        let model = '';
        if (provider === 'azure-openai') {
            const endpoint = process.env.VITE_AZURE_OPENAI_API_ENDPOINT;
            const apiKey = process.env.VITE_AZURE_OPENAI_API_KEY;
            const deploymentName = process.env.VITE_AZURE_OPENAI_DEPLOYMENT;
            if (!endpoint || !apiKey || !deploymentName) {
                throw new Error('Azure OpenAI not configured');
            }
            const baseUrl = endpoint.endsWith('/') ? endpoint : `${endpoint}/`;
            url = `${baseUrl}openai/deployments/${deploymentName}/chat/completions?api-version=2024-02-15-preview`;
            headers['api-key'] = apiKey;
            model = deploymentName;
        }
        else if (provider === 'openai') {
            const apiKey = process.env.VITE_OPENAI_API_KEY;
            if (!apiKey)
                throw new Error('OpenAI API key not configured');
            url = 'https://api.openai.com/v1/chat/completions';
            headers['Authorization'] = `Bearer ${apiKey}`;
            model = 'gpt-4o-mini';
        }
        else if (provider === 'groq') {
            const apiKey = process.env.VITE_GROQ_API_KEY;
            if (!apiKey)
                throw new Error('Groq API key not configured');
            url = 'https://api.groq.com/openai/v1/chat/completions';
            headers['Authorization'] = `Bearer ${apiKey}`;
            model = 'mixtral-8x7b-32768';
        }
        else {
            throw new Error(`Provider ${provider} not supported`);
        }
        const testCasesList = testCases.map((tc) => `- ${tc.name}: ${tc.short_description}`).join('\n');
        const prompt = `Enhance this Gherkin feature file to be more professional and comprehensive. Keep the Scenario Outline structure and Examples table intact, but improve the step descriptions to be more specific and clear.

Test Cases Summary:
${testCasesList}

Current Feature File:
${baseContent}

Please:
1. Make Given/When/Then steps more specific and detailed
2. Use proper Gherkin conventions
3. Keep the Examples table structure unchanged
4. Return only the enhanced feature file content without any markdown or extra text`;
        const response = await axios.post(url, {
            model,
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.7,
            max_tokens: 2048,
        }, { headers });
        const enhancedContent = response.data.choices[0]?.message?.content;
        if (!enhancedContent) {
            throw new Error('No content in LLM response');
        }
        // Clean up markdown if present
        return enhancedContent.replace(/^```[\w]*\n/m, '').replace(/\n```\s*$/m, '').trim();
    }
    catch (error) {
        // Log but don't throw - return base content instead
        console.warn('[Feature File LLM] Enhancement failed:', error instanceof Error ? error.message : error);
        return baseContent;
    }
}
/**
 * POST /api/test-cases/export
 * Export test cases to Jira or ServiceNow Test Management 2.0
 */
app.post('/api/test-cases/export', async (req, res) => {
    try {
        const { testCases, integration, storyKey } = req.body;
        if (!testCases || !Array.isArray(testCases) || testCases.length === 0) {
            return res.status(400).json({ error: 'Test cases array is required' });
        }
        if (!integration || (integration !== 'jira' && integration !== 'servicenow')) {
            return res.status(400).json({ error: 'Valid integration type (jira or servicenow) is required' });
        }
        console.log(`[Test Case Export] Exporting ${testCases.length} test cases to ${integration}`);
        if (integration === 'jira') {
            const jiraSession = req.session?.jira;
            if (!jiraSession) {
                return res.status(401).json({ error: 'Jira not connected. Please connect to Jira first.' });
            }
            const baseUrl = jiraSession.baseUrl.endsWith('/') ? jiraSession.baseUrl : `${jiraSession.baseUrl}/`;
            const authHeader = `Basic ${btoa(`${jiraSession.email}:${jiraSession.apiToken}`)}`;
            const results = {
                success: true,
                created: [],
                failed: [],
            };
            let projectKey = '';
            if (storyKey) {
                try {
                    const storyResponse = await axios.get(`${baseUrl}rest/api/3/issue/${storyKey}`, {
                        headers: {
                            Authorization: authHeader,
                            Accept: 'application/json',
                        },
                    });
                    projectKey = storyResponse.data.fields.project.key;
                }
                catch (err) {
                    console.error('[Jira] Failed to get project key from story:', err);
                }
            }
            if (!projectKey) {
                return res.status(400).json({ error: 'Could not determine project key from story' });
            }
            for (const testCase of testCases) {
                try {
                    const response = await axios.post(`${baseUrl}rest/api/3/issue`, {
                        fields: {
                            project: { key: projectKey },
                            summary: testCase.name,
                            description: {
                                type: 'doc',
                                version: 1,
                                content: [
                                    {
                                        type: 'paragraph',
                                        content: [{ type: 'text', text: testCase.description || testCase.short_description || '' }],
                                    },
                                    ...(testCase.steps && testCase.steps.length > 0 ? [
                                        {
                                            type: 'heading',
                                            attrs: { level: 3 },
                                            content: [{ type: 'text', text: 'Test Steps' }],
                                        },
                                        {
                                            type: 'orderedList',
                                            content: testCase.steps.map((step) => ({
                                                type: 'listItem',
                                                content: [
                                                    {
                                                        type: 'paragraph',
                                                        content: [
                                                            { type: 'text', text: `${step.step}`, marks: [{ type: 'strong' }] },
                                                        ],
                                                    },
                                                    {
                                                        type: 'paragraph',
                                                        content: [
                                                            { type: 'text', text: `Expected: ${step.expected_result}` },
                                                        ],
                                                    },
                                                    ...(step.test_data ? [{
                                                            type: 'paragraph',
                                                            content: [
                                                                { type: 'text', text: `Test Data: ${step.test_data}` },
                                                            ],
                                                        }] : []),
                                                ],
                                            })),
                                        },
                                    ] : []),
                                ],
                            },
                            issuetype: { name: 'Task' },
                            priority: { name: testCase.priority || 'Medium' },
                            ...(storyKey && { parent: { key: storyKey } }),
                        },
                    }, {
                        headers: {
                            Authorization: authHeader,
                            'Content-Type': 'application/json',
                            Accept: 'application/json',
                        },
                    });
                    const createdIssue = response.data;
                    results.created.push({
                        localId: testCase.id,
                        remoteId: createdIssue.key,
                        name: testCase.name,
                        url: `${baseUrl}browse/${createdIssue.key}`,
                    });
                    console.log(`[Jira] Created test case: ${createdIssue.key}`);
                }
                catch (error) {
                    const errorMsg = error.response?.data?.errorMessages?.[0] || error.message;
                    results.failed.push({
                        localId: testCase.id,
                        name: testCase.name,
                        error: errorMsg,
                    });
                    results.success = false;
                    console.error(`[Jira] Failed to create test case ${testCase.name}:`, errorMsg);
                }
            }
            return res.json({
                success: results.success,
                message: `Exported ${results.created.length} test cases to Jira`,
                created: results.created,
                failed: results.failed,
                summary: {
                    total: testCases.length,
                    created: results.created.length,
                    failed: results.failed.length,
                },
            });
        }
        else if (integration === 'servicenow') {
            const snowSession = req.session?.servicenow;
            if (!snowSession) {
                return res.status(401).json({ error: 'ServiceNow not connected. Please connect to ServiceNow first.' });
            }
            const baseUrl = snowSession.instanceUrl.endsWith('/') ? snowSession.instanceUrl : `${snowSession.instanceUrl}/`;
            const authHeader = `Basic ${btoa(`${snowSession.username}:${snowSession.password}`)}`;
            const results = {
                success: true,
                created: [],
                failed: [],
            };
            for (const testCase of testCases) {
                try {
                    // Step 1: Create test case in sn_test_management_test table
                    const testResponse = await axios.post(`${baseUrl}api/now/table/sn_test_management_test`, {
                        short_description: testCase.name,
                        description: testCase.description || testCase.short_description || '',
                        test_type: testCase.test_type || 'manual',
                        priority: mapPriorityToServiceNow(testCase.priority),
                        state: 'draft',
                    }, {
                        headers: {
                            Authorization: authHeader,
                            'Content-Type': 'application/json',
                            Accept: 'application/json',
                        },
                    });
                    const createdTest = testResponse.data.result || testResponse.data;
                    const testSysId = createdTest.sys_id;
                    const testNumber = createdTest.number || testSysId;
                    console.log(`[ServiceNow TM 2.0] Created test case: ${testNumber} (${testSysId})`);
                    // Step 2: Create version in sn_test_management_test_version table
                    const versionResponse = await axios.post(`${baseUrl}api/now/table/sn_test_management_test_version`, {
                        test: testSysId,
                        version: testCase.version || '1.0',
                        short_description: testCase.name,
                        description: testCase.description || testCase.short_description || '',
                        state: 'draft',
                        priority: mapPriorityToServiceNow(testCase.priority),
                    }, {
                        headers: {
                            Authorization: authHeader,
                            'Content-Type': 'application/json',
                            Accept: 'application/json',
                        },
                    });
                    const createdVersion = versionResponse.data.result || versionResponse.data;
                    const versionSysId = createdVersion.sys_id;
                    console.log(`[ServiceNow TM 2.0] Created version: ${versionSysId}`);
                    // Step 3: Create steps in sn_test_management_step table
                    if (testCase.steps && testCase.steps.length > 0) {
                        for (let i = 0; i < testCase.steps.length; i++) {
                            const step = testCase.steps[i];
                            await axios.post(`${baseUrl}api/now/table/sn_test_management_step`, {
                                test_version: versionSysId,
                                order: step.order || (i + 1) * 100,
                                step: step.step || '',
                                expected_result: step.expected_result || '',
                                test_data: step.test_data || '',
                            }, {
                                headers: {
                                    Authorization: authHeader,
                                    'Content-Type': 'application/json',
                                    Accept: 'application/json',
                                },
                            });
                        }
                        console.log(`[ServiceNow TM 2.0] Created ${testCase.steps.length} test steps`);
                    }
                    // Step 4: Link test case to story if story_id exists
                    if (testCase.story_id) {
                        try {
                            await axios.post(`${baseUrl}api/now/table/sn_test_management_m2m_task_test`, {
                                task: testCase.story_id,
                                test: testSysId,
                            }, {
                                headers: {
                                    Authorization: authHeader,
                                    'Content-Type': 'application/json',
                                    Accept: 'application/json',
                                },
                            });
                            console.log(`[ServiceNow TM 2.0] Linked test case to story: ${testCase.story_id}`);
                            // Step 5: Add work note to story with test case name
                            if (testCase.story_id) {
                                try {
                                    await axios.patch(`${baseUrl}api/now/table/task/${testCase.story_id}`, {
                                        work_notes: `Test case linked: [${testNumber}] ${testCase.name}`,
                                    }, {
                                        headers: {
                                            Authorization: authHeader,
                                            'Content-Type': 'application/json',
                                            Accept: 'application/json',
                                        },
                                    });
                                    console.log(`[ServiceNow TM 2.0] Added work note to story: ${testCase.story_id}`);
                                }
                                catch (noteError) {
                                    console.warn(`[ServiceNow TM 2.0] Failed to add work note to ${testCase.story_id}: ${noteError.message}`);
                                }
                            }
                            else {
                                console.warn(`[ServiceNow TM 2.0] No story_id provided for test case, skipping work note`);
                            }
                        }
                        catch (linkError) {
                            console.warn(`[ServiceNow TM 2.0] Failed to link test to story: ${linkError.message}`);
                        }
                    }
                    results.created.push({
                        localId: testCase.id,
                        remoteId: testNumber,
                        name: testCase.name,
                        url: `${baseUrl}sn_test_management_test.do?sys_id=${testSysId}`,
                    });
                }
                catch (error) {
                    const errorMsg = error.response?.data?.error?.message || error.message;
                    results.failed.push({
                        localId: testCase.id,
                        name: testCase.name,
                        error: errorMsg,
                    });
                    results.success = false;
                    console.error(`[ServiceNow TM 2.0] Failed to create test case ${testCase.name}:`, errorMsg);
                }
            }
            return res.json({
                success: results.success,
                message: `Exported ${results.created.length} test cases to ServiceNow Test Management 2.0`,
                created: results.created,
                failed: results.failed,
                summary: {
                    total: testCases.length,
                    created: results.created.length,
                    failed: results.failed.length,
                },
            });
        }
        else {
            return res.status(400).json({ error: 'Invalid integration type' });
        }
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        console.error('[Test Case Export] Error:', errorMessage);
        return res.status(500).json({ error: `Failed to export test cases: ${errorMessage}` });
    }
});
// Helper function to map priority to ServiceNow values
function mapPriorityToServiceNow(priority) {
    const priorityMap = {
        'Critical': '1',
        'High': '2',
        'Medium': '3',
        'Low': '4',
    };
    return priorityMap[priority] || '3';
}
// Extract description helper
function extractDescription(desc) {
    if (!desc)
        return '';
    if (typeof desc === 'string')
        return desc;
    if (desc.content && Array.isArray(desc.content)) {
        return desc.content
            .map((block) => {
            if (block.content && Array.isArray(block.content)) {
                return block.content.map((item) => item.text || '').join('');
            }
            return '';
        })
            .join('\n');
    }
    return '';
}
// ==================== PII DETECTION ENDPOINTS ====================
/**
 * Import PII detector
 */
import { piiDetector } from './lib/piiDetector.js';
/**
 * GET /api/pii/config
 * Retrieve current PII detection configuration
 */
app.get('/api/pii/config', (req, res) => {
    try {
        const config = req.session?.piiConfig;
        if (!config) {
            // Return default config instead of 404
            const defaultConfig = {
                mode: 'warn',
                sensitivityLevel: 'medium',
                enabledTypes: ['email', 'phone', 'ssn', 'creditCard', 'bankAccount', 'passport', 'dob', 'driverLicense', 'ipAddress'],
                autoSave: true,
            };
            return res.status(200).json(defaultConfig);
        }
        return res.json(config);
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return res.status(500).json({ error: `Failed to retrieve PII config: ${errorMessage}` });
    }
});
/**
 * POST /api/pii/config
 * Save PII detection configuration to session
 */
app.post('/api/pii/config', (req, res) => {
    try {
        const { mode, sensitivityLevel, enabledTypes, autoSave } = req.body;
        if (!mode || !sensitivityLevel) {
            return res.status(400).json({ error: 'Mode and sensitivity level are required' });
        }
        const validModes = ['disabled', 'warn', 'mask', 'block'];
        const validLevels = ['low', 'medium', 'high'];
        if (!validModes.includes(mode)) {
            return res.status(400).json({ error: `Invalid mode. Must be one of: ${validModes.join(', ')}` });
        }
        if (!validLevels.includes(sensitivityLevel)) {
            return res.status(400).json({ error: `Invalid sensitivity level. Must be one of: ${validLevels.join(', ')}` });
        }
        const config = {
            mode,
            sensitivityLevel,
            enabledTypes: enabledTypes || [],
            autoSave: autoSave !== false,
        };
        // Store in session
        if (!req.session) {
            return res.status(500).json({ error: 'Session not available' });
        }
        req.session.piiConfig = config;
        console.log('[PII CONFIG SAVED] Mode:', mode, 'Sensitivity:', sensitivityLevel, 'Enabled Types:', enabledTypes?.length || 0);
        return res.json({ success: true, config });
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return res.status(500).json({ error: `Failed to save PII config: ${errorMessage}` });
    }
});
/**
 * POST /api/pii/detect
 * Detect PII in provided content
 */
app.post('/api/pii/detect', (req, res) => {
    try {
        const { content, config } = req.body;
        if (!content || typeof content !== 'string') {
            return res.status(400).json({ error: 'Content (string) is required' });
        }
        // Use provided config or fall back to session config
        const piiConfig = config || req.session?.piiConfig || {
            mode: 'warn',
            sensitivityLevel: 'medium',
            enabledTypes: ['email', 'phone', 'ssn', 'creditCard', 'bankAccount', 'passport', 'dob', 'driverLicense', 'ipAddress'],
            autoSave: true,
        };
        // Detect PII
        const result = piiDetector.detectPII(content, piiConfig.sensitivityLevel, piiConfig.enabledTypes);
        return res.json(result);
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return res.status(500).json({ error: `PII detection failed: ${errorMessage}` });
    }
});
// ==================== END PII DETECTION ENDPOINTS ====================
// Global error handler middleware
app.use((err, _req, res, _next) => {
    const status = err.status || 500;
    const isDevelopment = NODE_ENV === 'development';
    console.error(`[${new Date().toISOString()}] ${status} Error:`, err.message);
    res.status(status).json({
        error: isDevelopment ? err.message : 'Internal server error',
        ...(isDevelopment && { stack: err.stack }),
    });
});
// Initialize connections from env before starting server
async function startServer() {
    await connectionManager.initializeFromEnv();
    const server = app.listen(PORT, '127.0.0.1', () => {
        console.log(`✅ Backend listening on http://127.0.0.1:${PORT}`);
        console.log(`📍 Environment: ${NODE_ENV}`);
        console.log(`🔒 Session Secret: ${SESSION_SECRET ? 'configured' : 'MISSING!'}`);
    });
    // Graceful shutdown
    process.on('SIGTERM', () => {
        console.log('SIGTERM received, shutting down gracefully...');
        server.close(() => {
            console.log('Server closed');
            process.exit(0);
        });
    });
    process.on('unhandledRejection', (reason, promise) => {
        console.error('Unhandled Rejection at:', promise, 'reason:', reason);
        process.exit(1);
    });
}
startServer().catch((error) => {
    console.error('Failed to start server:', error);
    process.exit(1);
});
//# sourceMappingURL=server.js.map