const API = (() => {
  async function request(path, options = {}) {
    let response;
    try { response = await fetch(path, { credentials: "same-origin", ...options, headers: { "Content-Type": "application/json", ...options.headers } }); }
    catch (_) { throw new Error("Unable to reach the tracker. Check your connection and try again."); }
    if (response.status === 401) { location.assign("/login"); throw new Error("Sign in to continue."); }
    let data;
    try { data = await response.json(); } catch (_) { throw new Error("The tracker returned an unexpected response. Please try again."); }
    if (!response.ok) throw new Error(data.error || data.message || "The request failed. Please try again.");
    return data;
  }
  function savedWorkout(data) {
    if (!data || typeof data._id !== "string" || !Array.isArray(data.exercises)) throw new Error("The exercise was not confirmed as saved. Your entries have been kept.");
    return data;
  }
  return {
    getLastWorkout: () => request("/api/workouts/latest"),
    addExercise: async (id, exercise) => savedWorkout(await request("/api/workouts/" + encodeURIComponent(id), { method: "PUT", body: JSON.stringify(exercise) })),
    createWorkout: async exercise => savedWorkout(await request("/api/workouts", { method: "POST", body: JSON.stringify({ exercise }) })),
    getWorkoutsInRange: () => request("/api/workouts/range")
  };
})();
if (typeof module !== "undefined") module.exports = API;
