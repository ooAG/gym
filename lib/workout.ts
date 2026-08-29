import { db } from "./db";

export async function getNextWorkout() {
  const types = await db.workoutType.findMany({
    orderBy: { order: "asc" },
  });

  if (!types.length) {
    throw new Error("No workout types configured");
  }

  const existing = await db.workout.findFirst({
    where: {
      status: "IN_PROGRESS",
    },
    include: {
      workoutType: true,
      logs: {
        include: {
          exercise: true,
        },
        orderBy: {
          setNumber: "asc",
        },
      },
      exercises: {
        where: {
          skipped: false,
        },
        orderBy: {
          sortOrder: "asc",
        },
        include: {
          exercise: true,
        },
      },
    },
  });

  if (existing) {
    return existing;
  }

  const last = await db.workout.findFirst({
    where: {
      status: "COMPLETED",
    },
    orderBy: {
      completedAt: "desc",
    },
  });

  let nextType;

  if (!last) {
    nextType = types[0];
  } else {
    const currentIndex = types.findIndex(
      (type) => type.id === last.workoutTypeId
    );

    const nextIndex =
      currentIndex === -1
        ? 0
        : (currentIndex + 1) % types.length;

    nextType = types[nextIndex];
  }

  const routineExercises =
    await db.exercise.findMany({
      where: {
        workoutTypeId: nextType.id,
        active: true,
      },
      orderBy: {
        sortOrder: "asc",
      },
    });

  const count = await db.workout.count();

  const workout = await db.workout.create({
    data: {
      workoutTypeId: nextType.id,
      sequenceNo: count + 1,
      plannedDate: new Date(),
      status: "IN_PROGRESS",

      exercises: {
        create: routineExercises.map(
          (exercise, index) => ({
            exerciseId: exercise.id,
            sortOrder: index + 1,
          })
        ),
      },
    },

    include: {
      workoutType: true,

      logs: {
        include: {
          exercise: true,
        },
      },

      exercises: {
        where: {
          skipped: false,
        },
        orderBy: {
          sortOrder: "asc",
        },
        include: {
          exercise: true,
        },
      },
    },
  });

  return workout;
}

export async function getWorkoutExercises(
  workoutId: number
) {
  const workoutExercises =
    await db.workoutExercise.findMany({
      where: {
        workoutId,
        skipped: false,
      },

      orderBy: {
        sortOrder: "asc",
      },

      include: {
        exercise: true,
      },
    });

  return Promise.all(
    workoutExercises.map(async (item) => {
      const recommendation =
        await getRecommendation(
          item.exercise.id
        );

      return {
        ...item.exercise,
        workoutExerciseId: item.id,
        recommendation,
      };
    })
  );
}

export async function getRecommendation(
  exerciseId: number
) {
  const ex =
    await db.exercise.findUniqueOrThrow({
      where: {
        id: exerciseId,
      },
    });

  const previousWorkout =
    await db.workout.findFirst({
      where: {
        status: "COMPLETED",

        logs: {
          some: {
            exerciseId,
          },
        },
      },

      orderBy: {
        completedAt: "desc",
      },
    });

  if (!previousWorkout) {
    return {
      weight: 0,
      minReps: ex.minReps,
      maxReps: ex.maxReps,
      reason:
        "First time. Establish a comfortable baseline.",
    };
  }

  const previous =
    await db.exerciseLog.findMany({
      where: {
        workoutId: previousWorkout.id,
        exerciseId,
      },

      orderBy: {
        setNumber: "asc",
      },
    });

  if (!previous.length) {
    return {
      weight: 0,
      minReps: ex.minReps,
      maxReps: ex.maxReps,
      reason:
        "No previous performance recorded.",
    };
  }

  const allTop =
    previous.length === ex.sets &&
    previous.every(
      (set) => set.reps >= ex.maxReps
    );

  const lastWeight =
    previous[0].weight ?? 0;

  if (
    allTop &&
    ex.progressionType ===
      "DOUBLE_PROGRESSION"
  ) {
    return {
      weight:
        lastWeight + ex.weightIncrement,
      minReps: ex.minReps,
      maxReps: ex.maxReps,
      reason:
        `You hit ${ex.maxReps} reps on every set. ` +
        `Increase by ${ex.weightIncrement} kg.`,
    };
  }

  return {
    weight: lastWeight,
    minReps: ex.minReps,
    maxReps: ex.maxReps,
    reason:
      `Repeat ${lastWeight} kg and try to add reps.`,
  };
}

export async function recommendation(
  exerciseId: number
) {
  return getRecommendation(exerciseId);
}
