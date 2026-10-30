import { useCallback, useEffect, useRef, useState } from "react";
import {
  decodeDataset,
  type Command,
  type Dataset,
} from "@weight-logic/domain";

export async function requestJournal(command?: Command, signal?: AbortSignal) {
  const response = await fetch("/api/tracker", {
    signal,
    ...(command
      ? {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Timezone": Intl.DateTimeFormat().resolvedOptions().timeZone,
          },
          body: JSON.stringify(command),
        }
      : {}),
  });
  const value: unknown = await response.json().catch(() => null);
  if (!response.ok)
    throw new Error(
      value &&
        typeof value === "object" &&
        "error" in value &&
        typeof value.error === "string"
        ? value.error
        : "Could not access your journal. Please try again.",
    );
  return decodeDataset(value);
}

export function useJournal() {
  const [data, setData] = useState<Dataset | null>(null);
  const [error, setError] = useState("");
  const reading = useRef<AbortController | null>(null);
  const writing = useRef(false);
  const load = useCallback(async () => {
    if (writing.current) return;
    reading.current?.abort();
    const controller = new AbortController();
    reading.current = controller;
    setError("");
    try {
      const next = await requestJournal(undefined, controller.signal);
      if (!controller.signal.aborted) setData(next);
    } catch (cause) {
      if (!controller.signal.aborted)
        setError(
          cause instanceof Error
            ? cause.message
            : "Could not load your journal.",
        );
    }
  }, []);
  useEffect(() => {
    void load();
    return () => reading.current?.abort();
  }, [load]);
  const mutate = async (command: Command) => {
    if (writing.current)
      throw new Error("A change is still saving. Please try again.");
    writing.current = true;
    reading.current?.abort();
    try {
      setData(await requestJournal(command));
    } finally {
      writing.current = false;
    }
  };
  return { data, error, load, mutate };
}
export type Mutate = (command: Command) => Promise<void>;
