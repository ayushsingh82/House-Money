"use client";

import { createContext, useCallback, useContext, useEffect, useReducer, useRef, useState, type ReactNode } from "react";
import { AgentApiError } from "@/lib/errors";
import type { RunnerEvent } from "@/lib/runner/events";
import { runRefusalMatrix, type RefusalCheck } from "@/lib/simulation/refusals";
import { SIM_AGENT, HouseMoneySimulation } from "@/lib/simulation/scenario";

export type Attempt = { t: number; label: string; code: string | null };

type Simulation = {
  scenario: HouseMoneySimulation | null;
  playing: boolean;
  speed: number;
  setSpeed: (n: number) => void;
  toggle: () => void;
  step: () => void;
  reset: () => void;
  attempts: Attempt[];
  attempt: (label: string, fn: () => Promise<unknown>) => Promise<void>;
  matrix: RefusalCheck[] | null;
  runMatrix: () => Promise<void>;
  cancelExit: () => Promise<void>;
  /** Seconds into the simulated run for an event. */
  eventT: (e: RunnerEvent) => number;
};

const Ctx = createContext<Simulation | null>(null);

export function useSimulation() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useSimulation outside SimulationProvider");
  return v;
}

/** Holds one HouseMoneySimulation across page navigations and drives it on a timer. */
export function SimulationProvider({ children }: { children: ReactNode }) {
  const ref = useRef<HouseMoneySimulation | null>(null);
  const busy = useRef(false);
  const [, rerender] = useReducer((n: number) => n + 1, 0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(4);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [matrix, setMatrix] = useState<RefusalCheck[] | null>(null);

  const reset = useCallback(async () => {
    setPlaying(false);
    setAttempts([]);
    setMatrix(null);
    const s = await new HouseMoneySimulation().init();
    ref.current = s;
    rerender();
  }, []);

  useEffect(() => {
    let live = true;
    void reset().then(() => {
      // `?auto` autoplays at 12x, for kiosks and screenshots.
      if (live && new URLSearchParams(window.location.search).has("auto")) {
        setSpeed(12);
        setPlaying(true);
      }
    });
    return () => {
      live = false;
    };
  }, [reset]);

  const step = useCallback(async () => {
    const s = ref.current;
    if (!s || busy.current) return;
    busy.current = true;
    try {
      if (!(await s.step())) setPlaying(false);
    } finally {
      busy.current = false;
      rerender();
    }
  }, []);

  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => void step(), 1000 / speed);
    return () => clearInterval(id);
  }, [playing, speed, step]);

  const toggle = useCallback(() => {
    if (playing) return setPlaying(false);
    if (ref.current?.done) void reset().then(() => setPlaying(true));
    else setPlaying(true);
  }, [playing, reset]);

  const attempt = useCallback(async (label: string, fn: () => Promise<unknown>) => {
    let code: string | null = null;
    try {
      await fn();
    } catch (e) {
      code = e instanceof AgentApiError ? e.code : String(e);
    }
    const t = ref.current?.timeline.at(-1)?.t ?? 0;
    setAttempts((a) => [{ t, label, code }, ...a]);
  }, []);

  const runMatrix = useCallback(async () => {
    if (!ref.current) return;
    setMatrix(await runRefusalMatrix(ref.current));
    rerender();
  }, []);

  const cancelExit = useCallback(async () => {
    const s = ref.current;
    if (!s) return;
    const [op] = await s.api.listScheduledExecutions(SIM_AGENT);
    if (op) await s.api.cancelExecution(SIM_AGENT, op.correlation_id);
    await s.runner.tick();
    rerender();
  }, []);

  const eventT = useCallback(
    (e: RunnerEvent) => Math.round((Date.parse(e.at) - (ref.current?.startMs ?? 0)) / 1000),
    [],
  );

  return (
    <Ctx.Provider
      value={{
        scenario: ref.current,
        playing,
        speed,
        setSpeed,
        toggle,
        step: () => void step(),
        reset: () => void reset(),
        attempts,
        attempt,
        matrix,
        runMatrix,
        cancelExit,
        eventT,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}
