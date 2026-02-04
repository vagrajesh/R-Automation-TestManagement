export type LLMProvider = 'openai' | 'groq' | 'azure-openai' | 'claude' | 'testleaf';

export interface LLMModel {
  id: string;
  name: string;
  description: string;
  contextWindow?: number; // tokens
  costPer1kTokens?: {
    input: number;
    output: number;
  };
}

export interface LLMConfig {
  provider: LLMProvider;
  apiKey: string;
  endpoint: string;
  model: string;
  deploymentName?: string;
  apiVersion?: string;
}

export interface LLMProviderConfig {
  id: LLMProvider;
  name: string;
  description: string;
  icon: string;
  models: LLMModel[];
  defaultModel: string;
  endpoint: string;
  apiKeyLabel: string;
  docLink: string;
  additionalFields?: {
    name: string;
    label: string;
    placeholder: string;
    required: boolean;
  }[];
}

export const LLM_MODELS: Record<LLMProvider, LLMModel[]> = {
  openai: [
    {
      id: 'gpt-4-turbo',
      name: 'GPT-4 Turbo',
      description: 'Latest GPT-4 with improved instruction following',
      contextWindow: 128000,
      costPer1kTokens: { input: 0.01, output: 0.03 },
    },
    {
      id: 'gpt-4',
      name: 'GPT-4',
      description: 'Most capable model for complex reasoning',
      contextWindow: 8192,
      costPer1kTokens: { input: 0.03, output: 0.06 },
    },
    {
      id: 'gpt-3.5-turbo',
      name: 'GPT-3.5 Turbo',
      description: 'Fast and efficient for most tasks',
      contextWindow: 4096,
      costPer1kTokens: { input: 0.0015, output: 0.002 },
    },
    {
      id: 'gpt-4o',
      name: 'GPT-4o',
      description: 'Omni model - multimodal capabilities',
      contextWindow: 128000,
      costPer1kTokens: { input: 0.005, output: 0.015 },
    },
  ],
  groq: [
    {
      id: 'openai/gpt-oss-120b',
      name: 'openai/gpt-oss-120b',
      description: 'Open-source reasoning model by OpenAI',
      contextWindow: 8192,
    },
    {
      id: 'qwen/qwen3-32b',
      name: 'qwen/qwen3-32b',
      description: 'Fast, open-source mixture of experts model',
      contextWindow: 32768,
    },
    {
      id: 'llama-3.1-8b-instant',
      name: 'Llama 3.1 8B Instant',
      description: 'Lightweight and fast Llama 3.1 model',
      contextWindow: 131072,
    },
  ],
  'azure-openai': [
    {
      id: 'gpt-4',
      name: 'GPT-4',
      description: 'Azure-hosted GPT-4 model',
      contextWindow: 8192,
    },
    {
      id: 'gpt-4-32k',
      name: 'GPT-4 32K',
      description: 'GPT-4 with extended context',
      contextWindow: 32768,
    },
    {
      id: 'gpt-35-turbo',
      name: 'GPT-3.5 Turbo',
      description: 'Azure-hosted GPT-3.5 Turbo',
      contextWindow: 4096,
    },
    {
      id: 'gpt-4-turbo',
      name: 'GPT-4 Turbo',
      description: 'Azure-hosted GPT-4 Turbo with vision',
      contextWindow: 128000,
    },
  ],
  claude: [
    {
      id: 'claude-3-opus-20240229',
      name: 'Claude 3 Opus',
      description: 'Most intelligent model - best for complex tasks',
      contextWindow: 200000,
      costPer1kTokens: { input: 0.015, output: 0.075 },
    },
    {
      id: 'claude-3-sonnet-20240229',
      name: 'Claude 3 Sonnet',
      description: 'Balanced performance and speed',
      contextWindow: 200000,
      costPer1kTokens: { input: 0.003, output: 0.015 },
    },
    {
      id: 'claude-3-haiku-20240307',
      name: 'Claude 3 Haiku',
      description: 'Fastest and most compact',
      contextWindow: 200000,
      costPer1kTokens: { input: 0.00025, output: 0.00125 },
    },
    {
      id: 'claude-2.1',
      name: 'Claude 2.1',
      description: 'Previous version with 100k context',
      contextWindow: 100000,
      costPer1kTokens: { input: 0.008, output: 0.024 },
    },
  ],
  testleaf: [
    {
      id: 'testleaf-sft',
      name: 'TestLeaf SFT',
      description: 'Specialized fine-tuned model for QA automation',
      contextWindow: 8192,
    },
    {
      id: 'testleaf-pro',
      name: 'TestLeaf Pro',
      description: 'Enhanced model with better test case generation',
      contextWindow: 16384,
    },
    {
      id: 'testleaf-enterprise',
      name: 'TestLeaf Enterprise',
      description: 'Enterprise model with advanced analytics',
      contextWindow: 32768,
    },
  ],
};

export const LLM_PROVIDERS: Record<LLMProvider, LLMProviderConfig> = {
  openai: {
    id: 'openai',
    name: 'OpenAI',
    description: 'GPT-4, GPT-3.5 Turbo, and other OpenAI models',
    icon: '🤖',
    models: LLM_MODELS.openai,
    defaultModel: 'gpt-4-turbo',
    endpoint: 'https://api.openai.com/v1',
    apiKeyLabel: 'OpenAI API Key (sk-...)',
    docLink: 'https://platform.openai.com/docs',
  },
  groq: {
    id: 'groq',
    name: 'Groq',
    description: 'Fast inference with Mixtral, Llama, and other open models',
    icon: '⚡',
    models: LLM_MODELS.groq,
    defaultModel: 'mixtral-8x7b-32768',
    endpoint: 'https://api.groq.com/openai/v1',
    apiKeyLabel: 'Groq API Key',
    docLink: 'https://console.groq.com/docs',
  },
  'azure-openai': {
    id: 'azure-openai',
    name: 'Azure OpenAI',
    description: 'Enterprise OpenAI models hosted on Azure',
    icon: '☁️',
    models: LLM_MODELS['azure-openai'],
    defaultModel: 'gpt-4',
    endpoint: 'https://your-resource.openai.azure.com/',
    apiKeyLabel: 'Azure API Key',
    docLink: 'https://learn.microsoft.com/azure/ai-services/openai/',
    additionalFields: [
      {
        name: 'deploymentName',
        label: 'Deployment Name',
        placeholder: 'your-deployment-name',
        required: true,
      },
      {
        name: 'apiVersion',
        label: 'API Version',
        placeholder: '2024-02-15-preview',
        required: true,
      },
    ],
  },
  claude: {
    id: 'claude',
    name: 'Claude',
    description: 'Anthropic Claude models - Claude 3 Opus, Sonnet, Haiku',
    icon: '🧠',
    models: LLM_MODELS.claude,
    defaultModel: 'claude-3-opus-20240229',
    endpoint: 'https://api.anthropic.com',
    apiKeyLabel: 'Claude API Key (sk-ant-...)',
    docLink: 'https://docs.anthropic.com',
  },
  testleaf: {
    id: 'testleaf',
    name: 'TestLeaf',
    description: 'TestLeaf SFT - Specialized for QA test automation',
    icon: '🍃',
    models: LLM_MODELS.testleaf,
    defaultModel: 'testleaf-sft',
    endpoint: 'https://api.testleaf.com/v1',
    apiKeyLabel: 'TestLeaf API Key',
    docLink: 'https://testleaf.com/docs',
  },
};

/**
 * Get provider configuration by provider ID
 * @param provider - The LLM provider ID
 * @returns Provider configuration
 */
export function getLLMProviderConfig(provider: LLMProvider): LLMProviderConfig {
  return LLM_PROVIDERS[provider];
}

/**
 * Get array of model IDs for a specific provider
 * @param provider - The LLM provider ID
 * @returns Array of available models for the provider
 */
export function getModelsByProvider(provider: LLMProvider): LLMModel[] {
  return LLM_MODELS[provider] || [];
}

/**
 * Get model information by provider and model ID
 * @param provider - The LLM provider ID
 * @param modelId - The model ID
 * @returns Model information or undefined
 */
export function getModelInfo(provider: LLMProvider, modelId: string): LLMModel | undefined {
  const models = LLM_MODELS[provider];
  return models?.find(m => m.id === modelId);
}

/**
 * Check if a model is valid for a provider
 * @param provider - The LLM provider ID
 * @param modelId - The model ID
 * @returns True if model is valid for provider
 */
export function isValidModel(provider: LLMProvider, modelId: string): boolean {
  const models = LLM_MODELS[provider];
  return models?.some(m => m.id === modelId) ?? false;
}

/**
 * Get LLM configuration from environment variables
 * @returns Configuration object with providers found in environment
 */
export function getLLMConfigFromEnv(): Record<LLMProvider, LLMConfig | null> {
  const configs: Record<LLMProvider, LLMConfig | null> = {
    openai: null,
    groq: null,
    'azure-openai': null,
    claude: null,
    testleaf: null,
  };

  // Check for OpenAI
  const openaiKey = import.meta.env.VITE_OPENAI_API_KEY;
  if (openaiKey) {
    configs.openai = {
      provider: 'openai',
      apiKey: openaiKey,
      endpoint: 'https://api.openai.com/v1',
      model: 'gpt-4-turbo',
    };
  }

  // Check for Groq
  const groqKey = import.meta.env.VITE_GROQ_API_KEY;
  if (groqKey) {
    configs.groq = {
      provider: 'groq',
      apiKey: groqKey,
      endpoint: import.meta.env.VITE_GROQ_API_ENDPOINT || 'https://api.groq.com/openai/v1',
      model: import.meta.env.VITE_GROQ_DEFAULT_MODEL || 'mixtral-8x7b-32768',
    };
  }

  // Check for Azure OpenAI
  const azureKey = import.meta.env.VITE_AZURE_OPENAI_API_KEY;
  if (azureKey) {
    configs['azure-openai'] = {
      provider: 'azure-openai',
      apiKey: azureKey,
      endpoint: import.meta.env.VITE_AZURE_OPENAI_API_ENDPOINT || '',
      model: import.meta.env.VITE_AZURE_OPENAI_DEFAULT_MODEL || 'gpt-4',
      deploymentName: import.meta.env.VITE_AZURE_OPENAI_DEPLOYMENT_NAME,
      apiVersion: import.meta.env.VITE_AZURE_OPENAI_API_VERSION || '2024-02-15-preview',
    };
  }

  // Check for Claude
  const claudeKey = import.meta.env.VITE_CLAUDE_API_KEY;
  if (claudeKey) {
    configs.claude = {
      provider: 'claude',
      apiKey: claudeKey,
      endpoint: import.meta.env.VITE_CLAUDE_API_ENDPOINT || 'https://api.anthropic.com',
      model: import.meta.env.VITE_CLAUDE_DEFAULT_MODEL || 'claude-3-opus-20240229',
    };
  }

  // Check for TestLeaf
  const testleafKey = import.meta.env.VITE_TESTLEAF_API_KEY;
  if (testleafKey) {
    configs.testleaf = {
      provider: 'testleaf',
      apiKey: testleafKey,
      endpoint: import.meta.env.VITE_TESTLEAF_API_ENDPOINT || 'https://api.testleaf.com/v1',
      model: import.meta.env.VITE_TESTLEAF_DEFAULT_MODEL || 'testleaf-sft',
    };
  }

  return configs;
}

/**
 * Get default LLM configuration based on DEFAULT_LLM_PROVIDER env variable
 * @returns LLMConfig for the default provider or null if not configured
 */
export function getDefaultLLMConfig(): LLMConfig | null {
  const defaultProvider = (import.meta.env.VITE_DEFAULT_LLM_PROVIDER || 'groq') as LLMProvider;
  const allConfigs = getLLMConfigFromEnv();
  const config = allConfigs[defaultProvider];
  
  if (config) {
    return {
      ...config,
      model: import.meta.env.VITE_DEFAULT_LLM_MODEL || config.model,
    };
  }
  
  return null;
}

