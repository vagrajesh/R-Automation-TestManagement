export interface ConnectionStatus {
    isConnected: boolean;
    lastCheck?: Date;
    error?: string;
    user?: string;
}
export interface ConnectionState {
    jira: ConnectionStatus & {
        baseUrl?: string;
        email?: string;
    };
    servicenow: ConnectionStatus & {
        instanceUrl?: string;
        username?: string;
    };
    llmProviders: Record<string, {
        isConfigured: boolean;
        model?: string;
    }>;
}
declare class ConnectionManager {
    private state;
    /**
     * Initialize connections from environment variables
     */
    initializeFromEnv(): Promise<void>;
    /**
     * Initialize Jira from environment variables
     */
    private initializeJira;
    /**
     * Initialize ServiceNow from environment variables
     */
    private initializeServiceNow;
    /**
     * Initialize LLM providers from environment variables
     */
    private initializeLLMProviders;
    /**
     * Get current connection state
     */
    getState(): ConnectionState;
    /**
     * Get Jira connection details (for session initialization)
     */
    getJiraConnection(): any;
    /**
     * Get ServiceNow connection details (for session initialization)
     */
    getServiceNowConnection(): any;
    /**
     * Check if Jira is connected
     */
    isJiraConnected(): boolean;
    /**
     * Check if ServiceNow is connected
     */
    isServiceNowConnected(): boolean;
    /**
     * Get configured LLM providers
     */
    getConfiguredLLMProviders(): string[];
}
export declare const connectionManager: ConnectionManager;
export {};
//# sourceMappingURL=connectionManager.d.ts.map