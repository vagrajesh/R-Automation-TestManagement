import type { Story } from './integrationService';

// Get API base URL from environment, defaults to localhost:8080
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';

export interface GeneratedTestCase {
  id: string;
  name: string;
  short_description: string;
  description: string;
  test_type: string;
  priority: string;
  state: string;
  version?: string;
  steps: Array<{ order: number; step: string; expected_result: string; test_data: string }>;
}

export interface FeatureFileOptions {
  testCases: GeneratedTestCase[];
  story: Story | null;
  featureName?: string;
}

export interface FeatureFileResponse {
  featureFile: string;
  stats: {
    lines: number;
    scenarios: number;
    examplesCount: number;
  };
}

class FeatureFileService {
  /**
   * Generate Scenario Outline Feature File (Bulk test cases with Examples table)
   */
  generateScenarioOutline(options: FeatureFileOptions): string {
    const featureName = options.featureName || options.story?.title || 'Generated Feature';
    const description = options.story?.description || '';
    const epicTitle = options.story?.epicTitle ? `Epic: ${options.story.epicTitle}` : '';

    let content = `Feature: ${featureName}\n`;
    
    if (epicTitle) {
      content += `  ${epicTitle}\n`;
    }
    
    if (description) {
      content += `  ${description}\n`;
    }
    
    content += '\n';

    // Create a single scenario outline from all test cases
    if (options.testCases.length > 0) {
      // Extract Given/When/Then steps from the first test case
      const firstTestCase = options.testCases[0];
      const steps = firstTestCase.steps || [];
      
      // Generate scenario name from first test case description
      const scenarioName = this.generateScenarioName(options.testCases);
      content += `  Scenario Outline: ${scenarioName}\n`;

      // Extract steps and organize by Given/When/Then
      const givenSteps: string[] = [];
      const whenSteps: string[] = [];
      const thenSteps: Array<{ step: string; assertion?: string }> = [];
      const testDataKeys = new Set<string>();

      // Process steps to extract Given/When/Then
      steps.forEach((step, index) => {
        const stepText = step.step.trim();
        const ratio = steps.length > 1 ? index / (steps.length - 1) : 0;

        // Extract potential test data parameters from step text
        const dataMatches = step.test_data?.match(/:\s*(.+?)(?:$|,)/);
        if (dataMatches && dataMatches[1]) {
          const keyMatch = step.test_data.match(/^([^:]+):/);
          if (keyMatch) {
            testDataKeys.add(keyMatch[1].trim());
          }
        }

        // Distribute steps across Given/When/Then based on position
        if (ratio < 0.33) {
          givenSteps.push(stepText);
        } else if (ratio < 0.67) {
          whenSteps.push(stepText);
        } else {
          // For Then steps, include assertion from expected_result
          thenSteps.push({
            step: stepText,
            assertion: step.expected_result?.trim(),
          });
        }
      });

      // Output Given steps
      givenSteps.forEach((step) => {
        content += `    Given ${step}\n`;
      });

      // Output When steps
      whenSteps.forEach((step) => {
        content += `    When ${step}\n`;
      });

      // Output Then steps with split assertions
      thenSteps.forEach((stepObj, idx) => {
        if (idx === 0) {
          content += `    Then ${stepObj.step}\n`;
        } else {
          content += `    And ${stepObj.step}\n`;
        }
        
        // Split and output each assertion as a separate step
        if (stepObj.assertion) {
          const assertions = this.splitAndFormatAssertions(stepObj.assertion);
          assertions.forEach((assertion) => {
            content += `    And ${assertion}\n`;
          });
        }
      });

      // Build Examples table with dynamic columns
      const exampleColumns = this.extractExampleColumns(options.testCases);
      const columnHeaders = Array.from(exampleColumns.keys());

      if (columnHeaders.length > 0) {
        content += '\n    Examples:\n';
        content += `      | ${columnHeaders.join(' | ')} |\n`;

        options.testCases.forEach((testCase) => {
          const values = columnHeaders.map((header) => exampleColumns.get(header)?.get(testCase.id) || '-');
          content += `      | ${values.join(' | ')} |\n`;
        });
      }
    }

    return content;
  }

  /**
   * Extract example columns from test cases
   */
  private extractExampleColumns(
    testCases: GeneratedTestCase[]
  ): Map<string, Map<string, string>> {
    const columns = new Map<string, Map<string, string>>();

    testCases.forEach((testCase) => {
      if (!testCase.steps || testCase.steps.length === 0) return;

      // Extract test data from steps
      testCase.steps.forEach((step) => {
        if (!step.test_data) return;

        // Parse test_data format: "field_name: value" or just "value"
        const parts = step.test_data.split(':');
        if (parts.length === 2) {
          const key = this.sanitizeForTable(parts[0].trim());
          const value = this.sanitizeForTable(parts[1].trim());

          if (!columns.has(key)) {
            columns.set(key, new Map());
          }
          columns.get(key)!.set(testCase.id, value);
        }
      });

      // Add test case metadata columns
      if (!columns.has('test_case')) {
        columns.set('test_case', new Map());
      }
      columns.get('test_case')!.set(testCase.id, this.sanitizeForTable(testCase.name));

      if (!columns.has('expected_result')) {
        columns.set('expected_result', new Map());
      }
      const lastStep = testCase.steps[testCase.steps.length - 1];
      columns.get('expected_result')!.set(testCase.id, this.sanitizeForTable(lastStep?.expected_result || ''));

      if (!columns.has('priority')) {
        columns.set('priority', new Map());
      }
      columns.get('priority')!.set(testCase.id, testCase.priority);

      if (!columns.has('type')) {
        columns.set('type', new Map());
      }
      columns.get('type')!.set(testCase.id, testCase.test_type);
    });

    return columns;
  }

  /**
   * Generate feature file via LLM backend
   */
  async generateViaLLM(options: FeatureFileOptions, llmProvider: string): Promise<FeatureFileResponse> {
    const response = await fetch(`${API_BASE_URL}/api/feature-file/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        testCases: options.testCases,
        story: options.story,
        featureName: options.featureName,
        llmProvider,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to generate feature file via LLM');
    }

    return response.json();
  }

  /**
   * Generate scenario name based on test cases
   */
  private splitAndFormatAssertions(assertionText: string): string[] {
    if (!assertionText) return [];

    // Split by common assertion delimiters: semicolon, "and", period
    const assertions = assertionText
      .split(/[;]|(?:\s+and\s+)|(?:\s*\.\s*)/)
      .map(s => s.trim())
      .filter(s => s.length > 0);

    return assertions.map((assertion) => {
      // Add action verb if missing
      const actionVerbs = ['Verify', 'Check', 'Validate', 'Ensure', 'Confirm', 'Assert', 'Should'];
      const startsWithVerb = actionVerbs.some(verb => 
        assertion.toLowerCase().startsWith(verb.toLowerCase())
      );

      if (!startsWithVerb) {
        // Determine appropriate verb based on assertion content
        if (assertion.toLowerCase().includes('disabled') || assertion.toLowerCase().includes('hidden') || assertion.toLowerCase().includes('not ')) {
          return `Verify ${assertion}`;
        } else if (assertion.toLowerCase().includes('show') || assertion.toLowerCase().includes('display') || assertion.toLowerCase().includes('appear')) {
          return `Verify ${assertion}`;
        } else if (assertion.toLowerCase().includes('error') || assertion.toLowerCase().includes('message')) {
          return `Check ${assertion}`;
        } else {
          return `Verify ${assertion}`;
        }
      }

      return assertion;
    });
  }

  private generateScenarioName(testCases: GeneratedTestCase[]): string {
    if (testCases.length === 1) {
      return `Verify ${testCases[0].name}`;
    }
    const types = [...new Set(testCases.map((tc) => tc.test_type))];
    const typesStr = types.join(' and ');
    return `Execute ${types.length === 1 ? typesStr : 'multiple'} test scenarios`;
  }

  /**
   * Sanitize text for table display
   */
  private sanitizeForTable(text: string): string {
    return text.replace(/\|/g, ' ').replace(/\n/g, ' ').substring(0, 50);
  }

  /**
   * Download feature file
   */
  downloadFeatureFile(content: string, filename: string = 'features.feature'): void {
    const element = document.createElement('a');
    element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(content));
    element.setAttribute('download', filename);
    element.style.display = 'none';
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  }

  /**
   * Copy to clipboard
   */
  async copyToClipboard(content: string): Promise<void> {
    await navigator.clipboard.writeText(content);
  }

  /**
   * Get file statistics
   */
  getFileStats(content: string): { lines: number; size: string; scenarios: number } {
    const lines = content.split('\n').length;
    const scenarios = (content.match(/Scenario Outline:/g) || []).length;
    const bytes = new Blob([content]).size;
    const size =
      bytes < 1024
        ? `${bytes}B`
        : bytes < 1024 * 1024
          ? `${(bytes / 1024).toFixed(2)}KB`
          : `${(bytes / (1024 * 1024)).toFixed(2)}MB`;

    return { lines, size, scenarios };
  }
}

export const featureFileService = new FeatureFileService();
