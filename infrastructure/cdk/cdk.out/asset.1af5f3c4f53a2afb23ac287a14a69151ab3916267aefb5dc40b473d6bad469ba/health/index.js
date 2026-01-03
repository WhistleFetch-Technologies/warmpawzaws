"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = void 0;
/**
 * Health check endpoint
 * Returns service status and basic information
 */
const handler = async (event) => {
    try {
        const healthStatus = {
            status: 'healthy',
            timestamp: new Date().toISOString(),
            service: 'warmpawz-api',
            version: '1.0.0',
            environment: process.env.NODE_ENV || 'development',
            checks: {
                database: 'connected', // TODO: Add actual database health check
                s3: 'connected', // TODO: Add actual S3 health check
            },
        };
        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
            },
            body: JSON.stringify(healthStatus),
        };
    }
    catch (error) {
        console.error('Health check failed:', error);
        return {
            statusCode: 500,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
            },
            body: JSON.stringify({
                status: 'unhealthy',
                error: error instanceof Error ? error.message : 'Unknown error',
            }),
        };
    }
};
exports.handler = handler;
//# sourceMappingURL=index.js.map