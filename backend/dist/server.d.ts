import 'dotenv/config';
declare global {
    namespace Express {
        interface Session {
            jira?: {
                baseUrl: string;
                email: string;
                apiToken: string;
            };
            servicenow?: {
                instanceUrl: string;
                username: string;
                password: string;
            };
        }
    }
}
/**
 * PII Configuration type for session storage
 */
interface PIIConfig {
    mode: 'disabled' | 'warn' | 'mask' | 'block';
    sensitivityLevel: 'low' | 'medium' | 'high';
    enabledTypes: string[];
    autoSave: boolean;
}
/**
 * Extend Express session to include PII config
 */
declare global {
    namespace Express {
        interface Session {
            piiConfig?: PIIConfig;
        }
    }
}
export {};
//# sourceMappingURL=server.d.ts.map