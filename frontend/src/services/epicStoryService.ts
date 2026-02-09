import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';

export interface Epic {
  id: string;
  title: string;
  description: string;
  stories: UserStory[];
}

export interface UserStory {
  id: string;
  title: string;
  description: string;
  acceptanceCriteria: string[];
  role?: string;
  action?: string;
  benefit?: string;
}

export interface ProcessingResult {
  epics: Epic[];
  metadata: {
    processedAt: string;
    fileName: string;
    processorType: 'vision' | 'xml' | 'markdown';
    modelUsed?: string;
    provider?: string;
  };
}

export interface UploadResponse {
  success: boolean;
  data: ProcessingResult;
  fileInfo: {
    name: string;
    size: number;
    type: string;
    mimeType: string;
  };
  piiDetection?: {
    hasPII: boolean;
    severity: 'none' | 'low' | 'medium' | 'high';
    detections: Array<{
      type: string;
      value: string;
      severity: 'low' | 'medium' | 'high';
    }>;
    maskedText: string;
    summary: string;
  };
}

export interface ExportCredentials {
  jira?: {
    baseUrl: string;
    email: string;
    apiToken: string;
    projectKey: string;
  };
  servicenow?: {
    instanceUrl: string;
    username: string;
    password: string;
  };
}

export interface ExportResult {
  success: boolean;
  platform: 'jira' | 'servicenow';
  created: Array<{
    localId: string;
    remoteId: string;
    type: 'epic' | 'story';
    title: string;
    url?: string;
  }>;
  failed: Array<{
    localId: string;
    title: string;
    error: string;
  }>;
  summary: {
    totalEpics: number;
    totalStories: number;
    createdEpics: number;
    createdStories: number;
    failedCount: number;
  };
}

export interface IntegrationConfig {
  defaultPlatform: 'jira' | 'servicenow';
  jira: {
    configured: boolean;
    baseUrl?: string;
    email?: string;
  };
  servicenow: {
    configured: boolean;
    instanceUrl?: string;
    username?: string;
  };
}

/**
 * Upload a file and process it to extract epics and stories
 */
export async function uploadFile(file: File): Promise<UploadResponse> {
  const formData = new FormData();
  formData.append('file', file);

  const response = await axios.post(`${API_BASE_URL}/api/files/upload`, formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });

  return response.data;
}

/**
 * Upload multiple files in batch
 */
export async function uploadBatchFiles(files: File[]): Promise<{
  success: boolean;
  processed: number;
  failed: number;
  results: UploadResponse[];
  errors: Array<{ fileName: string; error: string }>;
}> {
  const formData = new FormData();
  files.forEach((file) => {
    formData.append('files', file);
  });

  const response = await axios.post(`${API_BASE_URL}/api/files/upload-batch`, formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });

  return response.data;
}

/**
 * Get supported file types and processor information
 */
export async function getSupportedTypes(): Promise<{
  success: boolean;
  supportedTypes: {
    images: { extensions: string[]; mimeTypes: string[]; processor: string; description: string };
    xml: { extensions: string[]; mimeTypes: string[]; processor: string; description: string };
    markdown: { extensions: string[]; mimeTypes: string[]; processor: string; description: string };
  };
  limits: {
    maxFileSize: string;
    maxBatchFiles: number;
  };
}> {
  const response = await axios.get(`${API_BASE_URL}/api/files/supported-types`);
  return response.data;
}

/**
 * Get processor status and health
 */
export async function getProcessorStatus(): Promise<{
  success: boolean;
  processors: {
    visionProcessor: { name: string; status: string; provider: string; model: string };
    arisParser: { name: string; status: string; backend: string };
    markdownParser: { name: string; status: string; backend: string };
  };
}> {
  const response = await axios.get(`${API_BASE_URL}/api/files/processors/status`);
  return response.data;
}

/**
 * Get integration configuration from backend
 */
export async function getIntegrationConfig(): Promise<IntegrationConfig> {
  const response = await axios.get(`${API_BASE_URL}/api/files/integration-config`);
  return response.data.data;
}

/**
 * Export epics and stories to Jira
 * If credentials not provided, uses default connection from backend env
 */
export async function exportToJira(
  epics: Epic[],
  projectKey: string,
  credentials?: ExportCredentials['jira']
): Promise<{ success: boolean; data: ExportResult }> {
  const response = await axios.post(`${API_BASE_URL}/api/files/export/jira`, {
    epics,
    projectKey,
    credentials,
  });

  return response.data;
}

/**
 * Export epics and stories to ServiceNow
 * If credentials not provided, uses default connection from backend env
 */
export async function exportToServiceNow(
  epics: Epic[],
  credentials?: ExportCredentials['servicenow']
): Promise<{ success: boolean; data: ExportResult }> {
  const response = await axios.post(`${API_BASE_URL}/api/files/export/servicenow`, {
    epics,
    credentials,
  });

  return response.data;
}
