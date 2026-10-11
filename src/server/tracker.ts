import { DurableObject } from "cloudflare:workers";
import {
  applyCommand,
  decodeCommand,
  decodeDataset,
  emptyDataset,
  type Dataset,
} from "@weight-logic/domain";
import type { Env } from "./env";

export class Tracker extends DurableObject<Env> {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    ctx.storage.sql.exec(
      "CREATE TABLE IF NOT EXISTS tracker (id INTEGER PRIMARY KEY CHECK(id = 1), data TEXT NOT NULL)",
    );
  }

  read(): Dataset {
    const row = this.ctx.storage.sql
      .exec<{ data: string }>("SELECT data FROM tracker WHERE id = 1")
      .toArray()[0];
    return row ? decodeDataset(JSON.parse(row.data)) : emptyDataset();
  }

  execute(input: unknown, today: string) {
    let command;
    try {
      command = decodeCommand(input);
    } catch {
      return {
        ok: false as const,
        error: "Invalid data. Check dates, amounts, and the backup format.",
      };
    }
    return this.ctx.storage.transactionSync(() => {
      let next: Dataset;
      try {
        next = applyCommand(this.read(), command, today);
      } catch (error) {
        return {
          ok: false as const,
          error:
            error instanceof Error ? error.message : "Could not apply change.",
        };
      }
      const json = JSON.stringify(next);
      if (new TextEncoder().encode(json).length > 1_500_000)
        return {
          ok: false as const,
          error:
            "This dataset exceeds the 1.5 MB storage limit. Export your data before reducing it.",
        };
      this.ctx.storage.sql.exec(
        "INSERT INTO tracker(id, data) VALUES (1, ?) ON CONFLICT(id) DO UPDATE SET data = excluded.data",
        json,
      );
      return { ok: true as const, data: next };
    });
  }
}
