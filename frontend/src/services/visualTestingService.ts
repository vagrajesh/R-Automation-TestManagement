const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';

export interface Project {
  id: string;
  name: string;
  baseUrl: string;
  config: {
    diffThreshold: number;
    aiEnabled: boolean;
  };
  createdAt: string;
  updatedAt: string;
  isActive: boolean;
}

export interface Baseline {
  id: string;
  projectId: string;
  name: string;
  image: string;
  metadata: {
    viewport: { width: number; height: number };
    url: string;
    timestamp: string;
  };
  version: number;
  isActive: boolean;
  tags?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface TestRun {
  id: string;
  projectId: string;
  status: 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'FAILED';
  priority: 'HIGH' | 'NORMAL' | 'LOW';
  config: {
    url: string;
    viewport: { width: number; height: number };
  };
  retryCount: number;
  maxRetries: number;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  diffResult?: {
    isDifferent: boolean;
    confidence: number;
    method: string;
    explanation: string;
    aiExplanation?: any;
    diffImage?: string;
    pixelAnalysis: {
      similarityScore: number;
      mismatchPercentage: number;
      confidence: number;
    };
    aiAnalysis?: {
      similarityScore: number;
      confidence: number;
    };
    changes: Array<{
      type: string;
      description: string;
      severity: string;
    }>;
  };
}

export class VisualTestingService {
  // Projects
  async createProject(data: {
    name: string;
    baseUrl: string;
    diffThreshold?: number;
    aiEnabled?: boolean;
  }): Promise<Project> {
    const response = await fetch(`${API_BASE_URL}/projects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.message || 'Failed to create project');
    return result.data;
  }

  async getProjects(): Promise<Project[]> {
    const response = await fetch(`${API_BASE_URL}/projects`);
    const result = await response.json();
    if (!response.ok) throw new Error(result.message || 'Failed to fetch projects');
    return result.data;
  }

  // Baselines
  async createBaseline(data: {
    projectId: string;
    name: string;
    image?: File;
    viewport: { width: number; height: number };
    url: string;
    tags?: string[];
    dynamicContent?: {
      disableAnimations?: boolean;
      blockAds?: boolean;
      scrollToTriggerLazyLoad?: boolean;
      maskSelectors?: string[];
    };
  }): Promise<Baseline> {
    const formData = new FormData();
    formData.append('projectId', data.projectId);
    formData.append('name', data.name);
    formData.append('viewport', JSON.stringify(data.viewport));
    formData.append('url', data.url);
    if (data.image) formData.append('image', data.image);
    if (data.tags) formData.append('tags', JSON.stringify(data.tags));
    if (data.dynamicContent) formData.append('dynamicContent', JSON.stringify(data.dynamicContent));

    const response = await fetch(`${API_BASE_URL}/baselines`, {
      method: 'POST',
      body: formData,
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.message || 'Failed to create baseline');
    return result.data;
  }

  async getBaselines(projectId: string): Promise<Baseline[]> {
    const response = await fetch(`${API_BASE_URL}/projects/${projectId}/baselines`);
    const result = await response.json();
    if (!response.ok) throw new Error(result.message || 'Failed to fetch baselines');
    return result.data;
  }

  // Tests
  async runTest(data: {
    projectId: string;
    url: string;
    baselineId?: string;
    viewport?: { width: number; height: number };
    priority?: 'HIGH' | 'NORMAL' | 'LOW';
    dynamicContent?: {
      disableAnimations?: boolean;
      blockAds?: boolean;
      scrollToTriggerLazyLoad?: boolean;
      multipleScreenshots?: boolean;
      stabilityCheck?: boolean;
      maskSelectors?: string[];
    };
  }): Promise<{ testId: string; status: string; priority: string }> {
    const response = await fetch(`${API_BASE_URL}/tests/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.message || 'Failed to run test');
    return result.data;
  }

  async getTestStatus(testId: string): Promise<TestRun> {
    const response = await fetch(`${API_BASE_URL}/tests/${testId}`);
    const result = await response.json();
    if (!response.ok) throw new Error(result.message || 'Failed to get test status');
    return result.data;
  }

  async getQueueStatus(): Promise<{
    queued: { HIGH: number; NORMAL: number; LOW: number };
    running: number;
    maxConcurrency: number;
  }> {
    const response = await fetch(`${API_BASE_URL}/queue/status`);
    const result = await response.json();
    if (!response.ok) throw new Error(result.message || 'Failed to get queue status');
    return result.data;
  }

  // Pixel comparison
  async pixelCompare(data: {
    projectId: string;
    baselineId: string;
    currentImage?: string;
    url?: string;
    viewport?: { width: number; height: number };
    waitTime?: number;
    threshold?: number;
  }): Promise<{
    isDifferent: boolean;
    similarityScore: number;
    mismatchPercentage: number;
    diffImage: string;
    metadata: any;
  }> {
    const response = await fetch(`${API_BASE_URL}/pixel/compare`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.message || 'Failed to compare pixels');
    return result.data;
  }

  async quickPixelCompare(data: {
    baselineImage: string;
    currentImage: string;
    threshold?: number;
  }): Promise<{
    isDifferent: boolean;
    similarityScore: number;
    mismatchPercentage: number;
    diffImage: string;
  }> {
    const response = await fetch(`${API_BASE_URL}/pixel/quick-compare`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.message || 'Failed to quick compare');
    return result.data;
  }

  // Health check
  async checkHealth(): Promise<boolean> {
    try {
      const response = await fetch(`${API_BASE_URL}/health`);
      return response.ok;
    } catch {
      return false;
    }
  }
}

export const visualTestingService = new VisualTestingService();