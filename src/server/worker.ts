import { auth, localInbox } from './auth';
import type { Env } from './env';
export { Tracker } from './tracker';

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === '/api/local-inbox' && env.LOCAL_EMAIL === 'true') {
      return Response.json({ url: localInbox(url.searchParams.get('email') ?? '') }, { headers: { 'Cache-Control': 'no-store' } });
    }
    if (url.pathname.startsWith('/api/auth/')) return auth(env).handler(request);
    if (url.pathname === '/api/session') {
      return Response.json(await auth(env).api.getSession({ headers: request.headers }), { headers: { 'Cache-Control': 'no-store' } });
    }
    return Response.json({ error: 'Not found' }, { status: 404 });
  },
};
