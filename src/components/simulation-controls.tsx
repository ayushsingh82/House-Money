"use client";

import { Pause, Play, RotateCcw, StepForward } from "lucide-react";
import { useSimulation } from "@/components/simulation-provider";

const btn =
  "inline-flex items-center gap-2 rounded-lg border px-3.5 py-2 text-sm font-medium transition-colors hover:bg-muted disabled:opacity-40 disabled:hover:bg-transparent";

export function SimulationControls() {
  const { scenario, playing, toggle, step, reset, speed, setSpeed } = useSimulation();
  const done = scenario?.done ?? false;
  return (
    <div className="mb-6 flex flex-wrap items-center gap-2">
      <button onClick={toggle} disabled={!scenario} className="inline-flex items-center gap-2 rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-40">
        {playing ? <Pause className="size-4" /> : <Play className="size-4" />}
        {playing ? "Pause" : done ? "Replay" : "Start"}
      </button>
      <button onClick={step} disabled={!scenario || done || playing} className={btn}>
        <StepForward className="size-4" /> Step
      </button>
      <button onClick={reset} disabled={!scenario} className={btn}>
        <RotateCcw className="size-4" /> Reset
      </button>
      <div className="ml-1 flex items-center gap-1 rounded-lg border p-0.5">
        {[1, 4, 12].map((n) => (
          <button
            key={n}
            onClick={() => setSpeed(n)}
            className={`rounded-md px-2.5 py-1 font-mono text-xs ${speed === n ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground"}`}
          >
            {n}×
          </button>
        ))}
      </div>
      {scenario && (
        <span className="ml-1 font-mono text-xs text-muted-foreground">
          step {scenario.index} / {scenario.totalSteps}
        </span>
      )}
    </div>
  );
}
