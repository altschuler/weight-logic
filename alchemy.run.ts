import * as Alchemy from 'alchemy';
import * as Cloudflare from 'alchemy/Cloudflare';
import { Effect, Redacted } from 'effect';
import type { Tracker } from './src/server/tracker';

const local = process.env.ALCHEMY_DEV === 'true';
const secret = (name: string) => {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name}`);
  return Redacted.make(value);
};
const DB = Cloudflare.D1.Database('Auth', { migrations: './migrations' });
const TRACKERS = Cloudflare.DurableObject<Tracker>('Trackers', { className: 'Tracker' });

export default Alchemy.Stack('weightlogic', {
  providers: Cloudflare.providers(),
  state: Alchemy.localState(),
}, Effect.gen(function* () {
  const app = yield* Cloudflare.Worker('App', {
    main: './src/server/worker.ts',
    dev: { port: 8787, strictPort: true },
    ...(!local ? { domain: 'weightlogic.app', assets: { directory: './dist', notFoundHandling: 'single-page-application' as const, runWorkerFirst: ['/api/*'] } } : {}),
    env: {
      DB, TRACKERS,
      APP_URL: local ? 'http://localhost:5173' : 'https://weightlogic.app',
      LOCAL_EMAIL: local ? 'true' : 'false',
      BETTER_AUTH_SECRET: local ? 'local-only-weight-logic-secret-do-not-deploy-12345' : secret('BETTER_AUTH_SECRET'),
      RESEND_API_KEY: local ? '' : secret('RESEND_API_KEY'),
    },
  });
  return { url: app.url };
}));
