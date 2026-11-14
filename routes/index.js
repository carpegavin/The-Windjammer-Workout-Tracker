const path = require("node:path");
const express = require("express");
const { HttpError, object, validateExercise, positiveInteger } = require("../lib/validation");

const PUBLIC = path.join(__dirname, "../public");
const validId = id => typeof id === "string" && /^[a-f0-9]{24}$/i.test(id);

function summaryPipeline({ limit, skip = 0, chronological = false }) {
  const pipeline = [
    { $match: { "exercises.0": { $exists: true } } },
    { $addFields: {
      _sortDay: { $convert: { input: "$day", to: "date", onError: null, onNull: null } },
      totalDuration: { $sum: "$exercises.duration" }
    } },
    { $sort: { _sortDay: -1, _id: -1 } },
    { $skip: skip },
    { $limit: limit }
  ];
  if (chronological) pipeline.push({ $sort: { _sortDay: 1, _id: 1 } });
  pipeline.push({ $project: { _sortDay: 0 } });
  return pipeline;
}

function createRoutes(Workout = require("../models").Workout) {
  const route = express.Router();

  route.get("/api/workouts/latest", async (req, res) => {
    const data = await Workout.aggregate(summaryPipeline({ limit: 1 }));
    res.json(data[0] || null);
  });

  route.get("/api/workouts/range", async (req, res) => {
    const data = await Workout.aggregate(summaryPipeline({ limit: 7, chronological: true }));
    res.json(data);
  });

  route.get("/api/workouts", async (req, res) => {
    if (Object.keys(req.query).some(key => !["limit", "page"].includes(key))) {
      throw new HttpError(400, "Unsupported query parameter.");
    }
    const limit = positiveInteger(req.query.limit, 100, 100);
    const page = positiveInteger(req.query.page, 1, 10000);
    const data = await Workout.aggregate(summaryPipeline({ limit, skip: (page - 1) * limit }));
    res.json(data);
  });

  route.post("/api/workouts", async (req, res) => {
    object(req.body, "Request");
    if (Object.keys(req.body).some(key => key !== "exercise")) throw new HttpError(400, "Unsupported workout fields.");
    const exercise = validateExercise(req.body.exercise);
    const data = await Workout.create({ exercises: [exercise] });
    res.status(201).json(data);
  });

  route.put("/api/workouts/:id", async (req, res) => {
    if (!validId(req.params.id)) throw new HttpError(400, "Invalid workout ID.");
    const exercise = validateExercise(req.body);
    const data = await Workout.findOneAndUpdate(
      { _id: req.params.id, "exercises.999": { $exists: false } },
      { $push: { exercises: exercise } },
      { returnDocument: "after", runValidators: true }
    );
    if (!data) {
      const exists = await Workout.exists({ _id: req.params.id });
      throw new HttpError(exists ? 409 : 404, exists ? "Workout has reached its exercise limit." : "Workout not found.");
    }
    res.json(data);
  });

  route.get("/stats", (req, res) => res.sendFile("stats.html", { root: PUBLIC }));
  route.get("/exercise", (req, res) => res.sendFile("exercise.html", { root: PUBLIC }));
  route.get("/", (req, res) => res.sendFile("index.html", { root: PUBLIC }));
  return route;
}

module.exports = { createRoutes, summaryPipeline };
