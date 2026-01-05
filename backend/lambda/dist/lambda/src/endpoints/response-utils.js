"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendError = exports.sendSuccess = void 0;
/**
 * Standardized Success Response
 * @param c Hono Context
 * @param data Data object to return (spread into response)
 * @param message Optional success message
 * @param status HTTP status code (default 200)
 */
const sendSuccess = (c, data = {}, message, status = 200) => {
    return c.json({
        success: true,
        message,
        ...data
    }, status);
};
exports.sendSuccess = sendSuccess;
/**
 * Standardized Error Response
 * @param c Hono Context
 * @param error Error message or object
 * @param status HTTP status code (default 500)
 * @param details Additional error details
 */
const sendError = (c, error, status = 500, details) => {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return c.json({
        success: false,
        error: errorMessage,
        details
    }, status);
};
exports.sendError = sendError;
//# sourceMappingURL=response-utils.js.map