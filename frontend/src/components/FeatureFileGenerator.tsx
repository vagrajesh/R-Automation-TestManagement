import { useState } from 'react';
import { FileText, Download, Copy, Check, X, AlertCircle, Loader, Sparkles } from 'lucide-react';
import { featureFileService } from '../services/featureFileService';
import type { Story } from '../services/integrationService';
import type { LLMProvider } from '../config/llmConfig';

interface GeneratedTestCase {
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

interface FeatureFileGeneratorProps {
  testCases: GeneratedTestCase[];
  story: Story | null;
  onClose: () => void;
  currentLLMProvider: LLMProvider;
}

export function FeatureFileGenerator({
  testCases,
  story,
  onClose,
  currentLLMProvider,
}: FeatureFileGeneratorProps) {
  const [featureName, setFeatureName] = useState(story?.title || 'Feature');
  const [generatedContent, setGeneratedContent] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async () => {
    try {
      setError(null);
      setLoading(true);

      try {
        // Always try LLM-powered generation first
        const response = await featureFileService.generateViaLLM(
          {
            testCases,
            story,
            featureName,
          },
          currentLLMProvider
        );
        setGeneratedContent(response.featureFile);
      } catch (llmError) {
        // Fallback to local generation if LLM fails
        console.warn('LLM generation failed, falling back to local generation:', llmError);
        const content = featureFileService.generateScenarioOutline({
          testCases,
          story,
          featureName,
        });
        setGeneratedContent(content);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate feature file');
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = () => {
    if (generatedContent) {
      const filename = `${featureName.toLowerCase().replace(/\s+/g, '_')}.feature`;
      featureFileService.downloadFeatureFile(generatedContent, filename);
    }
  };

  const handleCopy = async () => {
    if (generatedContent) {
      try {
        await featureFileService.copyToClipboard(generatedContent);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch (err) {
        setError('Failed to copy to clipboard');
      }
    }
  };

  const stats = generatedContent ? featureFileService.getFileStats(generatedContent) : null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-slate-100 border-b border-slate-300 p-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <FileText className="w-6 h-6 text-blue-600" />
            <h2 className="text-xl font-bold text-slate-900">Generate Gherkin Feature File</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-200 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Configuration */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Feature Name</label>
              <input
                type="text"
                value={featureName}
                onChange={(e) => setFeatureName(e.target.value)}
                placeholder="e.g., User Authentication"
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {error && (
              <div className="flex gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <div>{error}</div>
              </div>
            )}

            <button
              onClick={handleGenerate}
              disabled={loading}
              className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 transition-colors font-semibold flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader className="w-4 h-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Generate Feature File
                </>
              )}
            </button>
          </div>

          {/* AI Generation Info */}
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="w-4 h-4 text-blue-600" />
              <span className="font-semibold text-slate-900">AI-Powered Generation</span>
            </div>
            <div className="text-sm text-slate-700">
              Generating with <span className="font-semibold">{currentLLMProvider.toUpperCase()}</span> provider
            </div>
            <div className="text-xs text-slate-600 mt-2">
              Enhanced scenarios using LLM provider. Falls back to local generation if needed.
            </div>
          </div>

          {/* Generated Content */}
          {generatedContent && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-slate-900">Generated Feature File</h3>
                  <p className="text-sm text-slate-600 mt-1">
                    {stats?.lines} lines · {stats?.size} · {stats?.scenarios} scenario(s)
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleCopy}
                    className="flex items-center gap-2 px-4 py-2 bg-slate-200 text-slate-900 rounded-lg hover:bg-slate-300 transition-colors text-sm font-medium"
                  >
                    {copied ? (
                      <>
                        <Check className="w-4 h-4" />
                        Copied!
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4" />
                        Copy
                      </>
                    )}
                  </button>
                  <button
                    onClick={handleDownload}
                    className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium"
                  >
                    <Download className="w-4 h-4" />
                    Download
                  </button>
                </div>
              </div>

              <div className="bg-slate-900 text-slate-50 rounded-lg p-4 overflow-x-auto font-mono text-sm">
                <pre className="whitespace-pre-wrap break-words">{generatedContent}</pre>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
