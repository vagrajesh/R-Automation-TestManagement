import { LLMProvider, LLMConfig } from '../config/llmConfig';

/**
 * Production-grade LLM Service for managing multiple LLM provider configurations
 * Supports connection testing, configuration storage, and provider management
 */
export class LLMService {
  private configs: Map<LLMProvider, LLMConfig> = new Map();
  private connectionCache: Map<LLMProvider, { timestamp: number; result: boolean }> = new Map();
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  /**
   * Add or update a provider configuration
   * @param provider - LLM provider ID
   * @param config - Provider configuration
   * @throws Error if configuration is invalid
   */
  addConfig(provider: LLMProvider, config: LLMConfig): void {
    if (!config.apiKey || !config.apiKey.trim()) {
      throw new Error('API Key is required and cannot be empty');
    }
    if (!config.endpoint || !config.endpoint.trim()) {
      throw new Error('Endpoint is required and cannot be empty');
    }
    if (!config.model || !config.model.trim()) {
      throw new Error('Model is required and cannot be empty');
    }

    this.configs.set(provider, {
      ...config,
      apiKey: config.apiKey.trim(),
      endpoint: config.endpoint.trim(),
      model: config.model.trim(),
    });

    // Clear cache when config changes
    this.connectionCache.delete(provider);
  }

  /**
   * Get configuration for a specific provider
   * @param provider - LLM provider ID
   * @returns Provider configuration or undefined
   */
  getConfig(provider: LLMProvider): LLMConfig | undefined {
    return this.configs.get(provider);
  }

  /**
   * Get all configured providers
   * @returns Array of configurations
   */
  getAllConfigs(): LLMConfig[] {
    return Array.from(this.configs.values());
  }

  /**
   * Get all provider IDs that are configured
   * @returns Array of provider IDs
   */
  getConfiguredProviders(): LLMProvider[] {
    return Array.from(this.configs.keys());
  }

  /**
   * Remove a provider configuration
   * @param provider - LLM provider ID
   */
  removeConfig(provider: LLMProvider): void {
    this.configs.delete(provider);
    this.connectionCache.delete(provider);
  }

  /**
   * Check if a provider is configured
   * @param provider - LLM provider ID
   * @returns true if provider is configured
   */
  isConfigured(provider: LLMProvider): boolean {
    return this.configs.has(provider);
  }

  /**
   * Test connection to a provider with caching
   * @param provider - LLM provider ID
   * @returns Connection result
   */
  async testConnection(provider: LLMProvider): Promise<{ success: boolean; message: string }> {
    const config = this.getConfig(provider);
    if (!config) {
      return { success: false, message: 'Provider not configured' };
    }

    // Check cache
    const cached = this.connectionCache.get(provider);
    if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
      return {
        success: cached.result,
        message: cached.result ? 'Connection successful (cached)' : 'Last connection failed (cached)',
      };
    }

    try {
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Connection timeout')), 10000)
      );

      const response = await Promise.race([
        this.makeTestRequest(config),
        timeoutPromise,
      ]);

      const success = response.ok;
      this.connectionCache.set(provider, { timestamp: Date.now(), result: success });

      if (success) {
        return { success: true, message: 'Connection successful' };
      } else {
        return { success: false, message: `Connection failed: ${response.statusText}` };
      }
    } catch (error) {
      this.connectionCache.set(provider, { timestamp: Date.now(), result: false });
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, message: `Connection error: ${errorMessage}` };
    }
  }

  /**
   * Make test request to provider API
   * @param config - Provider configuration
   * @returns Fetch response
   */
  private async makeTestRequest(config: LLMConfig): Promise<Response> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    let url: string;
    let method = 'GET';
    let body: string | undefined;

    // Set appropriate authorization headers and URL based on provider
    if (config.provider === 'openai') {
      headers['Authorization'] = `Bearer ${config.apiKey}`;
      url = 'https://api.openai.com/v1/models';
    } else if (config.provider === 'groq') {
      headers['Authorization'] = `Bearer ${config.apiKey}`;
      url = 'https://api.groq.com/openai/v1/models';
    } else if (config.provider === 'azure-openai') {
      // Azure OpenAI requires POST request with message body for testing
      headers['api-key'] = config.apiKey;
      const apiVersion = config.apiVersion || '2024-02-15-preview';
      const endpoint = config.endpoint.endsWith('/') ? config.endpoint : `${config.endpoint}/`;
      url = `${endpoint}openai/deployments/${config.deploymentName || 'test'}/chat/completions?api-version=${apiVersion}`;
      method = 'POST';
      body = JSON.stringify({
        messages: [{ role: 'user', content: 'test' }],
        max_tokens: 1,
      });
    } else if (config.provider === 'claude') {
      headers['x-api-key'] = config.apiKey;
      headers['anthropic-version'] = '2023-06-01';
      url = 'https://api.anthropic.com/v1/models';
    } else if (config.provider === 'testleaf') {
      headers['Authorization'] = `Bearer ${config.apiKey}`;
      const endpoint = config.endpoint.endsWith('/') ? config.endpoint : `${config.endpoint}/`;
      url = `${endpoint}models`;
    } else {
      throw new Error('Unknown provider');
    }

    const fetchOptions: RequestInit = {
      method,
      headers,
    };

    if (body) {
      fetchOptions.body = body;
    }

    return fetch(url, fetchOptions);
  }

  /**
   * Clear all cached connection tests
   */
  clearCache(): void {
    this.connectionCache.clear();
  }

  /**
   * Export configurations (without API keys for security)
   * @returns Safe configuration export
   */
  exportConfigSummary(): Array<{
    provider: LLMProvider;
    isConfigured: boolean;
    model: string | null;
    endpoint: string | null;
  }> {
    return Array.from(this.configs.entries()).map(([provider, config]) => ({
      provider,
      isConfigured: true,
      model: config.model,
      endpoint: config.endpoint,
    }));
  }
}

// Export singleton instance
export const llmService = new LLMService();
