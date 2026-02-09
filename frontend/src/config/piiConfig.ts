/**
 * PII Detection Configuration
 * Defines types, modes, and default settings for PII detection
 */

export type PIIDetectionMode = 'block' | 'mask' | 'warn' | 'disabled';
export type SensitivityLevel = 'low' | 'medium' | 'high';

export interface PIIConfig {
  mode: PIIDetectionMode;
  sensitivityLevel: SensitivityLevel;
  enabledTypes: string[];
  autoSave: boolean;
}

export const PII_MODES = {
  disabled: {
    value: 'disabled',
    label: 'Disabled',
    description: 'No PII detection',
    icon: '⊘',
    color: 'gray',
  },
  warn: {
    value: 'warn',
    label: 'Warn',
    description: 'Alert user if PII found, let them decide',
    icon: '⚠️',
    color: 'amber',
  },
  mask: {
    value: 'mask',
    label: 'Mask',
    description: 'Automatically replace PII with tokens',
    icon: '🔒',
    color: 'blue',
  },
  block: {
    value: 'block',
    label: 'Block',
    description: 'Reject if PII found (most secure)',
    icon: '🚫',
    color: 'red',
  },
};

export const SENSITIVITY_LEVELS = {
  low: {
    value: 'low',
    label: 'Low',
    description: 'Detect: Email, Phone',
    types: ['email', 'phone'],
  },
  medium: {
    value: 'medium',
    label: 'Medium',
    description: 'Detect: Email, Phone, SSN, Credit Card, Bank Account, Passport, DOB, License',
    types: ['email', 'phone', 'ssn', 'creditCard', 'bankAccount', 'passport', 'dob', 'driverLicense', 'ipAddress'],
  },
  high: {
    value: 'high',
    label: 'High',
    description: 'Detect: All PII types including personal names',
    types: ['email', 'phone', 'ssn', 'creditCard', 'ipAddress', 'bankAccount', 'passport', 'dob', 'personalName', 'driverLicense'],
  },
};

export const DEFAULT_PII_CONFIG: PIIConfig = {
  mode: 'warn',
  sensitivityLevel: 'medium',
  enabledTypes: SENSITIVITY_LEVELS.medium.types,
  autoSave: true,
};

export const PII_CONFIG_KEY = 'pii-detection-config';
export const PII_SESSION_KEY = 'pii-session-config';

export interface PIIWarningResult {
  action: 'block' | 'mask' | 'continue';
  maskedContent?: string;
}
