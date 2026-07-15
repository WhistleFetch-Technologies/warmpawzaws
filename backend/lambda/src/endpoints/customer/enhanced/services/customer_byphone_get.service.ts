import type { Context } from 'hono';
import { createEnhancedApiGatewayEvent, createEnhancedLambdaContext } from '../../shared/hono-lambda-bridge.utils';
import { getByPhoneHandler } from './handler-instances.service';

export async function executecustomerByphoneGet(c: Context) {
    const startTime = Date.now();
    try {
      const phone = c.req.query('phone');
      
      if (!phone) {
        return c.json({ 
          success: false,
          error: { code: 'MISSING_PHONE', message: 'phone parameter is required' }
        }, 400);
      }

      const event = createEnhancedApiGatewayEvent(c.req);
      event.queryStringParameters = Object.fromEntries(new URL(c.req.url, 'http://localhost').searchParams);
      const context = createEnhancedLambdaContext();
      
      try {
        const result: any = await getByPhoneHandler.execute(event, context);
        const body = JSON.parse(result.body);
        const duration = Date.now() - startTime;
        if (duration > 2000) {
          console.warn(`[by-phone] Slow response: ${duration}ms for phone ${phone.substring(0, 4)}****`);
        }
        return c.json(body, result.statusCode);
      } catch (error: any) {
        const duration = Date.now() - startTime;
        const errorMessage = error?.message || String(error);
        console.error(`[by-phone] Error after ${duration}ms:`, errorMessage);
        if (errorMessage.includes('connection pool') || errorMessage.includes('too many clients')) {
          console.error('[by-phone] ⚠️ Connection pool exhausted');
        }
        return c.json({ success: false, customer: null }, 200);
      }
    } catch (error: any) {
      const duration = Date.now() - startTime;
      console.error(`[by-phone] Error after ${duration}ms:`, error?.message || error);
      return c.json({ success: false, customer: null }, 200);
    }
}
