const express = require("express");
const router = express.Router();

router.get("/", async (_req, res) => {
  const status = { ok: true, service: "rtct-alert-api", time: new Date() };

  try {
    if (process.env.REPO === "sql") {
      const repo = require("../repos/alerts-sql");
      await repo.ping(); // runs SELECT 1
      status.db = true;
    } else {
      status.db = false; // in-memory mode, no DB check
    }
  } catch (err) {
    console.error("Health check DB failed:", err.message);
    status.ok = false;
    status.db = false;
  }

  res.status(status.ok ? 200 : 500).json(status);
});

module.exports = router;
