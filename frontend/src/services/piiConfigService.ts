/**
 * PII Configuration Service
 * Manages PII detection settings locally and on backend
 */

import axios from 'axios';
import {
  PIIConfig,
  DEFAULT_PII_CONFIG,
  PII_CONFIG_KEY,
  PII_SESSION_KEY,
  SENSITIVITY_LEVELS,
} from '../config/piiConfig';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

class PIIConfigService {
  private sessionConfig: PIIConfig | null = null;

  /**
   * Get local PII configuration from localStorage
   */
  getLocalConfig(): PIIConfig {
    try {
      const saved = localStorage.getItem(PII_CONFIG_KEY);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (error) {
      console.error('Error loading local PII config:', error);
    }
    return DEFAULT_PII_CONFIG;
  }

  /**
   * Save PII configuration to localStorage
   */
  saveLocalConfig(config: PIIConfig): void {
    try {
      localStorage.setItem(PII_CONFIG_KEY, JSON.stringify(config));
    } catch (error) {
      console.error('Error saving local PII config:', error);
    }
  }

  /**
   * Get session PII configuration
   */
  getSessionConfig(): PIIConfig {
    if (this.sessionConfig) {
      return this.sessionConfig;
    }
    return this.getLocalConfig();
  }

  /**
   * Set session PII configuration
   */
  setSessionConfig(config: PIIConfig): void {
    this.sessionConfig = config;
  }

  /**
   * Fetch PII configuration from backend
   */
  async fetchFromBackend(): Promise<PIIConfig> {
    try {
      const response = await axios.get<PIIConfig>(`${API_BASE_URL}/api/pii/config`, {
        withCredentials: true
      });
      return response.data;
    } catch (error) {
      console.warn('Failed to fetch PII config from backend, using local:', error);
      return this.getLocalConfig();
    }
  }

  /**
   * Save PII configuration to backend
   */
  async saveToBackend(config: PIIConfig): Promise<PIIConfig> {
    try {
      const response = await axios.post<PIIConfig>(`${API_BASE_URL}/api/pii/config`, config, {
        withCredentials: true
      });
      return response.data;
    } catch (error) {
      console.warn('Failed to save PII config to backend:', error);
      // Still save locally on error
      this.saveLocalConfig(config);
      return config;
    }
  }

  /**
   * Get PII configuration with fallback chain
   */
  async getConfig(): Promise<PIIConfig> {
    // 1. Check session
    if (this.sessionConfig) {
      return this.sessionConfig;
    }

    // 2. Try backend
    try {
      const backendConfig = await this.fetchFromBackend();
      this.sessionConfig = backendConfig;
      return backendConfig;
    } catch (error) {
      // 3. Fall back to local
      const localConfig = this.getLocalConfig();
      this.sessionConfig = localConfig;
      return localConfig;
    }
  }

  /**
   * Update PII configuration (local + backend)
   */
  async updateConfig(updates: Partial<PIIConfig>): Promise<PIIConfig> {
    const current = this.getSessionConfig();
    const updated = { ...current, ...updates };

    // Update session
    this.sessionConfig = updated;

    // Save locally
    this.saveLocalConfig(updated);

    // Try to save to backend
    try {
      await this.saveToBackend(updated);
    } catch (error) {
      console.warn('Failed to sync config to backend:', error);
    }

    return updated;
  }

  /**
   * Call backend PII detection endpoint
   */
  async checkPII(
    content: string,
    config?: PIIConfig
  ): Promise<{
    hasPII: boolean;
    severity: 'none' | 'low' | 'medium' | 'high';
    detections: Array<{
      type: string;
      value: string;
      severity: 'low' | 'medium' | 'high';
    }>;
    maskedText: string;
    summary: string;
  }> {
    try {
      const piiConfig = config || (await this.getConfig());
      const response = await axios.post(`${API_BASE_URL}/api/pii/detect`, {
        content,
        config: piiConfig,
      }, {
        withCredentials: true
      });
      return response.data;
    } catch (error) {
      console.error('Error calling PII detection endpoint:', error);
      throw error;
    }
  }

  /**
   * Get available PII types for current sensitivity level
   */
  getAvailableTypesForLevel(level: PIIConfig['sensitivityLevel']): string[] {
    return SENSITIVITY_LEVELS[level].types;
  }

  /**
   * Reset configuration to defaults
   */
  async resetConfig(): Promise<PIIConfig> {
    this.sessionConfig = DEFAULT_PII_CONFIG;
    this.saveLocalConfig(DEFAULT_PII_CONFIG);
    try {
      await this.saveToBackend(DEFAULT_PII_CONFIG);
    } catch (error) {
      console.warn('Failed to reset config on backend:', error);
    }
    return DEFAULT_PII_CONFIG;
  }

  /**
   * Clear all PII configuration
   */
  clearAll(): void {
    this.sessionConfig = null;
    localStorage.removeItem(PII_CONFIG_KEY);
    localStorage.removeItem(PII_SESSION_KEY);
  }
}

export const piiConfigService = new PIIConfigService();
