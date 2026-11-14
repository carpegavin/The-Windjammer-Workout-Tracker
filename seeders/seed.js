const mongoose = require('mongoose');

function validateDemoTarget(env) {
  if (env.NODE_ENV === 'production' || env.SEED_DEMO !== '1') {
    throw new Error('Demo seeding requires SEED_DEMO=1 and is forbidden in production.');
  }
  let target;
  try { target = new URL(env.MONGODB_URI); } catch {
    throw new Error('Set MONGODB_URI explicitly to the disposable windjammer_demo database.');
  }
  if (!['mongodb:', 'mongodb+srv:'].includes(target.protocol) || target.pathname !== '/windjammer_demo') {
    throw new Error('Demo seeding is restricted to the windjammer_demo database.');
  }
}

function demoWorkouts(now = new Date()) {
  return [['Bicep Curl', 100], ['Lateral Pull', 150], ['Push Press', 85]].map(([name, weight], index) => {
    const day = new Date(now);
    day.setDate(day.getDate() - (3 - index));
    return {
      _id: new mongoose.Types.ObjectId(`00000000000000000000000${index + 1}`), day,
      exercises: [{ type: 'resistance', name, weight, reps: 10, sets: 3, duration: 20 }]
    };
  });
}

async function seedDemo(Workout, env, now) {
  validateDemoTarget(env);
  let inserted = 0;
  for (const fixture of demoWorkouts(now)) {
    if (!await Workout.exists({ _id: fixture._id })) {
      await Workout.create(fixture);
      inserted += 1;
    }
  }
  return inserted;
}

async function main() {
  validateDemoTarget(process.env);
  try {
    await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 10000 });
    const inserted = await seedDemo(require('../models').Workout, process.env);
    console.log(`Added ${inserted} demo workouts. Existing records were preserved.`);
  } finally { await mongoose.disconnect(); }
}

if (require.main === module) {
  main().catch(() => {
    console.error('Demo seeding failed. Verify the explicit demo database and connection settings.');
    process.exitCode = 1;
  });
}
module.exports = { validateDemoTarget, demoWorkouts, seedDemo };
