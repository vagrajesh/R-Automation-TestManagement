import React from 'react';

export interface PIIDetectionResult {
  hasPII: boolean;
  severity: 'none' | 'low' | 'medium' | 'high';
  detections: Array<{
    type: string;
    value: string;
    severity: 'low' | 'medium' | 'high';
  }>;
  maskedText: string;
  summary: string;
}

interface PIIWarningDialogProps {
  isOpen: boolean;
  piiResult: PIIDetectionResult | null;
  fileName?: string;
  onBlock: () => void;
  onMask: () => void;
  onContinue: () => void;
  isLoading?: boolean;
}

export const PIIWarningDialog: React.FC<PIIWarningDialogProps> = ({
  isOpen,
  piiResult,
  fileName,
  onBlock,
  onMask,
  onContinue,
  isLoading = false,
}) => {
  if (!isOpen || !piiResult) return null;

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'high':
        return 'text-red-600 bg-red-50 border-red-200';
      case 'medium':
        return 'text-orange-600 bg-orange-50 border-orange-200';
      case 'low':
        return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'high':
        return '🚨';
      case 'medium':
        return '⚠️';
      case 'low':
        return 'ℹ️';
      default:
        return '✓';
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"></div>

      {/* Dialog */}
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="relative w-full max-w-md bg-white rounded-lg shadow-xl">
          {/* Header */}
          <div className={`px-6 py-4 border-b border-gray-200 ${getSeverityColor(piiResult.severity)}`}>
            <div className="flex items-center gap-3">
              <span className="text-3xl">{getSeverityIcon(piiResult.severity)}</span>
              <div>
                <h2 className="text-lg font-semibold">
                  {piiResult.hasPII ? 'PII Detected' : 'No PII Detected'}
                </h2>
                {fileName && <p className="text-sm opacity-75 mt-1">{fileName}</p>}
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="px-6 py-4">
            <p className="text-sm text-gray-700 mb-4">{piiResult.summary}</p>

            {piiResult.hasPII && piiResult.detections.length > 0 && (
              <div className="mb-4">
                <h3 className="text-sm font-medium text-gray-900 mb-2">Detected Items:</h3>
                <div className="space-y-1 bg-gray-50 rounded p-3 max-h-32 overflow-y-auto">
                  {piiResult.detections.map((detection: any, idx: number) => (
                    <div key={idx} className="text-xs text-gray-700">
                      <span className="font-medium">{detection.type}:</span>{' '}
                      <span className="text-gray-600 font-mono text-xs">{detection.value}</span>
                      <span
                        className={`ml-2 inline-block px-2 py-0.5 rounded text-xs font-medium ${
                          detection.severity === 'high'
                            ? 'bg-red-100 text-red-800'
                            : detection.severity === 'medium'
                            ? 'bg-orange-100 text-orange-800'
                            : 'bg-yellow-100 text-yellow-800'
                        }`}
                      >
                        {detection.severity}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {piiResult.hasPII && (
              <div className="bg-blue-50 border border-blue-200 rounded p-3 text-xs text-blue-800">
                <strong>Masked Version:</strong>
                <p className="mt-1 font-mono text-xs break-words max-h-20 overflow-y-auto">
                  {piiResult.maskedText}
                </p>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="px-6 py-4 border-t border-gray-200 flex gap-3">
            {piiResult.hasPII ? (
              <>
                <button
                  onClick={onBlock}
                  disabled={isLoading}
                  className="flex-1 px-3 py-2 bg-red-100 text-red-700 rounded hover:bg-red-200 disabled:opacity-50 font-medium text-sm transition"
                  title="Block this content from processing"
                >
                  🚫 Block
                </button>
                <button
                  onClick={onMask}
                  disabled={isLoading}
                  className="flex-1 px-3 py-2 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 disabled:opacity-50 font-medium text-sm transition"
                  title="Mask PII and continue"
                >
                  🔒 Mask
                </button>
                <button
                  onClick={onContinue}
                  disabled={isLoading}
                  className="flex-1 px-3 py-2 bg-green-100 text-green-700 rounded hover:bg-green-200 disabled:opacity-50 font-medium text-sm transition"
                  title="Continue with original content"
                >
                  ✓ Continue
                </button>
              </>
            ) : (
              <button
                onClick={onContinue}
                disabled={isLoading}
                className="w-full px-3 py-2 bg-green-100 text-green-700 rounded hover:bg-green-200 disabled:opacity-50 font-medium text-sm transition"
              >
                ✓ Continue
              </button>
            )}
          </div>

          {isLoading && (
            <div className="absolute inset-0 bg-white bg-opacity-50 rounded-lg flex items-center justify-center">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
