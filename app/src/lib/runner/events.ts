export type RunnerEvent =
  | { type: "tick"; at: string; equityMicroUsd: string; principalMicroUsd: string }
  | { type: "price_unavailable"; at: string; assetId: string; reason: string }
  | { type: "trigger"; at: string; equityMicroUsd: string; principalMicroUsd: string }
  | { type: "withdraw_queued"; at: string; correlationId: string; executeAfter?: string }
  | { type: "withdraw_settled"; at: string; correlationId: string }
  | { type: "withdraw_failed"; at: string; correlationId: string; failureCode?: string }
  | { type: "refused"; at: string; code: string }
  | { type: "error"; at: string; message: string };

type Listener = (event: RunnerEvent) => void;

/** In-memory event log with subscribers; the dashboard reads from this. */
export class EventLog {
  readonly events: RunnerEvent[] = [];
  private listeners = new Set<Listener>();

  emit(event: RunnerEvent) {
    this.events.push(event);
    for (const l of this.listeners) l(event);
  }

  subscribe(l: Listener) {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  }

  ofType<T extends RunnerEvent["type"]>(type: T) {
    return this.events.filter((e): e is Extract<RunnerEvent, { type: T }> => e.type === type);
  }
}
