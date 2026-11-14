const mongoose = require("mongoose");

const boundedNumber = (min, max, integer = false) => ({
  type: Number,
  min,
  max,
  validate: value => value == null || (Number.isFinite(value) && (!integer || Number.isInteger(value)))
});

const exerciseSchema = new mongoose.Schema({
  type: { type: String, enum: ["resistance", "cardio"], required: true },
  name: { type: String, trim: true, required: true, minlength: 1, maxlength: 120 },
  weight: boundedNumber(0, 5000),
  reps: boundedNumber(1, 1000, true),
  sets: boundedNumber(1, 1000, true),
  distance: boundedNumber(Number.MIN_VALUE, 1000),
  duration: { ...boundedNumber(Number.MIN_VALUE, 1440), required: true }
}, { strict: "throw" });

for (const field of ["weight", "reps", "sets"]) {
  exerciseSchema.path(field).required(function () { return this.type === "resistance"; });
}
exerciseSchema.path("distance").required(function () { return this.type === "cardio"; });

const workoutSchema = new mongoose.Schema({
  day: { type: Date, default: Date.now, required: true, index: true },
  exercises: {
    type: [exerciseSchema],
    default: [],
    validate: { validator: exercises => exercises.length <= 1000, message: "A workout can contain at most 1000 exercises." }
  }
}, { strict: "throw" });

module.exports = mongoose.models.Workout || mongoose.model("Workout", workoutSchema);
