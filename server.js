const path = require("node:path");
const express = require("express");
const mongoose = require("mongoose");
const helmet = require("helmet");
const { rateLimit } = require("express-rate-limit");
const { createRoutes } = require("./routes");
const { createAuth, protectWrites } = require("./lib/auth");

function createApp(options = {}) {
  const env = options.env || process.env;
  const production = env.NODE_ENV === "production";
  const app = express();
  app.disable("x-powered-by");
  if (production) app.set("trust proxy", 1);
  app.use(helmet({
    contentSecurityPolicy: { directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      fontSrc: ["'self'"],
      imgSrc: ["'self'", "data:"],
      connectSrc: ["'self'"],
      objectSrc: ["'none'"],
      frameAncestors: ["'none'"],
      upgradeInsecureRequests: production ? [] : null
    } }
  }));
  app.use(express.json({ limit: "16kb" }));
  app.use(protectWrites);
  app.use("/api", (req, res, next) => { res.set("Cache-Control", "no-store"); next(); });

  const isReady = options.isReady || (() => mongoose.connection.readyState === 1);
  app.get("/healthz", (req, res) => {
    const ready = isReady();
    res.status(ready ? 200 : 503).json({ status: ready ? "ready" : "unavailable" });
  });

  const auth = createAuth({ password: env.APP_PASSWORD, secret: env.SESSION_SECRET, production });
  auth.register(app);
  const publicDirectory = path.join(__dirname, "public");
  app.get("/login", (req, res) => res.set("Cache-Control", "no-store").sendFile("login.html", { root: publicDirectory }));
  app.get("/login.js", (req, res) => res.sendFile("login.js", { root: publicDirectory }));
  app.get("/style.css", (req, res) => res.sendFile("style.css", { root: publicDirectory }));
  app.use(auth.requireAuth);
  app.use((req, res, next) => { res.set("Cache-Control", "no-store"); next(); });
  app.use("/api", rateLimit({
    windowMs: 60 * 1000, limit: 120, standardHeaders: "draft-8", legacyHeaders: false,
    message: { error: "Too many requests. Please wait a minute." }
  }));
  app.use(createRoutes(options.Workout));
  app.use(express.static(publicDirectory, { index: false }));
  app.use((req, res) => {
    if (req.path.startsWith("/api/")) return res.status(404).json({ error: "Endpoint not found." });
    res.status(404).type("text").send("Page not found.");
  });
  app.use((err, req, res, next) => {
    if (res.headersSent) return next(err);
    const validation = ["ValidationError", "CastError", "StrictModeError"].includes(err.name);
    const status = err.status || (validation ? 400 : 500);
    const message = status === 413 ? "Request is too large."
      : err.type === "entity.parse.failed" ? "Invalid JSON."
      : validation ? "Invalid workout data."
      : status >= 500 ? "Unable to complete the request. Please try again." : err.message;
    if (status >= 500) console.error("Request failed:", err.name || "Error");
    res.status(status).json({ error: message });
  });
  return app;
}

async function start(env = process.env) {
  if (env.NODE_ENV === "production" && !env.MONGODB_URI) throw new Error("MONGODB_URI is required in production.");
  // Validate private access settings before making a database connection.
  const app = createApp({ env });
  await mongoose.connect(env.MONGODB_URI || "mongodb://127.0.0.1:27017/Workout", {
    serverSelectionTimeoutMS: 10000, bufferCommands: false
  });
  const server = app.listen(Number(env.PORT) || 3000, "0.0.0.0", () => console.log("Workout tracker is ready."));
  let closing = false;
  async function shutdown() {
    if (closing) return;
    closing = true;
    const timeout = setTimeout(() => process.exit(1), 10000).unref();
    server.close(async () => {
      await mongoose.disconnect();
      clearTimeout(timeout);
      process.exit(0);
    });
  }
  process.once("SIGTERM", shutdown);
  process.once("SIGINT", shutdown);
  return { app, server };
}

if (require.main === module) {
  start().catch(error => {
    console.error("Startup failed:", error.name || "Error");
    process.exitCode = 1;
  });
}

module.exports = { createApp, start };
