document.querySelectorAll(".logout").forEach(button => button.addEventListener("click", async () => {
  button.disabled = true;
  try {
    const response = await fetch("/api/session", { method: "DELETE", credentials: "same-origin", headers: { "Content-Type": "application/json" } });
    if (!response.ok) throw new Error("Sign out failed. Please try again.");
    location.assign("/login");
  } catch (error) { button.disabled = false; const status = document.querySelector('[role="status"]'); if (status) { status.textContent = error.message; status.dataset.state = "error"; } }
}));
