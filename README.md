# Gym OS

Local-first PPL gym accountability app built with Next.js, Prisma and SQLite.

## Logic

The PPL sequence is a queue: Push -> Pull -> Legs -> Push...

A missed calendar day does NOT advance the sequence. The next time you open the app, it shows the next unfinished session.

Progression uses double progression: if every set reaches the exercise's max reps, the next recommended weight increases by that exercise's increment. Otherwise the app repeats the current weight and asks you to add reps.

## Run

```bash
npm install
cp .env.example .env
npx prisma generate
npx prisma db push
npm run seed
npm run dev
```

Open http://localhost:3000

## Next upgrades

- attendance calendar / missed-day detection
- PR and estimated 1RM dashboard
- bodyweight and waist tracking
- exercise substitutions
- RIR-aware fatigue detection
- export/import backup
- PWA installability
- exercise editor
