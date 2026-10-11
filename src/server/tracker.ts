import { DurableObject } from 'cloudflare:workers';

export class Tracker extends DurableObject {
  ping() { return 'ready'; }
}
