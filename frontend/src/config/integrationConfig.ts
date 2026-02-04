/**
 * Integration Configuration
 * Loads Jira and ServiceNow settings from environment variables
 */

export interface IntegrationConfig {
  jira?: {
    endpoint: string;
    username: string;
    apiKey: string;
  };
  servicenow?: {
    endpoint: string;
    username: string;
    password: string;
  };
}

/**
 * Load integration configurations from environment variables
 * Returns only configured integrations (those with API keys/passwords)
 */
export function getIntegrationConfigFromEnv(): IntegrationConfig {
  const configs: IntegrationConfig = {};

  // Check for Jira
  const jiraKey = import.meta.env.VITE_JIRA_API_KEY;
  if (jiraKey) {
    configs.jira = {
      endpoint: import.meta.env.VITE_JIRA_API_ENDPOINT || '',
      username: import.meta.env.VITE_JIRA_USERNAME || '',
      apiKey: jiraKey,
    };
  }

  // Check for ServiceNow
  const serviceNowPassword = import.meta.env.VITE_SERVICENOW_PASSWORD;
  if (serviceNowPassword) {
    configs.servicenow = {
      endpoint: import.meta.env.VITE_SERVICENOW_API_ENDPOINT || '',
      username: import.meta.env.VITE_SERVICENOW_USERNAME || '',
      password: serviceNowPassword,
    };
  }

  return configs;
}

/**
 * Get Jira config from environment
 */
export function getJiraConfigFromEnv() {
  const config = getIntegrationConfigFromEnv();
  return config.jira;
}

/**
 * Get ServiceNow config from environment
 */
export function getServiceNowConfigFromEnv() {
  const config = getIntegrationConfigFromEnv();
  return config.servicenow;
}

/**
 * Check if Jira is configured
 */
export function isJiraConfigured(): boolean {
  return !!getJiraConfigFromEnv();
}

/**
 * Check if ServiceNow is configured
 */
export function isServiceNowConfigured(): boolean {
  return !!getServiceNowConfigFromEnv();
}
