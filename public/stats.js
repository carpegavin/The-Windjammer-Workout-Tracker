(() => {
  const status = document.querySelector("#page-status"), retry = document.querySelector("#retry"), content = document.querySelector("#dashboard-content");
  const colors = ["#2369bd", "#287244", "#a24d16", "#7651a5", "#ac3156", "#167b83", "#776311", "#565d68"];
  let charts = [];
  function addRow(body, values) {
    const row = document.createElement("tr");
    values.forEach(value => { const cell = document.createElement("td"); cell.textContent = String(value); row.append(cell); }); body.append(row);
  }
  function chart(id, type, labels, values, label) {
    const instance = new Chart(document.getElementById(id), {
      type, data: { labels, datasets: [{ label, data: values, backgroundColor: type === "line" ? "#2369bd" : colors, borderColor: "#2369bd", borderWidth: 2, fill: false }] },
      options: { responsive: true, maintainAspectRatio: false, animation: false,
        plugins: { legend: { display: type === "pie" || type === "doughnut" } },
        ...(type === "line" || type === "bar" ? { scales: { y: { beginAtZero: true } } } : {}) }
    }); charts.push(instance);
  }
  async function load() {
    retry.hidden = true; content.hidden = true; status.textContent = "Loading workout statistics…"; status.dataset.state = "loading";
    charts.forEach(item => item.destroy()); charts = [];
    try {
      const raw = await API.getWorkoutsInRange(); if (!Array.isArray(raw)) throw new Error("The tracker returned unexpected workout data.");
      const { sessions, exercises } = WorkoutMetrics.dashboard(raw);
      if (!sessions.length) { status.textContent = "No saved exercises yet. Start a workout to see your progress here."; status.dataset.state = "empty"; return; }
      const sessionBody = document.querySelector("#session-table tbody"), exerciseBody = document.querySelector("#exercise-table tbody");
      sessionBody.replaceChildren(); exerciseBody.replaceChildren();
      const labels = [], durations = [], volumes = [];
      sessions.forEach(workout => {
        const date = new Date(workout.day).toLocaleString(undefined, { year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
        const totals = WorkoutMetrics.summarize(workout.exercises);
        labels.push(date); durations.push(totals.duration); volumes.push(totals.volume);
        addRow(sessionBody, [date, workout.exercises.length, totals.duration.toLocaleString(), totals.volume.toLocaleString(), totals.distance.toLocaleString()]);
      });
      exercises.forEach(item => addRow(exerciseBody, [item.name, item.type, item.count, item.duration.toLocaleString()]));
      content.hidden = false; status.textContent = ""; status.dataset.state = "success";
      if (typeof Chart === "undefined") { status.textContent = "Charts are unavailable. Your complete statistics are shown in the tables below."; return; }
      chart("canvas", "line", labels, durations, "Minutes");
      chart("canvas2", "bar", labels, volumes, "Resistance volume (lb)");
      const exerciseLabels = exercises.map(item => item.name + " (" + item.type + ")");
      chart("canvas3", "pie", exerciseLabels, exercises.map(item => item.count), "Exercise entries");
      chart("canvas4", "doughnut", exerciseLabels, exercises.map(item => item.duration), "Minutes");
    } catch (error) { status.textContent = error.message; status.dataset.state = "error"; retry.hidden = false; }
  }
  retry.addEventListener("click", load); load();
})();
