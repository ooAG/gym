import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();

// ─── Exercise Templates ──────────────────────────────────

const exerciseData = {
  Push: [
    ['Smith Machine Bench Press', 'CHEST', 'Smith Machine', 3, 8, 12, 2.5],
    ['Chest Fly', 'CHEST', 'Machine', 3, 10, 15, 2.5],
    ['Shoulder Press', 'SHOULDERS', 'Machine', 3, 8, 12, 2.5],
    ['Lateral Raise', 'SHOULDERS', 'Machine', 3, 10, 15, 2.5],
    ['Triceps Pushdown', 'TRICEPS', 'Cable', 3, 10, 15, 2.5],
    ['Overhead Triceps Extension', 'TRICEPS', 'Cable', 3, 10, 15, 2.5],
  ],
  Pull: [
    ['Lat Pulldown', 'BACK', 'Cable', 3, 8, 12, 2.5],
    ['Seated Cable Row', 'BACK', 'Cable', 3, 8, 12, 2.5],
    ['Reverse Chest Fly', 'SHOULDERS', 'Machine', 3, 10, 15, 2.5],
    ['Assisted Pull-up', 'BACK', 'Machine', 3, 8, 12, 5],
    ['Biceps Curl', 'BICEPS', 'Machine', 3, 10, 15, 2.5],
  ],
  Legs: [
    ['Leg Press', 'QUADS', 'Machine', 3, 8, 12, 5],
    ['Leg Extension', 'QUADS', 'Machine', 3, 10, 15, 2.5],
    ['Leg Curl', 'HAMSTRINGS', 'Machine', 3, 10, 15, 2.5],
    ['Hip Abductor', 'GLUTES', 'Machine', 3, 10, 15, 2.5],
    ['Calf Raise', 'CALVES', 'Machine', 3, 10, 15, 5],
    ['Leg Raise', 'CORE', 'Bodyweight', 3, 10, 15, 1],
  ],
} as const;

// ─── Warmup Activities ───────────────────────────────────

const warmupActivities = [
  { name: 'Treadmill', duration: 300, sortOrder: 1 },
  { name: 'Cross Trainer / Elliptical', duration: 300, sortOrder: 2 },
  { name: 'Dynamic Stretches', duration: 180, sortOrder: 3 },
  { name: 'Foam Rolling', duration: 180, sortOrder: 4 },
];

// ─── Cult.Fit Gym Locations ──────────────────────────────

const gymLocations = [
  {
    name: 'Cult.Fit Branch 1',
    latitude: 28.5697785,
    longitude: 77.2673072,
    radius: 100,
  },
  {
    name: 'Cult.Fit Branch 2',
    latitude: 28.5654165,
    longitude: 77.236420,
    radius: 100,
  },
];

// ─── Seed Function ───────────────────────────────────────

async function main() {
  console.log('🌱 Seeding Gym OS database...\n');

  // Seed workout types + exercises
  for (const [i, name] of (['Push', 'Pull', 'Legs'] as const).entries()) {
    const type = await db.workoutType.upsert({
      where: { name },
      update: { order: i + 1 },
      create: { name, order: i + 1 },
    });

    console.log(`  ✅ ${name} (type #${type.id})`);

    const exercises = exerciseData[name];
    for (const [idx, row] of exercises.entries()) {
      const [exName, muscle, equipment, sets, minReps, maxReps, increment] = row;

      const existing = await db.exercise.findFirst({
        where: { name: exName, workoutTypeId: type.id },
      });

      if (!existing) {
        await db.exercise.create({
          data: {
            name: exName,
            muscleGroup: muscle as string,
            equipment,
            workoutTypeId: type.id,
            sortOrder: idx + 1,
            sets,
            minReps,
            maxReps,
            weightIncrement: increment,
            progressionType: "DOUBLE_PROGRESSION",
            active: true,
          },
        });

        console.log(`     + ${exName}`);
      } else {
        console.log(`     • ${exName} (exists)`);
      }
    }
  }

  // Seed warmup activities
  console.log('\n  🏃 Warmup Activities:');
  for (const activity of warmupActivities) {
    await db.warmupActivity.upsert({
      where: { name: activity.name },
      update: { duration: activity.duration, sortOrder: activity.sortOrder },
      create: activity,
    });

    console.log(`     + ${activity.name} (${activity.duration / 60} min)`);
  }

  // Seed gym locations
  console.log('\n  📍 Gym Locations:');
  for (const location of gymLocations) {
    const existing = await db.gymLocation.findFirst({
      where: { latitude: location.latitude, longitude: location.longitude },
    });

    if (!existing) {
      await db.gymLocation.create({ data: location });
      console.log(`     + ${location.name} (${location.latitude}, ${location.longitude})`);
    } else {
      console.log(`     • ${location.name} (exists)`);
    }
  }

  console.log('\n✨ Seed complete!\n');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
