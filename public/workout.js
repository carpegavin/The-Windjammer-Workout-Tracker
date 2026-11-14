(() => {
  const container = document.querySelector(".workout-stats"), status = document.querySelector("#page-status"), retry = document.querySelector("#retry"), continueLink = document.querySelector("#continue-btn");
  async function load() {
    retry.hidden = true; continueLink.hidden = true; status.textContent = "Loading your latest workout…"; status.dataset.state = "loading"; container.replaceChildren();
    try {
      const workout = await API.getLastWorkout();
      if (!workout) { status.textContent = "No workouts yet. Start your first workout below; it is saved when you add an exercise."; status.dataset.state = "empty"; return; }
      const totals = WorkoutMetrics.summarize(workout.exercises);
      const rows = {
        Date: new Date(workout.day).toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" }),
        "Workout duration": totals.duration.toLocaleString() + " minutes", "Exercises logged": workout.exercises.length,
        "Resistance volume (load × sets × reps)": totals.volume.toLocaleString() + " lb",
        "Sets performed": totals.sets, "Repetitions performed": totals.repetitions, "Cardio distance": totals.distance.toLocaleString() + " miles"
      };
      Object.entries(rows).forEach(([label, value]) => { const row = document.createElement("p"), strong = document.createElement("strong"); strong.textContent = label + ": "; row.append(strong, document.createTextNode(String(value))); container.append(row); });
      continueLink.href = "/exercise?id=" + encodeURIComponent(workout._id); continueLink.hidden = false;
      status.textContent = new URLSearchParams(location.search).has("saved") ? "Your exercise was saved." : ""; status.dataset.state = "success";
    } catch (error) { status.textContent = error.message; status.dataset.state = "error"; retry.hidden = false; }
  }
  retry.addEventListener("click", load); load();
})();
