(() => {
  const form = document.querySelector("#exercise-form"), select = document.querySelector("#type"), status = document.querySelector("#form-status");
  const add = document.querySelector(".add-another"), finish = document.querySelector(".complete"), fields = [...form.querySelectorAll("input")];
  let pending = false, dirty = false;
  let workoutId = new URLSearchParams(location.search).get("id");
  const invalidId = workoutId !== null && !/^[a-f\d]{24}$/i.test(workoutId);
  function readExercise() {
    const type = select.value, value = id => document.getElementById(id).value.trim();
    const numeric = id => value(id) === "" ? NaN : Number(value(id));
    return type === "cardio" ? { type, name: value("cardio-name"), duration: numeric("duration"), distance: numeric("distance") }
      : { type, name: value("name"), duration: numeric("resistance-duration"), weight: numeric("weight"), sets: numeric("sets"), reps: numeric("reps") };
  }
  function validate() { const error = WorkoutMetrics.validateExercise(readExercise()); add.disabled = finish.disabled = pending || invalidId || Boolean(error); return error; }
  function showType() {
    for (const type of ["cardio", "resistance"]) {
      const group = form.querySelector("." + type + "-form"); group.hidden = select.value !== type;
      group.querySelectorAll("input").forEach(input => { input.disabled = group.hidden || pending; });
    }
    validate();
  }
  function setPending(value) { pending = value; form.setAttribute("aria-busy", String(value)); select.disabled = value || invalidId; showType(); }
  select.addEventListener("change", () => { dirty = true; showType(); status.textContent = ""; });
  fields.forEach(input => input.addEventListener("input", () => { dirty = true; validate(); }));
  form.addEventListener("submit", async event => {
    event.preventDefault(); if (pending || invalidId) return;
    const error = validate(); if (error) { status.textContent = error; status.dataset.state = "error"; return; }
    const exercise = readExercise(), shouldFinish = event.submitter === finish;
    setPending(true); status.textContent = "Saving exercise…"; status.dataset.state = "loading";
    try {
      const workout = workoutId ? await API.addExercise(workoutId, exercise) : await API.createWorkout(exercise);
      workoutId = workout._id;
      const url = new URL(location.href); url.searchParams.set("id", workoutId); history.replaceState(null, "", url);
      dirty = false;
      if (shouldFinish) { pending = false; location.assign("/?saved=1"); return; }
      fields.forEach(input => { input.value = ""; });
      status.textContent = "Exercise saved. Add another exercise, or return to your workout summary."; status.dataset.state = "success";
      setPending(false); const first = form.querySelector("." + select.value + "-form input"); if (first) first.focus();
    } catch (error) { status.textContent = error.message; status.dataset.state = "error"; setPending(false); }
  });
  window.addEventListener("beforeunload", event => { if (dirty || pending) { event.preventDefault(); event.returnValue = ""; } });
  if (invalidId) { status.textContent = "This workout link is invalid. Return to the summary or start a new workout."; status.dataset.state = "error"; }
  showType();
})();
