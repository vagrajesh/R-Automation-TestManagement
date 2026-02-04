import axios from 'axios';
class ConnectionManager {
    constructor() {
        this.state = {
            jira: { isConnected: false },
            servicenow: { isConnected: false },
            llmProviders: {},
        };
    }
    /**
     * Initialize connections from environment variables
     */
    async initializeFromEnv() {
        console.log('\n[ConnectionManager] Initializing connections from environment variables...\n');
        // Initialize Jira
        await this.initializeJira();
        // Initialize ServiceNow
        await this.initializeServiceNow();
        // Initialize LLM Providers
        this.initializeLLMProviders();
        console.log('[ConnectionManager] Initialization complete\n');
    }
    /**
     * Initialize Jira from environment variables
     */
    async initializeJira() {
        const apiKey = process.env.JIRA_API_KEY || process.env.VITE_JIRA_API_KEY;
        const endpoint = process.env.JIRA_API_ENDPOINT || process.env.VITE_JIRA_API_ENDPOINT;
        const username = process.env.JIRA_USERNAME || process.env.VITE_JIRA_USERNAME;
        if (!apiKey || !endpoint || !username) {
            console.log('ℹ️  [Jira] No credentials in environment - manual connection required in UI');
            return;
        }
        try {
            const baseUrl = endpoint.endsWith('/') ? endpoint : `${endpoint}/`;
            const credentials = btoa(`${username}:${apiKey}`);
            const response = await axios.get(`${baseUrl}rest/api/3/myself`, {
                headers: {
                    Authorization: `Basic ${credentials}`,
                    Accept: 'application/json',
                },
                timeout: 10000,
            });
            this.state.jira = {
                isConnected: true,
                lastCheck: new Date(),
                baseUrl,
                email: username,
                user: response.data.displayName || username,
            };
            // Store in global for session reuse
            global.defaultJiraConnection = { baseUrl, email: username, apiToken: apiKey };
            console.log(`✅ [Jira] Auto-connected as ${response.data.displayName || username}`);
        }
        catch (error) {
            const errorMsg = error instanceof Error ? error.message : 'Unknown error';
            this.state.jira = {
                isConnected: false,
                lastCheck: new Date(),
                error: errorMsg,
            };
            console.log(`❌ [Jira] Auto-connection failed: ${errorMsg}`);
        }
    }
    /**
     * Initialize ServiceNow from environment variables
     */
    async initializeServiceNow() {
        const password = process.env.SERVICENOW_PASSWORD || process.env.VITE_SERVICENOW_PASSWORD;
        const endpoint = process.env.SERVICENOW_API_ENDPOINT || process.env.VITE_SERVICENOW_API_ENDPOINT;
        const username = process.env.SERVICENOW_USERNAME || process.env.VITE_SERVICENOW_USERNAME;
        console.log('[ServiceNow] Checking credentials:');
        console.log('  - Endpoint:', endpoint ? '✓ present' : '✗ missing');
        console.log('  - Username:', username ? '✓ present' : '✗ missing');
        console.log('  - Password:', password ? '✓ present' : '✗ missing');
        if (!password || !endpoint || !username) {
            console.log('ℹ️  [ServiceNow] No credentials in environment - manual connection required in UI');
            return;
        }
        try {
            const instanceUrl = endpoint;
            const testUrl = instanceUrl.endsWith('/') ? instanceUrl : `${instanceUrl}/`;
            const credentials = btoa(`${username}:${password}`);
            const testEndpoint = `${testUrl}api/now/table/sys_user?sysparm_limit=1`;
            console.log(`[ServiceNow] Testing connection to: ${testEndpoint}`);
            await axios.get(testEndpoint, {
                headers: {
                    Authorization: `Basic ${credentials}`,
                    Accept: 'application/json',
                },
                timeout: 15000,
            });
            this.state.servicenow = {
                isConnected: true,
                lastCheck: new Date(),
                instanceUrl,
                username,
            };
            // Store in global for session reuse
            global.defaultServiceNowConnection = { instanceUrl, username, password };
            console.log(`✅ [ServiceNow] Auto-connected successfully`);
        }
        catch (error) {
            let errorMsg = 'Unknown error';
            let statusCode = 'N/A';
            if (error instanceof axios.AxiosError) {
                statusCode = String(error.response?.status || error.code || 'N/A');
                errorMsg = error.response?.data?.error?.message || error.message;
            }
            else if (error instanceof Error) {
                errorMsg = error.message;
            }
            this.state.servicenow = {
                isConnected: false,
                lastCheck: new Date(),
                error: errorMsg,
            };
            console.log(`❌ [ServiceNow] Auto-connection failed (${statusCode}): ${errorMsg}`);
        }
    }
    /**
     * Initialize LLM providers from environment variables
     */
    initializeLLMProviders() {
        const providers = [
            { name: 'openai', keyVar: 'OPENAI_API_KEY', modelVar: 'OPENAI_DEFAULT_MODEL' },
            { name: 'groq', keyVar: 'GROQ_API_KEY', modelVar: 'GROQ_DEFAULT_MODEL' },
            { name: 'azure-openai', keyVar: 'AZURE_OPENAI_API_KEY', modelVar: 'AZURE_OPENAI_DEFAULT_MODEL' },
            { name: 'claude', keyVar: 'CLAUDE_API_KEY', modelVar: 'CLAUDE_DEFAULT_MODEL' },
            { name: 'testleaf', keyVar: 'TESTLEAF_API_KEY', modelVar: 'TESTLEAF_DEFAULT_MODEL' },
        ];
        for (const provider of providers) {
            const hasKey = process.env[provider.keyVar] ||
                process.env[`VITE_${provider.keyVar}`];
            const model = process.env[provider.modelVar] ||
                process.env[`VITE_${provider.modelVar}`];
            if (hasKey) {
                this.state.llmProviders[provider.name] = {
                    isConfigured: true,
                    model: model || 'default',
                };
                console.log(`✅ [LLM] Provider '${provider.name}' is configured (model: ${model || 'default'})`);
            }
        }
        if (Object.keys(this.state.llmProviders).length === 0) {
            console.log('ℹ️  [LLM] No LLM providers configured in environment');
        }
    }
    /**
     * Get current connection state
     */
    getState() {
        return this.state;
    }
    /**
     * Get Jira connection details (for session initialization)
     */
    getJiraConnection() {
        return global.defaultJiraConnection;
    }
    /**
     * Get ServiceNow connection details (for session initialization)
     */
    getServiceNowConnection() {
        return global.defaultServiceNowConnection;
    }
    /**
     * Check if Jira is connected
     */
    isJiraConnected() {
        return this.state.jira.isConnected;
    }
    /**
     * Check if ServiceNow is connected
     */
    isServiceNowConnected() {
        return this.state.servicenow.isConnected;
    }
    /**
     * Get configured LLM providers
     */
    getConfiguredLLMProviders() {
        return Object.keys(this.state.llmProviders);
    }
}
export const connectionManager = new ConnectionManager();
//# sourceMappingURL=connectionManager.js.map