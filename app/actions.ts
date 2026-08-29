"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";

// ─── Types ───────────────────────────────────────────────

export type PreviousSetData = {
  setNumber: number;
  weight: number;
  reps: number;
  rir: number | null;
};

export type Recommendation = {
  weight: number;
  minReps: number;
  maxReps: number;
  reason: string;
  previousSets: PreviousSetData[];
  totalVolume: number;
  estimated1RM: number | null;
  stuckSessions: number;
};

export type ExerciseWithRec = {
  id: number;
  name: string;
  muscleGroup: string;
  equipment: string | null;
  sets: number;
  minReps: number;
  maxReps: number;
  weightIncrement: number;
  workoutExerciseId: number;
  recommendation: Recommendation;
};

export type WorkoutData = {
  id: number;
  sequenceNo: number;
  status: string;
  plannedDate: string;
  locationVerified: boolean;
  workoutType: { id: number; name: string };
  exercises: ExerciseWithRec[];
  daysMissed: number;
};

// ─── Haversine Distance (meters) ─────────────────────────

function haversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ─── Recommendation Engine ───────────────────────────────

async function getRecommendation(exerciseId: number): Promise<Recommendation> {
  const ex = await db.exercise.findUniqueOrThrow({ where: { id: exerciseId } });

  // Find last completed workout with this exercise
  const previousWorkout = await db.workout.findFirst({
    where: { status: "COMPLETED", logs: { some: { exerciseId } } },
    orderBy: { completedAt: "desc" },
  });

  const emptyResult: Recommendation = {
    weight: 0,
    minReps: ex.minReps,
    maxReps: ex.maxReps,
    reason: "First time — establish a comfortable baseline.",
    previousSets: [],
    totalVolume: 0,
    estimated1RM: null,
    stuckSessions: 0,
  };

  if (!previousWorkout) return emptyResult;

  const previousLogs = await db.exerciseLog.findMany({
    where: { workoutId: previousWorkout.id, exerciseId },
    orderBy: { setNumber: "asc" },
  });

  if (!previousLogs.length) return emptyResult;

  const previousSets: PreviousSetData[] = previousLogs.map((l) => ({
    setNumber: l.setNumber,
    weight: l.weight ?? 0,
    reps: l.reps,
    rir: l.rir,
  }));

  const lastWeight = previousLogs[0].weight ?? 0;

  // Total volume = sum(weight × reps) for all sets
  const totalVolume = previousLogs.reduce(
    (sum, l) => sum + (l.weight ?? 0) * l.reps,
    0
  );

  // Estimated 1RM (Epley formula) using the heaviest set
  const heaviestSet = previousLogs.reduce(
    (best, l) => ((l.weight ?? 0) * l.reps > (best.weight ?? 0) * best.reps ? l : best),
    previousLogs[0]
  );
  const estimated1RM =
    heaviestSet.reps > 0 && (heaviestSet.weight ?? 0) > 0
      ? Math.round((heaviestSet.weight ?? 0) * (1 + heaviestSet.reps / 30) * 10) / 10
      : null;

  // Count how many consecutive sessions user has been at the same weight
  const recentWorkouts = await db.workout.findMany({
    where: {
      status: "COMPLETED",
      logs: { some: { exerciseId } },
    },
    orderBy: { completedAt: "desc" },
    take: 5,
    include: {
      logs: {
        where: { exerciseId },
        orderBy: { setNumber: "asc" },
        take: 1,
      },
    },
  });

  let stuckSessions = 0;
  for (const w of recentWorkouts) {
    if (w.logs[0] && (w.logs[0].weight ?? 0) === lastWeight) {
      stuckSessions++;
    } else {
      break;
    }
  }

  // Double progression check
  const allMaxed =
    previousLogs.length === ex.sets &&
    previousLogs.every((s) => s.reps >= ex.maxReps);

  if (allMaxed && ex.progressionType === "DOUBLE_PROGRESSION") {
    const newWeight = lastWeight + ex.weightIncrement;
    return {
      weight: newWeight,
      minReps: ex.minReps,
      maxReps: ex.maxReps,
      reason: `You hit ${ex.maxReps} reps on every set last time. Weight up by ${ex.weightIncrement} kg! 💪`,
      previousSets,
      totalVolume,
      estimated1RM,
      stuckSessions: 0,
    };
  }

  return {
    weight: lastWeight,
    minReps: ex.minReps,
    maxReps: ex.maxReps,
    reason:
      stuckSessions >= 3
        ? `Same weight for ${stuckSessions} sessions. Consider a deload or swapping this exercise.`
        : `Repeat ${lastWeight} kg — try to add reps.`,
    previousSets,
    totalVolume,
    estimated1RM,
    stuckSessions,
  };
}

// ─── Load Workout ────────────────────────────────────────

export async function loadWorkout(): Promise<WorkoutData> {
  const types = await db.workoutType.findMany({ orderBy: { order: "asc" } });
  if (!types.length) throw new Error("No workout types configured. Run the seed.");

  // Check for existing IN_PROGRESS workout
  let workout = await db.workout.findFirst({
    where: { status: "IN_PROGRESS" },
    include: {
      workoutType: true,
      exercises: {
        where: { skipped: false },
        orderBy: { sortOrder: "asc" },
        include: { exercise: true },
      },
    },
  });

  let daysMissed = 0;

  if (!workout) {
    // Find last completed to determine next type + days missed
    const last = await db.workout.findFirst({
      where: { status: "COMPLETED" },
      orderBy: { completedAt: "desc" },
    });

    let nextType;
    if (!last) {
      nextType = types[0];
    } else {
      const currentIndex = types.findIndex((t) => t.id === last.workoutTypeId);
      nextType = types[(currentIndex + 1) % types.length];

      // Calculate days missed
      if (last.completedAt) {
        const diffMs = Date.now() - last.completedAt.getTime();
        daysMissed = Math.max(0, Math.floor(diffMs / 86400000) - 1);
      }
    }

    const activeExercises = await db.exercise.findMany({
      where: { workoutTypeId: nextType.id, active: true },
      orderBy: { sortOrder: "asc" },
    });

    const count = await db.workout.count();

    workout = await db.workout.create({
      data: {
        workoutTypeId: nextType.id,
        sequenceNo: count + 1,
        plannedDate: new Date(),
        status: "IN_PROGRESS",
        exercises: {
          create: activeExercises.map((ex, i) => ({
            exerciseId: ex.id,
            sortOrder: i + 1,
          })),
        },
      },
      include: {
        workoutType: true,
        exercises: {
          where: { skipped: false },
          orderBy: { sortOrder: "asc" },
          include: { exercise: true },
        },
      },
    });
  }

  // Build exercises with recommendations
  const exercises: ExerciseWithRec[] = await Promise.all(
    workout.exercises.map(async (we) => {
      const rec = await getRecommendation(we.exercise.id);
      return {
        id: we.exercise.id,
        name: we.exercise.name,
        muscleGroup: we.exercise.muscleGroup,
        equipment: we.exercise.equipment,
        sets: we.exercise.sets,
        minReps: we.exercise.minReps,
        maxReps: we.exercise.maxReps,
        weightIncrement: we.exercise.weightIncrement,
        workoutExerciseId: we.id,
        recommendation: rec,
      };
    })
  );

  return {
    id: workout.id,
    sequenceNo: workout.sequenceNo,
    status: workout.status,
    plannedDate: workout.plannedDate.toISOString(),
    locationVerified: workout.locationVerified,
    workoutType: { id: workout.workoutType.id, name: workout.workoutType.name },
    exercises,
    daysMissed,
  };
}

// ─── Verify Location ─────────────────────────────────────

export async function verifyLocation(
  workoutId: number,
  lat: number,
  lng: number
): Promise<{ verified: boolean; nearest: string; distance: number }> {
  const locations = await db.gymLocation.findMany();

  let nearest = { name: "Unknown", distance: Infinity };

  for (const loc of locations) {
    const dist = haversineDistance(lat, lng, loc.latitude, loc.longitude);
    if (dist < nearest.distance) {
      nearest = { name: loc.name, distance: Math.round(dist) };
    }
  }

  const verified = nearest.distance <= 100;

  await db.workout.update({
    where: { id: workoutId },
    data: {
      startLocation: `${lat},${lng}`,
      locationVerified: verified,
      startedAt: new Date(),
    },
  });

  return { verified, nearest: nearest.name, distance: nearest.distance };
}

// ─── Override Location (with warning) ────────────────────

export async function overrideLocation(workoutId: number): Promise<void> {
  await db.workout.update({
    where: { id: workoutId },
    data: { locationVerified: true, startedAt: new Date() },
  });
}

// ─── Get Warmup Activities ───────────────────────────────

export async function getWarmupActivities() {
  return db.warmupActivity.findMany({
    where: { active: true },
    orderBy: { sortOrder: "asc" },
  });
}

// ─── Save Warmup Log ─────────────────────────────────────

export async function saveWarmupLog(
  workoutId: number,
  activityId: number,
  duration: number,
  skipped: boolean
) {
  await db.warmupLog.create({
    data: { workoutId, activityId, duration, skipped },
  });
}

// ─── Skip Exercise (this workout only) ───────────────────

export async function skipExercise(workoutExerciseId: number) {
  await db.workoutExercise.update({
    where: { id: workoutExerciseId },
    data: { skipped: true },
  });
  revalidatePath("/");
}

// ─── Swap Exercise (this workout) ────────────────────────

export async function swapExercise(
  workoutId: number,
  workoutExerciseId: number,
  replacementExerciseId: number
) {
  const current = await db.workoutExercise.findUniqueOrThrow({
    where: { id: workoutExerciseId },
  });

  await db.$transaction([
    db.workoutExercise.update({
      where: { id: current.id },
      data: { skipped: true },
    }),
    db.workoutExercise.create({
      data: {
        workoutId,
        exerciseId: replacementExerciseId,
        sortOrder: current.sortOrder,
        skipped: false,
      },
    }),
  ]);

  revalidatePath("/");
}

// ─── Add Exercise (permanent) ────────────────────────────

export async function addExercise(data: {
  name: string;
  muscleGroup: string;
  equipment: string;
  workoutTypeId: number;
  sets?: number;
  minReps?: number;
  maxReps?: number;
  weightIncrement?: number;
}) {
  const last = await db.exercise.findFirst({
    where: { workoutTypeId: data.workoutTypeId },
    orderBy: { sortOrder: "desc" },
  });

  const exercise = await db.exercise.create({
    data: {
      name: data.name,
      muscleGroup: data.muscleGroup as any,
      equipment: data.equipment || null,
      workoutTypeId: data.workoutTypeId,
      sortOrder: (last?.sortOrder ?? 0) + 1,
      sets: data.sets ?? 3,
      minReps: data.minReps ?? 8,
      maxReps: data.maxReps ?? 12,
      weightIncrement: data.weightIncrement ?? 2.5,
      active: true,
    },
  });

  revalidatePath("/");
  return exercise;
}

// ─── Remove Exercise (soft delete) ───────────────────────

export async function removeExercise(exerciseId: number) {
  await db.exercise.update({
    where: { id: exerciseId },
    data: { active: false },
  });
  revalidatePath("/");
}

// ─── Restore Exercise ────────────────────────────────────

export async function restoreExercise(exerciseId: number) {
  await db.exercise.update({
    where: { id: exerciseId },
    data: { active: true },
  });
  revalidatePath("/");
}

// ─── Get Exercise Library ────────────────────────────────

export async function getExerciseLibrary(workoutTypeId: number) {
  return db.exercise.findMany({
    where: { workoutTypeId },
    orderBy: { sortOrder: "asc" },
  });
}

// ─── Get Removed Exercises ───────────────────────────────

export async function getRemovedExercises(workoutTypeId: number) {
  return db.exercise.findMany({
    where: { workoutTypeId, active: false },
    orderBy: { name: "asc" },
  });
}

// ─── Complete Workout ────────────────────────────────────

export async function completeWorkout(data: {
  workoutId: number;
  logs: {
    exerciseId: number;
    setNumber: number;
    weight: number;
    reps: number;
    rir: number | null;
  }[];
}) {
  const workout = await db.workout.findUniqueOrThrow({
    where: { id: data.workoutId },
  });

  if (workout.status === "COMPLETED") {
    throw new Error("Workout already completed");
  }

  // Get previous performance for each exercise for comparison snapshots
  const exerciseIds = [...new Set(data.logs.map((l) => l.exerciseId))];
  const previousData: Record<number, Record<number, { weight: number; reps: number }>> = {};

  for (const exId of exerciseIds) {
    const prevWorkout = await db.workout.findFirst({
      where: {
        status: "COMPLETED",
        logs: { some: { exerciseId: exId } },
        id: { not: data.workoutId },
      },
      orderBy: { completedAt: "desc" },
    });

    if (prevWorkout) {
      const prevLogs = await db.exerciseLog.findMany({
        where: { workoutId: prevWorkout.id, exerciseId: exId },
        orderBy: { setNumber: "asc" },
      });

      previousData[exId] = {};
      for (const pl of prevLogs) {
        previousData[exId][pl.setNumber] = {
          weight: pl.weight ?? 0,
          reps: pl.reps,
        };
      }
    }
  }

  await db.$transaction(async (tx) => {
    // Clear existing logs
    await tx.exerciseLog.deleteMany({ where: { workoutId: workout.id } });

    // Create new logs with comparison snapshots
    await tx.exerciseLog.createMany({
      data: data.logs.map((log) => {
        const prev = previousData[log.exerciseId]?.[log.setNumber];
        return {
          workoutId: workout.id,
          exerciseId: log.exerciseId,
          setNumber: log.setNumber,
          weight: log.weight,
          reps: log.reps,
          rir: log.rir,
          completed: true,
          previousWeight: prev?.weight ?? null,
          previousReps: prev?.reps ?? null,
        };
      }),
    });

    await tx.workout.update({
      where: { id: workout.id },
      data: {
        status: "COMPLETED",
        startedAt: workout.startedAt ?? new Date(),
        completedAt: new Date(),
      },
    });
  });

  revalidatePath("/");
  return { success: true, workoutId: workout.id };
}

// ─── Performance Report ──────────────────────────────────

export type PerformanceExercise = {
  name: string;
  muscleGroup: string;
  sets: {
    setNumber: number;
    weight: number;
    reps: number;
    rir: number | null;
    previousWeight: number | null;
    previousReps: number | null;
    weightDelta: number;
    repsDelta: number;
  }[];
  totalVolume: number;
  previousVolume: number;
  volumeDelta: number;
  estimated1RM: number | null;
};

export type PerformanceReport = {
  workoutType: string;
  sequenceNo: number;
  duration: number; // minutes
  totalVolume: number;
  previousTotalVolume: number;
  volumeDelta: number;
  totalSets: number;
  totalReps: number;
  exercises: PerformanceExercise[];
};

export async function getPerformanceReport(
  workoutId: number
): Promise<PerformanceReport> {
  const workout = await db.workout.findUniqueOrThrow({
    where: { id: workoutId },
    include: {
      workoutType: true,
      logs: {
        include: { exercise: true },
        orderBy: [{ exerciseId: "asc" }, { setNumber: "asc" }],
      },
    },
  });

  const duration =
    workout.startedAt && workout.completedAt
      ? Math.round(
          (workout.completedAt.getTime() - workout.startedAt.getTime()) / 60000
        )
      : 0;

  // Group logs by exercise
  const exerciseMap = new Map<
    number,
    { exercise: typeof workout.logs[0]["exercise"]; logs: typeof workout.logs }
  >();

  for (const log of workout.logs) {
    const existing = exerciseMap.get(log.exerciseId);
    if (existing) {
      existing.logs.push(log);
    } else {
      exerciseMap.set(log.exerciseId, { exercise: log.exercise, logs: [log] });
    }
  }

  let totalVolume = 0;
  let previousTotalVolume = 0;
  let totalSets = 0;
  let totalReps = 0;

  const exercises: PerformanceExercise[] = [];

  for (const [, { exercise, logs }] of exerciseMap) {
    const sets = logs.map((l) => {
      const w = l.weight ?? 0;
      const prevW = l.previousWeight ?? null;
      const prevR = l.previousReps ?? null;

      return {
        setNumber: l.setNumber,
        weight: w,
        reps: l.reps,
        rir: l.rir,
        previousWeight: prevW,
        previousReps: prevR,
        weightDelta: prevW !== null ? w - prevW : 0,
        repsDelta: prevR !== null ? l.reps - prevR : 0,
      };
    });

    const exVolume = sets.reduce((s, set) => s + set.weight * set.reps, 0);
    const exPrevVolume = sets.reduce(
      (s, set) =>
        s + (set.previousWeight ?? set.weight) * (set.previousReps ?? set.reps),
      0
    );

    // Estimated 1RM from heaviest effective set
    const heaviest = sets.reduce(
      (best, s) => (s.weight * s.reps > best.weight * best.reps ? s : best),
      sets[0]
    );
    const e1rm =
      heaviest && heaviest.weight > 0 && heaviest.reps > 0
        ? Math.round(heaviest.weight * (1 + heaviest.reps / 30) * 10) / 10
        : null;

    totalVolume += exVolume;
    previousTotalVolume += exPrevVolume;
    totalSets += sets.length;
    totalReps += sets.reduce((s, set) => s + set.reps, 0);

    exercises.push({
      name: exercise.name,
      muscleGroup: exercise.muscleGroup,
      sets,
      totalVolume: Math.round(exVolume),
      previousVolume: Math.round(exPrevVolume),
      volumeDelta: Math.round(exVolume - exPrevVolume),
      estimated1RM: e1rm,
    });
  }

  return {
    workoutType: workout.workoutType.name,
    sequenceNo: workout.sequenceNo,
    duration,
    totalVolume: Math.round(totalVolume),
    previousTotalVolume: Math.round(previousTotalVolume),
    volumeDelta: Math.round(totalVolume - previousTotalVolume),
    totalSets,
    totalReps,
    exercises,
  };
}

// ─── Get Gym Locations ───────────────────────────────────

export async function getGymLocations() {
  return db.gymLocation.findMany();
}
