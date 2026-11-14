(() => {
  const form = document.querySelector("#login-form"), status = document.querySelector("#login-status"), password = document.querySelector("#password"), button = form.querySelector("button");
  let pending = false;
  form.addEventListener("submit", async event => {
    event.preventDefault(); if (pending || !password.value) return;
    pending = true; button.disabled = true; status.textContent = "Signing in…"; status.dataset.state = "loading";
    try {
      const response = await fetch("/api/session", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password: password.value }) });
      const result = await response.json();
      if (!response.ok || !result.authenticated) throw new Error(result.error || "Unable to sign in. Check your password and try again.");
      password.value = ""; location.assign("/");
    } catch (error) { status.textContent = error.message || "Unable to reach the tracker. Try again."; status.dataset.state = "error"; pending = false; button.disabled = false; }
  });
})();
