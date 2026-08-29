"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import {
  loadWorkout,
  completeWorkout,
  getWarmupActivities,
  getPerformanceReport,
  type WorkoutData,
  type ExerciseWithRec,
  type PerformanceReport as ReportType,
} from "./actions";

import WakeLockProvider from "./components/WakeLockProvider";
import LocationGate from "./components/LocationGate";
import WarmupSection from "./components/WarmupSection";
import WorkoutHeader from "./components/WorkoutHeader";
import WeightControl from "./components/WeightControl";
import RepsControl from "./components/RepsControl";
import RirSelector from "./components/RirSelector";
import SwipeableSetRow from "./components/SwipeableSetRow";
import RestTimer from "./components/RestTimer";
import ExerciseNav from "./components/ExerciseNav";
import ExerciseManager from "./components/ExerciseManager";
import PerformanceReport from "./components/PerformanceReport";
import NotificationSetup from "./components/NotificationSetup";

// ─── Types ───────────────────────────────────────────────

type SetState = {
  reps: number;
  rir: number | null;
  completed: boolean;
};

type ExerciseState = {
  weight: number;
  sets: SetState[];
};

type Phase =
  | "loading"
  | "location"
  | "warmup"
  | "workout"
  | "report";

// ─── Helpers ─────────────────────────────────────────────

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0");
  const s = (seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

// ─── Main Page ───────────────────────────────────────────

export default function Home() {
  // Core state
  const [phase, setPhase] = useState<Phase>("loading");
  const [workout, setWorkout] = useState<WorkoutData | null>(null);
  const [warmupActivities, setWarmupActivities] = useState<
    { id: number; name: string; duration: number }[]
  >([]);
  const [error, setError] = useState("");

  // Workout state
  const [exerciseIndex, setExerciseIndex] = useState(0);
  const [logs, setLogs] = useState<Record<number, ExerciseState>>({});
  const [saving, setSaving] = useState(false);

  // Rest timer
  const [restActive, setRestActive] = useState(false);
  const [restSeconds, setRestSeconds] = useState(90);

  // Exercise manager
  const [managerOpen, setManagerOpen] = useState(false);

  // ─── Load workout on mount ─────────────────────────────

  useEffect(() => {
    async function init() {
      try {
        const [workoutData, activities] = await Promise.all([
          loadWorkout(),
          getWarmupActivities(),
        ]);
        setWorkout(workoutData);
        setWarmupActivities(activities);

        // If already location-verified (resume), skip to warmup
        if (workoutData.locationVerified) {
          setPhase("warmup");
        } else {
          setPhase("location");
        }
      } catch (err) {
        console.error(err);
        setError(
          err instanceof Error ? err.message : "Could not load workout"
        );
        setPhase("loading");
      }
    }
    init();
  }, []);

  // ─── Current exercise & state ──────────────────────────

  const exercise = workout?.exercises[exerciseIndex] ?? null;

  const exerciseState = useMemo(() => {
    if (!exercise) return null;
    if (logs[exercise.id]) return logs[exercise.id];

    // Initialize from recommendation
    return {
      weight: exercise.recommendation.weight,
      sets: Array.from({ length: exercise.sets }, () => ({
        reps: 0,
        rir: null,
        completed: false,
      })),
    };
  }, [exercise, logs]);

  // ─── State updaters ────────────────────────────────────

  const updateWeight = useCallback(
    (weight: number) => {
      if (!exercise || !exerciseState) return;
      setLogs((prev) => ({
        ...prev,
        [exercise.id]: { ...exerciseState, weight },
      }));
    },
    [exercise, exerciseState]
  );

  const updateSetReps = useCallback(
    (setIdx: number, reps: number) => {
      if (!exercise || !exerciseState) return;
      const newSets = [...exerciseState.sets];
      newSets[setIdx] = { ...newSets[setIdx], reps };
      setLogs((prev) => ({
        ...prev,
        [exercise.id]: { ...exerciseState, sets: newSets },
      }));
    },
    [exercise, exerciseState]
  );

  const updateSetRir = useCallback(
    (setIdx: number, rir: number) => {
      if (!exercise || !exerciseState) return;
      const newSets = [...exerciseState.sets];
      newSets[setIdx] = { ...newSets[setIdx], rir };
      setLogs((prev) => ({
        ...prev,
        [exercise.id]: { ...exerciseState, sets: newSets },
      }));
    },
    [exercise, exerciseState]
  );

  const completeSet = useCallback(
    (setIdx: number) => {
      if (!exercise || !exerciseState) return;
      const set = exerciseState.sets[setIdx];
      if (set.reps <= 0) {
        setError("Enter your reps first.");
        return;
      }
      setError("");

      const newSets = [...exerciseState.sets];
      newSets[setIdx] = { ...newSets[setIdx], completed: true };
      setLogs((prev) => ({
        ...prev,
        [exercise.id]: { ...exerciseState, sets: newSets },
      }));

      // Auto-start rest timer
      setRestSeconds(90);
      setRestActive(true);
    },
    [exercise, exerciseState]
  );

  const clearSet = useCallback(
    (setIdx: number) => {
      if (!exercise || !exerciseState) return;
      const newSets = [...exerciseState.sets];
      newSets[setIdx] = { reps: 0, rir: null, completed: false };
      setLogs((prev) => ({
        ...prev,
        [exercise.id]: { ...exerciseState, sets: newSets },
      }));
    },
    [exercise, exerciseState]
  );

  // ─── Navigation ────────────────────────────────────────

  const goToExercise = useCallback(
    (index: number) => {
      if (!workout || index < 0 || index >= workout.exercises.length) return;
      setExerciseIndex(index);
      setRestActive(false);
      setError("");
    },
    [workout]
  );

  // ─── Completed exercise indices ────────────────────────

  const completedIndices = useMemo(() => {
    if (!workout) return [];
    return workout.exercises
      .map((ex, i) => {
        const state = logs[ex.id];
        if (!state) return -1;
        return state.sets.every((s) => s.completed) ? i : -1;
      })
      .filter((i) => i >= 0);
  }, [workout, logs]);

  // ─── Finish workout ────────────────────────────────────

  const finishWorkout = useCallback(async () => {
    if (!workout) return;
    setError("");
    setSaving(true);

    // Build payload
    const allLogs = workout.exercises.flatMap((ex) => {
      const state = logs[ex.id] ?? {
        weight: ex.recommendation.weight,
        sets: Array.from({ length: ex.sets }, () => ({
          reps: 0,
          rir: null,
          completed: false,
        })),
      };

      return state.sets.map((set, i) => ({
        exerciseId: ex.id,
        setNumber: i + 1,
        weight: state.weight,
        reps: set.reps,
        rir: set.rir,
      }));
    });

    // Validate
    const incomplete = allLogs.filter((l) => l.reps <= 0);
    if (incomplete.length > 0) {
      setError(
        `Complete all sets before finishing. ${incomplete.length} set(s) have 0 reps.`
      );
      setSaving(false);
      return;
    }

    try {
      await completeWorkout({
        workoutId: workout.id,
        logs: allLogs,
      });

      // Tell service worker workout is logged
      if ("serviceWorker" in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({
          type: "WORKOUT_LOGGED",
        });
      }

      setPhase("report");
    } catch (err) {
      console.error(err);
      setError(
        err instanceof Error ? err.message : "Could not save workout"
      );
    } finally {
      setSaving(false);
    }
  }, [workout, logs]);

  // ─── Reload after report ───────────────────────────────

  const handleReportDone = useCallback(() => {
    window.location.reload();
  }, []);

  // ─── Reload after exercise change ──────────────────────

  const handleExerciseChanged = useCallback(async () => {
    setManagerOpen(false);
    try {
      const updated = await loadWorkout();
      setWorkout(updated);
      // Keep exercise index within bounds
      if (exerciseIndex >= updated.exercises.length) {
        setExerciseIndex(Math.max(0, updated.exercises.length - 1));
      }
    } catch (err) {
      console.error(err);
    }
  }, [exerciseIndex]);

  // ─── RENDER ────────────────────────────────────────────

  const isWorkoutActive = phase === "workout" || phase === "warmup";

  // Loading
  if (phase === "loading" && !error) {
    return (
      <WakeLockProvider active={false}>
        <main className="app">
          <div className="loading">
            <div className="loadingLogo">GYM OS</div>
            <div className="spinner" />
            <p>Loading your workout...</p>
          </div>
        </main>
      </WakeLockProvider>
    );
  }

  // Error state
  if (phase === "loading" && error) {
    return (
      <main className="app">
        <div className="empty">
          <div className="emptyIcon">🏋️</div>
          <h1>Something went wrong</h1>
          <p>{error}</p>
          <button
            className="primaryButton"
            style={{ marginTop: 24, maxWidth: 300 }}
            onClick={() => window.location.reload()}
          >
            Try Again
          </button>
        </div>
      </main>
    );
  }

  if (!workout) return null;

  // Location verification
  if (phase === "location") {
    return (
      <WakeLockProvider active={false}>
        <main className="app">
          <header className="appHeader">
            <div className="logo">GYM OS</div>
            <div className="headerRight">
              <span>{workout.workoutType.name}</span>
              <span className="workoutNumber">#{workout.sequenceNo}</span>
            </div>
          </header>

          <LocationGate
            workoutId={workout.id}
            onVerified={() => setPhase("warmup")}
            onSkip={() => setPhase("warmup")}
          />

          <NotificationSetup workoutType={workout.workoutType.name} />
        </main>
      </WakeLockProvider>
    );
  }

  // Warmup phase
  if (phase === "warmup") {
    return (
      <WakeLockProvider active={true}>
        <main className="app">
          <header className="appHeader">
            <div className="logo">GYM OS</div>
            <div className="headerRight">
              <span>{workout.workoutType.name}</span>
              <span className="workoutNumber">#{workout.sequenceNo}</span>
            </div>
          </header>

          <WarmupSection
            workoutId={workout.id}
            activities={warmupActivities}
            onComplete={() => setPhase("workout")}
          />
        </main>
      </WakeLockProvider>
    );
  }

  // Performance report
  if (phase === "report") {
    return (
      <WakeLockProvider active={false}>
        <main className="app">
          <PerformanceReport
            workoutId={workout.id}
            workoutType={workout.workoutType.name}
            sequenceNo={workout.sequenceNo}
            onDone={handleReportDone}
          />
        </main>
      </WakeLockProvider>
    );
  }

  // ─── Main workout view ─────────────────────────────────

  const totalExercises = workout.exercises.length;

  return (
    <WakeLockProvider active={true}>
      <main className="app">
        <WorkoutHeader
          workoutType={workout.workoutType.name}
          sequenceNo={workout.sequenceNo}
          exerciseIndex={exerciseIndex}
          totalExercises={totalExercises}
          daysMissed={workout.daysMissed}
        />

        {exercise && exerciseState && (
          <>
            {/* Exercise info */}
            <section className="workoutHeader">
              <div className="sessionTag">
                {workout.workoutType.name.toUpperCase()}
              </div>
              <h1>{exercise.name}</h1>
              <p>
                {exercise.sets} sets · {exercise.minReps}–{exercise.maxReps}{" "}
                reps
                {exercise.equipment && ` · ${exercise.equipment}`}
              </p>
            </section>

            {/* Last performance comparison */}
            <section className="lastPerformance">
              <div className="lastLabel">LAST PERFORMANCE</div>
              {exercise.recommendation.previousSets.length > 0 ? (
                <div className="lastContent">
                  <div className="comparisonGrid">
                    {exercise.recommendation.previousSets.map((ps) => (
                      <div className="comparisonSet" key={ps.setNumber}>
                        <span className="comparisonSetNumber">
                          S{ps.setNumber}
                        </span>
                        <span className="comparisonValue">
                          {ps.weight} kg × {ps.reps} reps
                        </span>
                        {ps.rir !== null && (
                          <span className="comparisonSame">
                            RIR {ps.rir}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                  <div style={{ marginTop: 8 }}>
                    <span
                      style={{
                        fontSize: 13,
                        color: exercise.recommendation.stuckSessions >= 3
                          ? "var(--warning)"
                          : "var(--text-secondary)",
                      }}
                    >
                      {exercise.recommendation.reason}
                    </span>
                  </div>
                  {exercise.recommendation.estimated1RM && (
                    <div style={{ marginTop: 4, fontSize: 12, color: "var(--text-muted)" }}>
                      Est. 1RM: {exercise.recommendation.estimated1RM} kg ·
                      Volume: {exercise.recommendation.totalVolume.toLocaleString("en-IN")} kg
                    </div>
                  )}
                </div>
              ) : (
                <div className="firstTime">
                  First time doing this exercise. Establish your baseline
                  today! 💪
                </div>
              )}
            </section>

            {/* Weight control */}
            <WeightControl
              weight={exerciseState.weight}
              increment={exercise.weightIncrement}
              onChange={updateWeight}
            />

            {/* Sets */}
            <div style={{ marginBottom: 16 }}>
              {exerciseState.sets.map((set, idx) => (
                <SwipeableSetRow
                  key={`${exercise.id}-${idx}`}
                  setNumber={idx + 1}
                  totalSets={exercise.sets}
                  reps={set.reps}
                  rir={set.rir}
                  completed={set.completed}
                  previousReps={
                    exercise.recommendation.previousSets[idx]?.reps ?? null
                  }
                  previousWeight={
                    exercise.recommendation.previousSets[idx]?.weight ?? null
                  }
                  targetMin={exercise.minReps}
                  targetMax={exercise.maxReps}
                  onRepsChange={(reps) => updateSetReps(idx, reps)}
                  onRirChange={(rir) => updateSetRir(idx, rir)}
                  onComplete={() => completeSet(idx)}
                  onClear={() => clearSet(idx)}
                />
              ))}
            </div>

            {error && <div className="errorBox">{error}</div>}

            {/* Exercise manager trigger */}
            <button
              className="finishButton"
              style={{
                marginBottom: 12,
                background: "transparent",
                border: "1px solid var(--border-subtle)",
                color: "var(--text-secondary)",
                textTransform: "none",
                letterSpacing: 0,
              }}
              onClick={() => setManagerOpen(true)}
            >
              ⚙️ Skip / Swap / Manage Exercise
            </button>
          </>
        )}

        {/* Exercise navigation */}
        <ExerciseNav
          exerciseIndex={exerciseIndex}
          totalExercises={totalExercises}
          completedIndices={completedIndices}
          onNavigate={goToExercise}
        />

        {/* Finish button */}
        <button
          className="primaryButton"
          disabled={saving}
          onClick={finishWorkout}
          style={{ marginTop: 8 }}
        >
          {saving ? "Saving..." : "🏁 Finish Workout"}
        </button>

        {/* Rest timer overlay */}
        {restActive && (
          <RestTimer
            seconds={restSeconds}
            onComplete={() => setRestActive(false)}
            onSkip={() => setRestActive(false)}
            onAdd={(s) =>
              setRestSeconds((c) => Math.max(0, c + s))
            }
          />
        )}

        {/* Exercise manager bottom sheet */}
        {exercise && (
          <ExerciseManager
            open={managerOpen}
            onClose={() => setManagerOpen(false)}
            workoutId={workout.id}
            workoutExerciseId={exercise.workoutExerciseId}
            exerciseId={exercise.id}
            exerciseName={exercise.name}
            workoutTypeId={workout.workoutType.id}
            onExerciseChanged={handleExerciseChanged}
          />
        )}
      </main>
    </WakeLockProvider>
  );
}
