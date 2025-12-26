// Minimal test to isolate boot error
import { Hono } from 'npm:hono@4';
import { cors } from 'npm:hono@4/cors';

const app = new Hono();
app.use('*', cors({ origin: '*' }));
app.get('/health', (c) => c.json({ status: 'ok' }));

console.info('[make-server-core-test] starting');

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: { 'Access-Control-Allow-Origin': '*' } });
  }
  return await app.fetch(req);
});

