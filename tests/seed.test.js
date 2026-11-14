const { test } = require('node:test');
const assert = require('node:assert/strict');
const { validateDemoTarget, demoWorkouts, seedDemo } = require('../seeders/seed');
const demoEnv = { SEED_DEMO: '1', MONGODB_URI: 'mongodb://localhost/windjammer_demo' };
test('seeding refuses production, missing opt-in, and non-demo databases', () => {
  for (const env of [{}, { ...demoEnv, NODE_ENV: 'production' }, { ...demoEnv, SEED_DEMO: '' },
    { ...demoEnv, MONGODB_URI: 'mongodb://localhost/Workout' },
    { ...demoEnv, MONGODB_URI: 'https://localhost/windjammer_demo' }]) assert.throws(() => validateDemoTarget(env));
});
test('demo fixtures have real dates and stable identifiers', () => {
  const fixtures = demoWorkouts(new Date('2026-11-14T12:00:00Z'));
  assert.ok(fixtures.every(item => item.day instanceof Date && Number.isFinite(item.day.getTime())));
  assert.equal(new Set(fixtures.map(item => String(item._id))).size, 3);
});
test('demo seeding preserves existing records and does not duplicate fixtures', async () => {
  const records = new Map([['existing-user-record', { exercises: [{ name: 'Keep me' }] }]]);
  const Workout = { exists: async ({ _id }) => records.has(String(_id)), create: async item => records.set(String(item._id), item) };
  assert.equal(await seedDemo(Workout, demoEnv), 3);
  assert.equal(await seedDemo(Workout, demoEnv), 0);
  assert.deepEqual(records.get('existing-user-record'), { exercises: [{ name: 'Keep me' }] });
  assert.equal(records.size, 4);
});
