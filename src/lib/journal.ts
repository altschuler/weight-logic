import { useCallback, useEffect, useState } from "react";
import { Effect } from "effect";
import {
  decodeDataset,
  type Command,
  type Dataset,
} from "@weight-logic/domain";

export function requestJournal(command?: Command) {
  return Effect.runPromise(
    Effect.tryPromise(async () => {
      const response = await fetch(
        "/api/tracker",
        command
          ? {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "X-Timezone": Intl.DateTimeFormat().resolvedOptions().timeZone,
              },
              body: JSON.stringify(command),
            }
          : undefined,
      );
      const value: unknown = await response.json();
      if (!response.ok)
        throw new Error(
          (value as { error?: string }).error ??
            "Could not save. Please try again.",
        );
      return decodeDataset(value);
    }),
  );
}

export function useJournal() {
  const [data, setData] = useState<Dataset | null>(null);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    setError("");
    try {
      setData(await requestJournal());
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not load your journal.",
      );
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  const mutate = async (command: Command) => {
    const next = await requestJournal(command);
    setData(next);
  };
  return { data, error, load, mutate };
}
export type Mutate = (command: Command) => Promise<void>;
