(function (root) {
  const number = value => Number.isFinite(Number(value)) ? Number(value) : 0;
  function summarize(exercises = []) {
    return exercises.reduce((totals, exercise) => {
      totals.duration += number(exercise.duration);
      if (exercise.type === "resistance") {
        totals.volume += number(exercise.weight) * number(exercise.sets) * number(exercise.reps);
        totals.sets += number(exercise.sets);
        totals.repetitions += number(exercise.sets) * number(exercise.reps);
      } else if (exercise.type === "cardio") totals.distance += number(exercise.distance);
      return totals;
    }, { duration: 0, volume: 0, sets: 0, repetitions: 0, distance: 0 });
  }
  function dashboard(workouts) {
    const sessions = [...workouts].sort((a, b) => new Date(a.day) - new Date(b.day) || String(a._id).localeCompare(String(b._id)));
    const grouped = new Map();
    sessions.forEach(workout => (workout.exercises || []).forEach(exercise => {
      const key = exercise.type + ":" + String(exercise.name || "Unnamed exercise").trim().toLowerCase();
      const item = grouped.get(key) || { name: exercise.name || "Unnamed exercise", type: exercise.type, count: 0, duration: 0 };
      item.count += 1; item.duration += number(exercise.duration); grouped.set(key, item);
    }));
    return { sessions, exercises: [...grouped.values()] };
  }
  function validateExercise(exercise) {
    if (!["cardio", "resistance"].includes(exercise.type)) return "Choose an exercise type.";
    if (typeof exercise.name !== "string" || !exercise.name.trim() || exercise.name.trim().length > 120) return "Enter an exercise name of 1 to 120 characters.";
    const bounds = { duration: [0, 1440], distance: [0, 1000], weight: [0, 5000], sets: [0, 1000], reps: [0, 1000] };
    const fields = exercise.type === "cardio" ? ["duration", "distance"] : ["duration", "weight", "sets", "reps"];
    for (const field of fields) {
      const value = exercise[field], [minimum, maximum] = bounds[field];
      if (typeof value !== "number" || !Number.isFinite(value) || value > maximum || (field === "weight" ? value < minimum : value <= minimum)) return "Enter a valid " + field + " (" + (field === "weight" ? "0" : "greater than 0") + " to " + maximum + ").";
      if (["sets", "reps"].includes(field) && !Number.isInteger(value)) return (field === "sets" ? "Sets" : "Repetitions") + " must be whole numbers.";
    }
    return "";
  }
  const api = { summarize, dashboard, validateExercise };
  if (typeof module !== "undefined") module.exports = api; else root.WorkoutMetrics = api;
})(typeof window !== "undefined" ? window : globalThis);
