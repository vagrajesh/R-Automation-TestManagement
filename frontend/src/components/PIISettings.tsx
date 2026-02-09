import React, { useState, useEffect } from 'react';
import { PII_MODES, SENSITIVITY_LEVELS, PIIConfig, DEFAULT_PII_CONFIG } from '../config/piiConfig';
import { piiConfigService } from '../services/piiConfigService';

export const PIISettings: React.FC = () => {
  const [config, setConfig] = useState<PIIConfig>(DEFAULT_PII_CONFIG);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      setLoading(true);
      const loadedConfig = await piiConfigService.getConfig();
      setConfig(loadedConfig);
    } catch (error) {
      console.error('Error loading PII config:', error);
      setMessage({ type: 'error', text: 'Failed to load PII configuration' });
    } finally {
      setLoading(false);
    }
  };

  const handleModeChange = async (newMode: PIIConfig['mode']) => {
    const updated = { ...config, mode: newMode };
    setConfig(updated);
    await saveConfig(updated);
  };

  const handleSensitivityChange = async (newLevel: PIIConfig['sensitivityLevel']) => {
    const enabledTypes = SENSITIVITY_LEVELS[newLevel].types;
    const updated = { ...config, sensitivityLevel: newLevel, enabledTypes };
    setConfig(updated);
    await saveConfig(updated);
  };

  const saveConfig = async (updatedConfig: PIIConfig) => {
    try {
      setSaving(true);
      await piiConfigService.updateConfig(updatedConfig);
      setMessage({ type: 'success', text: 'PII configuration saved' });
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      console.error('Error saving PII config:', error);
      setMessage({ type: 'error', text: 'Failed to save PII configuration' });
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    if (window.confirm('Reset PII configuration to defaults?')) {
      try {
        setSaving(true);
        const resetConfig = await piiConfigService.resetConfig();
        setConfig(resetConfig);
        setMessage({ type: 'success', text: 'PII configuration reset to defaults' });
        setTimeout(() => setMessage(null), 3000);
      } catch (error) {
        console.error('Error resetting PII config:', error);
        setMessage({ type: 'error', text: 'Failed to reset PII configuration' });
      } finally {
        setSaving(false);
      }
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        <span className="ml-3 text-gray-600">Loading PII settings...</span>
      </div>
    );
  }

  const currentMode = PII_MODES[config.mode];
  const currentLevel = SENSITIVITY_LEVELS[config.sensitivityLevel];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-2">PII Detection Settings</h2>
        <p className="text-sm text-gray-600">
          Configure how Personally Identifiable Information (PII) is handled during data processing
        </p>
      </div>

      {/* Messages */}
      {message && (
        <div
          className={`p-3 rounded-md text-sm ${
            message.type === 'success'
              ? 'bg-green-50 text-green-800 border border-green-200'
              : 'bg-red-50 text-red-800 border border-red-200'
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Detection Mode */}
      <div className="border rounded-lg p-4">
        <h3 className="text-base font-medium text-gray-900 mb-4">Detection Mode</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {Object.entries(PII_MODES).map(([key, mode]) => (
            <button
              key={key}
              onClick={() => handleModeChange(key as PIIConfig['mode'])}
              disabled={saving}
              className={`p-3 rounded-md border-2 text-left transition-all ${
                config.mode === key
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 bg-white hover:border-gray-300'
              } disabled:opacity-50`}
            >
              <div className="flex items-start gap-2">
                <span className="text-xl mt-0.5">{mode.icon}</span>
                <div className="flex-1">
                  <div className="font-medium text-gray-900">{mode.label}</div>
                  <div className="text-xs text-gray-600 mt-0.5">{mode.description}</div>
                </div>
              </div>
            </button>
          ))}
        </div>
        <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded text-sm text-blue-800">
          <strong>Current: </strong> {currentMode.description}
        </div>
      </div>

      {/* Sensitivity Level */}
      <div className="border rounded-lg p-4">
        <h3 className="text-base font-medium text-gray-900 mb-4">Sensitivity Level</h3>
        <div className="space-y-2">
          {Object.entries(SENSITIVITY_LEVELS).map(([key, level]) => (
            <button
              key={key}
              onClick={() => handleSensitivityChange(key as PIIConfig['sensitivityLevel'])}
              disabled={saving}
              className={`w-full p-3 rounded-md border-2 text-left transition-all ${
                config.sensitivityLevel === key
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 bg-white hover:border-gray-300'
              } disabled:opacity-50`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-medium text-gray-900">{level.label}</div>
                  <div className="text-xs text-gray-600 mt-1">{level.description}</div>
                </div>
                {config.sensitivityLevel === key && (
                  <span className="text-blue-500 font-bold">✓</span>
                )}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Active Settings Summary */}
      <div className="border rounded-lg p-4 bg-gray-50">
        <h3 className="text-base font-medium text-gray-900 mb-3">Active Configuration</h3>
        <div className="space-y-2 text-sm">
          <div>
            <span className="text-gray-600">Mode:</span>
            <span className="ml-2 font-medium text-gray-900">
              {currentMode.icon} {currentMode.label}
            </span>
          </div>
          <div>
            <span className="text-gray-600">Sensitivity:</span>
            <span className="ml-2 font-medium text-gray-900">{currentLevel.label}</span>
          </div>
          <div>
            <span className="text-gray-600">Enabled PII Types:</span>
            <div className="mt-1 flex flex-wrap gap-1">
              {config.enabledTypes.map(type => (
                <span
                  key={type}
                  className="inline-block px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded"
                >
                  {type}
                </span>
              ))}
            </div>
          </div>
          {config.autoSave && (
            <div className="text-green-700 text-xs">✓ Auto-save enabled</div>
          )}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-2 pt-4 border-t">
        <button
          onClick={handleReset}
          disabled={saving}
          className="px-4 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 disabled:opacity-50 transition"
        >
          Reset to Defaults
        </button>
        <button
          onClick={loadConfig}
          disabled={saving}
          className="px-4 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 disabled:opacity-50 transition"
        >
          Reload
        </button>
      </div>
    </div>
  );
};
