const BASE_URL = 'http://localhost:3001/api';

class RagApiService {
  // Test Generation Methods
  async generateTests(endpoint: string, count: number = 2, type: string = 'both') {
    const response = await fetch(`${BASE_URL}/tests/generate-rag`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ endpoint, count, type })
    });
    return response.json();
  }

  async generateTestsFromDocument(content: string, endpoint?: string, count: number = 2, type: string = 'both') {
    const response = await fetch(`${BASE_URL}/tests/generate-document`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content, endpoint, count, type })
    });
    return response.json();
  }

  async generateTestsFromFile(file: File, endpoint?: string, count: number = 2, type: string = 'both') {
    const formData = new FormData();
    formData.append('file', file);
    if (endpoint) formData.append('endpoint', endpoint);
    formData.append('count', count.toString());
    formData.append('type', type);

    const response = await fetch(`${BASE_URL}/tests/generate-file`, {
      method: 'POST',
      body: formData
    });
    return response.json();
  }

  async generateTestsFromUrl(url: string, endpoint?: string, count: number = 2, type: string = 'both') {
    const response = await fetch(`${BASE_URL}/tests/generate-url`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, endpoint, count, type })
    });
    return response.json();
  }

  async generateTestsFromPrompt(prompt: string, endpoint?: string, count: number = 2, type: string = 'both') {
    const response = await fetch(`${BASE_URL}/tests/generate-prompt`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, endpoint, count, type })
    });
    return response.json();
  }

  // Document Management Methods
  async ingestDocument(file: File) {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(`${BASE_URL}/documents/ingest`, {
      method: 'POST',
      body: formData
    });
    return response.json();
  }

  async searchRAG(query: string, mode: string = 'hybrid', limit: number = 5) {
    const response = await fetch(`${BASE_URL}/rag/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, mode, limit })
    });
    return response.json();
  }
}

export const ragApiService = new RagApiService();
