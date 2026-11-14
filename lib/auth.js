const crypto = require("node:crypto");
const { rateLimit } = require("express-rate-limit");

const COOKIE = "windjammer_session";
const LIFETIME = 8 * 60 * 60;

function equal(a, b) {
  const left = crypto.createHash("sha256").update(a).digest();
  const right = crypto.createHash("sha256").update(b).digest();
  return crypto.timingSafeEqual(left, right);
}

function createAuth({ password, secret, production = false, now = () => Date.now() }) {
  if (typeof password !== "string" || password.length < 12) throw new Error("APP_PASSWORD must contain at least 12 characters.");
  if (typeof secret !== "string" || secret.length < 32) throw new Error("SESSION_SECRET must contain at least 32 characters.");

  const signature = payload => crypto.createHmac("sha256", secret).update(payload).digest("base64url");
  function authenticated(req) {
    const cookie = (req.headers.cookie || "").split(";").map(item => item.trim()).find(item => item.startsWith(COOKIE + "="));
    if (!cookie) return false;
    const [payload, sig, extra] = cookie.slice(COOKIE.length + 1).split(".");
    if (!payload || !sig || extra || !equal(sig, signature(payload))) return false;
    try {
      const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
      return Number.isFinite(data.exp) && data.exp > now() && data.exp <= now() + LIFETIME * 1000;
    } catch { return false; }
  }
  const cookieOptions = { httpOnly: true, secure: production, sameSite: "strict", path: "/", maxAge: LIFETIME * 1000 };
  const loginLimit = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: "draft-8", legacyHeaders: false, message: { error: "Too many sign-in attempts. Try again in 15 minutes." } });

  function register(app) {
    app.get("/api/session", (req, res) => {
      res.set("Cache-Control", "no-store").json({ authenticated: authenticated(req) });
    });
    app.post("/api/session", loginLimit, (req, res) => {
      if (!req.body || typeof req.body.password !== "string" || !equal(req.body.password, password)) {
        return res.status(401).json({ error: "Incorrect password." });
      }
      const payload = Buffer.from(JSON.stringify({ exp: now() + LIFETIME * 1000, nonce: crypto.randomBytes(16).toString("hex") })).toString("base64url");
      res.cookie(COOKIE, payload + "." + signature(payload), cookieOptions);
      res.set("Cache-Control", "no-store").json({ authenticated: true });
    });
    app.delete("/api/session", (req, res) => {
      res.clearCookie(COOKIE, { ...cookieOptions, maxAge: undefined });
      res.status(204).end();
    });
  }
  function requireAuth(req, res, next) {
    if (authenticated(req)) return next();
    if (req.path.startsWith("/api/")) return res.status(401).json({ error: "Sign in to continue." });
    res.redirect(303, "/login");
  }
  return { register, requireAuth };
}

function protectWrites(req, res, next) {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return next();
  const origin = req.get("origin");
  const expected = req.protocol + "://" + req.get("host");
  if (req.get("sec-fetch-site") === "cross-site" || (origin && origin !== expected)) {
    return res.status(403).json({ error: "Cross-site requests are not allowed." });
  }
  if (req.method !== "DELETE" && !req.is("application/json")) {
    return res.status(415).json({ error: "Send application/json." });
  }
  next();
}

module.exports = { createAuth, protectWrites };
