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
//# sourceMappingURL=server.d.ts.map