const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const mongoose = require('mongoose');
const request = require('supertest');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { createApp } = require('../server');
const Workout = require('../models').Workout;

const env = {
  NODE_ENV: 'test',
  APP_PASSWORD: 'integration-only-password',
  SESSION_SECRET: 'integration-only-secret-with-more-than-32-characters'
};
const cardio = { type: 'cardio', name: 'Run', distance: 2, duration: 20 };
const resistance = { type: 'resistance', name: 'Squat', weight: 100, sets: 3, reps: 10, duration: 15 };

test('private workout API persists validated data across an application restart', { timeout: 180000 }, async t => {
  // This process starts and owns a disposable MongoDB instance. No external URI is read.
  const mongo = await MongoMemoryServer.create({
    binary: { downloadDir: path.join(__dirname, '../node_modules/.cache/mongodb-binaries') },
    instance: { dbName: 'windjammer_integration' }
  });
  const uri = mongo.getUri();
  t.after(async () => { await mongoose.disconnect(); await mongo.stop(); });
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
  let app = createApp({ env, Workout });
  let cookie;
  let id;

  await t.test('authentication protects pages, reads, and writes', async () => {
    await request(app).get('/').expect(303).expect('Location', '/login');
    await request(app).get('/stats').expect(303);
    await request(app).get('/api/workouts').expect(401);
    await request(app).post('/api/workouts').send({ exercise: cardio }).expect(401);
    await request(app).post('/api/session').send({ password: 'wrong-password' }).expect(401);
    await request(app).post('/api/session').set('Origin', 'https://untrusted.invalid').send({ password: env.APP_PASSWORD }).expect(403);
    const login = await request(app).post('/api/session').send({ password: env.APP_PASSWORD }).expect(200);
    cookie = login.headers['set-cookie'][0].split(';')[0];
    assert.match(login.headers['set-cookie'][0], /HttpOnly/);
    assert.match(login.headers['set-cookie'][0], /SameSite=Strict/);
    await request(app).get('/healthz').expect(200);
    await request(app).get('/api/workouts/latest').set('Cookie', cookie).expect(200, null);
  });

  await t.test('create and append return data that was actually stored', async () => {
    const first = await request(app).post('/api/workouts').set('Cookie', cookie).send({ exercise: cardio }).expect(201);
    id = first.body._id;
    assert.equal(first.body.exercises.length, 1);
    assert.equal(await Workout.countDocuments(), 1);
    const appended = await request(app).put('/api/workouts/' + id).set('Cookie', cookie).send(resistance).expect(200);
    assert.equal(appended.body.exercises.length, 2);
    const stored = await Workout.findById(id).lean();
    assert.equal(stored.exercises[1].name, 'Squat');
    const latest = await request(app).get('/api/workouts/latest').set('Cookie', cookie).expect(200);
    assert.equal(latest.body._id, id);
    assert.equal(latest.body.totalDuration, 35);
  });

  await t.test('invalid input, unknown IDs, and cross-site writes never change records', async () => {
    const count = await Workout.countDocuments();
    const exercises = (await Workout.findById(id)).exercises.length;
    for (const exercise of [{}, { ...cardio, duration: -1 }, { ...resistance, sets: 1.5 }, { ...cardio, owner: 'other-user' }]) {
      await request(app).post('/api/workouts').set('Cookie', cookie).send({ exercise }).expect(400);
      await request(app).put('/api/workouts/' + id).set('Cookie', cookie).send(exercise).expect(400);
    }
    await request(app).post('/api/workouts').set('Cookie', cookie).send({}).expect(400);
    await request(app).put('/api/workouts/not-an-id').set('Cookie', cookie).send(cardio).expect(400);
    await request(app).put('/api/workouts/000000000000000000000000').set('Cookie', cookie).send(cardio).expect(404);
    await request(app).put('/api/workouts/' + id).set('Cookie', cookie).set('Origin', 'https://untrusted.invalid').send(cardio).expect(403);
    assert.equal(await Workout.countDocuments(), count);
    assert.equal((await Workout.findById(id)).exercises.length, exercises);
  });

  await t.test('latest-seven chronology handles legacy numeric dates and excludes empty drafts', async () => {
    await Workout.findByIdAndUpdate(id, { day: new Date('2026-11-01T12:00:00Z') });
    for (let day = 2; day <= 9; day++) {
      const value = new Date(`2026-11-${String(day).padStart(2, '0')}T12:00:00Z`);
      // Legacy raw fixtures mixed numeric milliseconds and BSON dates.
      await Workout.collection.insertOne({ day: day % 2 ? value.getTime() : value, exercises: [cardio] });
    }
    await Workout.collection.insertOne({ day: new Date('2026-12-01T12:00:00Z'), exercises: [] });
    const range = await request(app).get('/api/workouts/range').set('Cookie', cookie).expect(200);
    assert.equal(range.body.length, 7);
    assert.deepEqual(range.body.map(item => new Date(item.day).getUTCDate()), [3, 4, 5, 6, 7, 8, 9]);
    const latest = await request(app).get('/api/workouts/latest').set('Cookie', cookie).expect(200);
    assert.equal(new Date(latest.body.day).getUTCDate(), 9);
    await request(app).get('/api/workouts?limit=2&page=2').set('Cookie', cookie).expect(200).then(res => assert.equal(res.body.length, 2));
    await request(app).get('/api/workouts?limit=101').set('Cookie', cookie).expect(400);
  });

  await t.test('reconnecting and constructing a new app preserves existing workouts', async () => {
    const count = await Workout.countDocuments();
    await mongoose.disconnect();
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
    app = createApp({ env, Workout });
    assert.equal(await Workout.countDocuments(), count);
    const original = await Workout.findById(id).lean();
    assert.equal(original.exercises.length, 2);
    await request(app).get('/api/workouts/latest').set('Cookie', cookie).expect(200);
    const logout = await request(app).delete('/api/session').set('Cookie', cookie).expect(204);
    assert.match(logout.headers['set-cookie'][0], /Expires=Thu, 01 Jan 1970/);
  });
});
