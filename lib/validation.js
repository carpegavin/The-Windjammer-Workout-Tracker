class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

function object(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new HttpError(400, label + " must be an object.");
  }
}

function validateExercise(input) {
  object(input, "Exercise");
  if (!["cardio", "resistance"].includes(input.type)) {
    throw new HttpError(400, "Choose cardio or resistance.");
  }
  const fields = input.type === "cardio"
    ? ["type", "name", "distance", "duration"]
    : ["type", "name", "weight", "sets", "reps", "duration"];
  if (Object.keys(input).some(field => !fields.includes(field))) {
    throw new HttpError(400, "Exercise contains unsupported fields.");
  }
  if (typeof input.name !== "string" || !input.name.trim() || input.name.trim().length > 120) {
    throw new HttpError(400, "Exercise name must contain 1–120 characters.");
  }
  const result = { type: input.type, name: input.name.trim() };
  const rules = { duration: [0, 1440, false, false], distance: [0, 1000, false, false], weight: [0, 5000, false, true], sets: [1, 1000, true, true], reps: [1, 1000, true, true] };
  for (const field of fields.filter(field => rules[field])) {
    const value = input[field];
    const [min, max, integer, inclusive] = rules[field];
    if (typeof value !== "number" || !Number.isFinite(value) || (inclusive ? value < min : value <= min) || value > max || (integer && !Number.isInteger(value))) {
      throw new HttpError(400, field + " must be " + (integer ? "an integer" : "a number") + " " + (inclusive ? "from" : "greater than") + " " + min + " and at most " + max + ".");
    }
    result[field] = value;
  }
  return result;
}

function positiveInteger(value, fallback, max) {
  if (value === undefined) return fallback;
  if (typeof value !== "string" || !/^[1-9]\d*$/.test(value) || Number(value) > max) {
    throw new HttpError(400, "Pagination must be an integer between 1 and " + max + ".");
  }
  return Number(value);
}

module.exports = { HttpError, object, validateExercise, positiveInteger };
