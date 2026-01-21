const express = require("express");
const bus = require("../bus");
const router = express.Router();
const jwt = require("jsonwebtoken");
const JWT_SECRET = process.env.JWT_SECRET || "dev-secret";

// SSE endpoint: requires JWT. Use EventSource(`${API}/stream?token=${token}`)
router.get("/", (req, res) => {
  // Accept token via query (EventSource-friendly) or Authorization header
  const auth = req.headers.authorization || "";
  const headerToken = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  const token = req.query.token || headerToken;

  if (!token) return res.status(401).json({ error: "missing token" });
  try {
    // verify and optionally attach to req for future use
    req.user = jwt.verify(token, JWT_SECRET);
  } catch {
    return res.status(401).json({ error: "invalid token" });
  }

  // Set SSE headers
  res.set({
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    // Disable proxy buffering for Nginx-like proxies
    "X-Accel-Buffering": "no",
  });
  res.flushHeaders?.();

  // Optional: instruct client to retry after 3s if disconnected
  res.write("retry: 3000\n\n");

  // Register client with the in-process bus
  bus.addClient(res);

  // Cleanup when client disconnects
  req.on("close", () => {
    try {
      // If your bus exposes a removal method, call it here, e.g. bus.removeClient(res)
      // For now just end the response to ensure socket is closed.
      res.end();
    } catch (_) {}
  });
});

module.exports = router;
