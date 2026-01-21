const express = require("express");
const users = require("../repos/users-sql");
const router = express.Router();

// PUT /users/me  (requires requireAuth in server.js)
router.put("/me", async (req, res) => {
  const { username, photoUrl } = req.body || {};
  if (username === undefined && photoUrl === undefined) {
    return res.status(400).json({ error: "nothing to update" });
  }
  try {
    const updated = await users.update(req.user.id, { username, photoUrl });
    if (!updated) return res.status(404).json({ error: "user not found" });
    res.json(updated);
  } catch (e) {
    console.error("users/me update failed:", e);
    res.status(500).json({ error: "failed to update profile" });
  }
});

module.exports = router;
