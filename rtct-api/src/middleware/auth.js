const jwt = require("jsonwebtoken");
const JWT_SECRET = process.env.JWT_SECRET || "dev-secret";
const users = require("../repos/users-sql");

/**
 * Factory that returns an Express auth middleware.
 * If `requiredRole` is provided, it will enforce that `req.user.role`
 * matches that value after verifying the token.
 */
function makeRequireAuth(requiredRole) {
  return async function requireAuth(req, res, next) {
    // Hard guard: if something is really wrong with the req object,
    // fail fast instead of throwing during header access.
    if (!req || !res) {
      console.error("[auth] req or res missing in requireAuth");
      if (res && typeof res.status === "function") {
        return res.status(401).json({ error: "missing token" });
      }
      return;
    }

    const headers = req?.headers || {};

    // Accept standard Authorization: Bearer <token>
    const rawAuth = headers["authorization"] || headers["Authorization"] || "";
    let token = null;

    if (typeof rawAuth === "string" && rawAuth.startsWith("Bearer ")) {
      token = rawAuth.slice(7).trim();
    }

    // Fallbacks: allow token via query (?token=) or a custom header
    if (!token && req.query && typeof req.query.token === "string") {
      token = req.query.token.trim();
    }

    if (!token && headers["x-access-token"]) {
      token = String(headers["x-access-token"]).trim();
    }

    if (!token) {
      return res.status(401).json({ error: "missing token" });
    }

    try {
      // { id, email, role, iat, exp }
      const payload = jwt.verify(token, JWT_SECRET);
      const user = await users.findById(payload.id);

      if (!user) {
        return res.status(401).json({ error: "user not found" });
      }

      if (!user.is_approved) {
        return res.status(403).json({ error: "approval required" });
      }

      if (requiredRole && user.role !== requiredRole) {
        return res.status(403).json({ error: "forbidden" });
      }

      req.user = {
        id: user.id,
        email: user.email,
        username: user.username,
        photo_url: user.photo_url,
        role: user.role,
        is_approved: user.is_approved,
      };
      return next();
    } catch (err) {
      console.warn("[auth] invalid token:", err && err.message);
      return res.status(401).json({ error: "invalid token" });
    }
  };
}

const requireAuth = makeRequireAuth();

requireAuth.withRole = (role) => makeRequireAuth(role);

module.exports = requireAuth;
