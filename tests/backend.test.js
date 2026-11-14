const test = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");
const { createApp } = require("../server");
const { validateExercise } = require("../lib/validation");
const { summaryPipeline } = require("../routes");
const WorkoutModel = require("../models/workout");

const env = { NODE_ENV: "test", APP_PASSWORD: "a-private-test-password", SESSION_SECRET: "a".repeat(40) };
const cardio = { type: "cardio", name: "Run", duration: 20, distance: 2 };
const resistance = { type: "resistance", name: "Squat", duration: 30, weight: 100, sets: 3, reps: 10 };
const id = "0123456789abcdef01234567";
function fake(overrides = {}) {
  return {
    aggregate: async () => [],
    create: async data => ({ _id: id, day: new Date(), ...data }),
    findOneAndUpdate: async () => ({ _id: id, exercises: [cardio] }),
    exists: async () => null,
    ...overrides
  };
}
function app(model = fake(), extra = {}) {
  return createApp({ env, Workout: model, isReady: () => true, ...extra });
}
async function signedIn(application) {
  const agent = request.agent(application);
  await agent.post("/api/session").send({ password: env.APP_PASSWORD }).expect(200);
  return agent;
}

test("private pages and API require authentication but health remains public", async () => {
  const application = app();
  await request(application).get("/").expect(303).expect("Location", "/login");
  await request(application).get("/api/workouts").expect(401);
  await request(application).get("/healthz").expect(200, { status: "ready" });
  await request(app(fake(), { isReady: () => false })).get("/healthz").expect(503);
});

test("session cookies are httpOnly, strict, signed, and cleared on sign-out", async () => {
  const application = app();
  const login = await request(application).post("/api/session").send({ password: env.APP_PASSWORD }).expect(200);
  const cookie = login.headers["set-cookie"][0];
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /SameSite=Strict/);
  await request(application).get("/api/session").set("Cookie", cookie.split(";")[0]).expect(200, { authenticated: true });
  await request(application).get("/api/workouts").set("Cookie", "windjammer_session=tampered.signature").expect(401);
  const agent = await signedIn(application);
  await agent.delete("/api/session").expect(204);
  await agent.get("/api/workouts").expect(401);
});

test("bad passwords fail, cross-site writes and form submissions are blocked", async () => {
  const application = app();
  await request(application).post("/api/session").send({ password: "wrong" }).expect(401);
  await request(application).post("/api/session").set("Origin", "https://attacker.example").send({ password: env.APP_PASSWORD }).expect(403);
  await request(application).post("/api/session").type("form").send({ password: env.APP_PASSWORD }).expect(415);
  await request(application).post("/api/session").set("Sec-Fetch-Site", "cross-site").send({ password: env.APP_PASSWORD }).expect(403);
});

test("production rejects missing secrets and cookies are Secure", async () => {
  assert.throws(() => createApp({ env: { NODE_ENV: "production" } }), /APP_PASSWORD/);
  assert.throws(() => createApp({ env: { ...env, SESSION_SECRET: "short" } }), /SESSION_SECRET/);
  const result = await request(app(fake(), { env: { ...env, NODE_ENV: "production" } }))
    .post("/api/session").send({ password: env.APP_PASSWORD }).expect(200);
  assert.match(result.headers["set-cookie"][0], /Secure/);
});

test("login attempts are rate limited", async () => {
  const application = app();
  for (let i = 0; i < 10; i++) await request(application).post("/api/session").send({ password: "wrong" }).expect(401);
  await request(application).post("/api/session").send({ password: "wrong" }).expect(429);
});

test("first save creates a workout and first exercise atomically; no blank drafts", async () => {
  let saved;
  const agent = await signedIn(app(fake({ create: async value => { saved = value; return { _id: id, ...value }; } })));
  const response = await agent.post("/api/workouts").send({ exercise: cardio }).expect(201);
  assert.deepEqual(saved, { exercises: [cardio] });
  assert.equal(response.body.exercises.length, 1);
  await agent.post("/api/workouts").send({}).expect(400);
  await agent.post("/api/workouts").send({ exercise: cardio, day: "yesterday" }).expect(400);
});

test("invalid exercises never reach persistence", async () => {
  let calls = 0;
  const agent = await signedIn(app(fake({ findOneAndUpdate: async () => { calls++; } })));
  for (const exercise of [{}, { ...cardio, name: "" }, { ...cardio, duration: -1 }, { ...cardio, distance: 0 }, { ...resistance, sets: 1.5 }, { ...resistance, weight: "100" }, { ...resistance, weight: -1 }, { ...cardio, extra: true }]) {
    await agent.put("/api/workouts/" + id).send(exercise).expect(400);
  }
  assert.equal(calls, 0);
});

test("append returns updated data with validation and an atomic growth bound", async () => {
  let captured;
  const agent = await signedIn(app(fake({ findOneAndUpdate: async (...args) => { captured = args; return { _id: id, exercises: [resistance] }; } })));
  await agent.put("/api/workouts/" + id).send(resistance).expect(200);
  assert.equal(captured[0]["exercises.999"].$exists, false);
  assert.deepEqual(captured[1], { $push: { exercises: resistance } });
  assert.equal(captured[2].runValidators, true);
  assert.equal(captured[2].returnDocument, "after");
});

test("bad IDs, missing workouts, and full workouts have distinct errors", async () => {
  const missing = await signedIn(app(fake({ findOneAndUpdate: async () => null })));
  await missing.put("/api/workouts/not-an-id").send(cardio).expect(400);
  await missing.put("/api/workouts/" + id).send(cardio).expect(404);
  const full = await signedIn(app(fake({ findOneAndUpdate: async () => null, exists: async () => ({ _id: id }) })));
  await full.put("/api/workouts/" + id).send(cardio).expect(409);
});

test("database failures are redacted and do not break later requests", async () => {
  const application = app(fake({ aggregate: async () => { throw new Error("secret-database-uri"); } }));
  const agent = await signedIn(application);
  const result = await agent.get("/api/workouts").expect(500);
  assert.equal(result.body.error.includes("secret"), false);
  await agent.get("/healthz").expect(200);
});

test("latest is explicit, empty data is null, pagination is bounded", async () => {
  const seen = [];
  const agent = await signedIn(app(fake({ aggregate: async pipeline => { seen.push(pipeline); return []; } })));
  await agent.get("/api/workouts/latest").expect(200, null);
  await agent.get("/api/workouts?limit=10&page=2").expect(200, []);
  assert.ok(seen[0].some(stage => stage.$limit === 1));
  assert.ok(seen[1].some(stage => stage.$skip === 10));
  for (const query of ["limit=101", "page=0", "limit=1.5", "$where=bad"]) {
    await agent.get("/api/workouts?" + query).expect(400);
  }
});

test("seven-session query normalizes legacy dates, excludes empty drafts, then returns chronology", () => {
  const pipeline = summaryPipeline({ limit: 7, chronological: true });
  assert.deepEqual(pipeline[0], { $match: { "exercises.0": { $exists: true } } });
  assert.equal(pipeline[1].$addFields._sortDay.$convert.to, "date");
  assert.ok(pipeline.findIndex(stage => stage.$limit === 7) < pipeline.findIndex(stage => stage.$sort?._sortDay === 1));
});

test("domain validation trims names and permits zero-weight bodyweight exercises", () => {
  assert.equal(validateExercise({ ...resistance, name: "  Squat  ", weight: 0 }).name, "Squat");
  assert.throws(() => validateExercise({ ...cardio, duration: Infinity }), /duration/);
});

test("Mongoose schema enforces required and bounded fields without a database", async () => {
  const good = new WorkoutModel({ exercises: [resistance, cardio] });
  await good.validate();
  const bad = new WorkoutModel({ exercises: [{ type: "resistance", name: "", duration: -1, reps: 1.5 }] });
  await assert.rejects(bad.validate());
  await assert.rejects(new WorkoutModel({ exercises: [{ ...cardio, distance: -1 }] }).validate());
});

test("HTML pages and login assets load from a checkout under hidden ancestors", async () => {
  const application = app();
  await request(application).get("/login").expect(200).expect("Content-Type", /html/).expect("Cache-Control", "no-store");
  await request(application).get("/login.js").expect(200).expect("Content-Type", /javascript/);
  await request(application).get("/style.css").expect(200).expect("Content-Type", /css/);
  const agent = await signedIn(application);
  for (const page of ["/", "/exercise", "/stats"]) {
    await agent.get(page).expect(200).expect("Content-Type", /html/);
  }
});
