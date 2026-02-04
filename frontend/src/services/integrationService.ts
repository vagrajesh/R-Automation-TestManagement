/**
 * Integration Service for ServiceNow and Jira (via Backend)
 * Handles fetching user stories from both platforms through Express backend
 * 
 * Security: Credentials are never stored on frontend - only in server-side sessions
 */

// Get API base URL from environment, defaults to localhost:8080
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';

export interface Story {
  id: string;
  key: string;
  title: string;
  description: string;
  acceptanceCriteria?: string;
  status: string;
  priority: string;
  assignee?: string;
  epicKey?: string;
  epicTitle?: string;
  source: 'jira' | 'servicenow';
}

// Error responses from API
interface ApiError {
  error: string;
}

function isApiError(data: unknown): data is ApiError {
  return typeof data === 'object' && data !== null && 'error' in data;
}

/**
 * Fetch user stories from Jira via backend
 */
export async function fetchJiraStories(): Promise<Story[]> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/jira/stories`, {
      method: 'GET',
      credentials: 'include',
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      const data = await response.json();
      const errorMsg = isApiError(data) ? data.error : `HTTP ${response.status}`;
      throw new Error(`Failed to fetch Jira stories: ${errorMsg}`);
    }

    const data = await response.json() as { stories: Story[] };
    return data.stories || [];
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Failed to fetch Jira stories: Unknown error');
  }
}

/**
 * Fetch incidents/user stories from ServiceNow via backend
 */
export async function fetchServiceNowStories(): Promise<Story[]> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/servicenow/stories`, {
      method: 'GET',
      credentials: 'include',
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      const data = await response.json();
      const errorMsg = isApiError(data) ? data.error : `HTTP ${response.status}`;
      throw new Error(`Failed to fetch ServiceNow stories: ${errorMsg}`);
    }

    const data = await response.json() as { stories: Story[] };
    return data.stories || [];
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Failed to fetch ServiceNow stories: Unknown error');
  }
}

/**
 * Fetch all stories from both Jira and ServiceNow
 */
export async function fetchAllStories(): Promise<Story[]> {
  const results = await Promise.allSettled([fetchJiraStories(), fetchServiceNowStories()]);

  const stories: Story[] = [];

  results.forEach((result) => {
    if (result.status === 'fulfilled') {
      stories.push(...result.value);
    }
  });

  return stories;
}

/**
 * Fetch stories from the default integration only (specified in backend DEFAULT_INTEGRATION env)
 */
export async function fetchDefaultIntegrationStories(defaultIntegration: 'jira' | 'servicenow'): Promise<Story[]> {
  try {
    if (defaultIntegration === 'jira') {
      return await fetchJiraStories();
    } else if (defaultIntegration === 'servicenow') {
      return await fetchServiceNowStories();
    } else {
      return [];
    }
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Failed to fetch stories: Unknown error');
  }
}

/**
 * Connect to Jira via backend
 * Credentials are validated on backend and stored in secure session
 */
export async function connectJira(baseUrl: string, email: string, apiToken: string): Promise<{ success: boolean; message: string; user?: string }> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/jira/connect`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({ baseUrl, email, apiToken }),
    });

    if (!response.ok) {
      const data = await response.json();
      const errorMsg = isApiError(data) ? data.error : `HTTP ${response.status}`;
      return { success: false, message: errorMsg };
    }

    const data = await response.json();
    return { success: true, message: data.message, user: data.user };
  } catch (error) {
    if (error instanceof Error) {
      return { success: false, message: error.message };
    }
    return { success: false, message: 'Connection failed: Unknown error' };
  }
}

/**
 * Connect to ServiceNow via backend
 * Credentials are validated on backend and stored in secure session
 */
export async function connectServiceNow(instanceUrl: string, username: string, password: string): Promise<{ success: boolean; message: string }> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/servicenow/connect`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({ instanceUrl, username, password }),
    });

    if (!response.ok) {
      const data = await response.json();
      const errorMsg = isApiError(data) ? data.error : `HTTP ${response.status}`;
      return { success: false, message: errorMsg };
    }

    const data = await response.json();
    return { success: true, message: data.message };
  } catch (error) {
    if (error instanceof Error) {
      return { success: false, message: error.message };
    }
    return { success: false, message: 'Connection failed: Unknown error' };
  }
}
