import type { Tracker } from './tracker';

export interface Env {
  DB: D1Database;
  TRACKERS: DurableObjectNamespace<Tracker>;
  APP_URL: string;
  LOCAL_EMAIL: string;
  BETTER_AUTH_SECRET: string;
  RESEND_API_KEY: string;
}
