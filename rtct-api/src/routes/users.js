const express = require("express");
const users = require("../repos/users-sql");
const router = express.Router();

function requireAdmin(req, res, next) {
  if (req.user?.role !== "admin") {
    return res.status(403).json({ error: "forbidden" });
  }
  return next();
}

// GET /users/pending  (admin only)
router.get("/pending", requireAdmin, async (_req, res) => {
  try {
    const pending = await users.listPending();
    res.json(pending);
  } catch (e) {
    console.error("users/pending failed:", e);
    res.status(500).json({ error: "failed to list pending users" });
  }
});

// GET /users  (admin only)
router.get("/", requireAdmin, async (_req, res) => {
  try {
    const allUsers = await users.listAll();
    res.json(allUsers);
  } catch (e) {
    console.error("users list failed:", e);
    res.status(500).json({ error: "failed to list users" });
  }
});

// PATCH /users/:id/approve  (admin only)
router.patch("/:id/approve", requireAdmin, async (req, res) => {
  try {
    const updated = await users.approve(req.params.id);
    if (!updated) return res.status(404).json({ error: "user not found" });
    res.json(updated);
  } catch (e) {
    console.error("users approve failed:", e);
    res.status(500).json({ error: "failed to approve user" });
  }
});

// PATCH /users/:id/make-admin  (admin only)
router.patch("/:id/make-admin", requireAdmin, async (req, res) => {
  try {
    const updated = await users.makeAdmin(req.params.id);
    if (!updated) return res.status(404).json({ error: "user not found" });
    res.json(updated);
  } catch (e) {
    console.error("users make-admin failed:", e);
    res.status(500).json({ error: "failed to promote user" });
  }
});

// PATCH /users/:id/revoke-approval  (admin only)
router.patch("/:id/revoke-approval", requireAdmin, async (req, res) => {
  try {
    const updated = await users.revokeApproval(req.params.id);
    if (!updated) return res.status(404).json({ error: "user not found" });
    res.json(updated);
  } catch (e) {
    console.error("users revoke-approval failed:", e);
    res.status(500).json({ error: "failed to revoke approval" });
  }
});

// PATCH /users/:id/demote  (admin only)
router.patch("/:id/demote", requireAdmin, async (req, res) => {
  try {
    const updated = await users.demoteToUser(req.params.id);
    if (!updated) return res.status(404).json({ error: "user not found" });
    res.json(updated);
  } catch (e) {
    console.error("users demote failed:", e);
    res.status(500).json({ error: "failed to demote user" });
  }
});

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
