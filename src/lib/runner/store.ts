export type RunnerState = {
  /** True once the principal withdrawal was accepted by the API. Never reset. */
  banked: boolean;
  withdrawalId?: string;
  bankedAt?: string;
  /** True once the withdrawal's settlement event was emitted. */
  settledReported?: boolean;
};

export interface StateStore {
  load(): Promise<RunnerState>;
  save(state: RunnerState): Promise<void>;
}

export class MemoryStateStore implements StateStore {
  constructor(private state: RunnerState = { banked: false }) {}
  async load() {
    return { ...this.state };
  }
  async save(state: RunnerState) {
    this.state = { ...state };
  }
}
