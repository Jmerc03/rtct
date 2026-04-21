const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const users = require("../repos/users-sql");

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || "dev-secret";

function genToken(user) {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role,
      isApproved: !!user.is_approved,
    },
    JWT_SECRET,
    { expiresIn: "2h" },
  );
}

// POST /auth/signup
router.post("/signup", async (req, res) => {
  try {
    const { email, username, password, photoUrl } = req.body || {};
    if (!email || !username || !password)
      return res
        .status(400)
        .json({ error: "email, username, password required" });

    const existing = await users.findByEmail(email);
    if (existing)
      return res.status(400).json({ error: "email already registered" });

    const hash = await bcrypt.hash(password, 10);
    const newUser = await users.create({
      email,
      username,
      passwordHash: hash,
      photoUrl,
    });
    res.status(201).json({
      user: newUser,
      message: "signup submitted; admin approval required before login",
    });
  } catch (err) {
    console.error("signup failed:", err);
    res.status(500).json({ error: "signup failed" });
  }
});

// POST /auth/login
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password)
      return res.status(400).json({ error: "email and password required" });

    const user = await users.findByEmail(email);
    if (!user) return res.status(400).json({ error: "invalid credentials" });

    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return res.status(400).json({ error: "invalid credentials" });

    if (!user.is_approved) {
      return res.status(403).json({ error: "approval required" });
    }

    const token = genToken(user);
    res.json({
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        photo_url: user.photo_url,
        role: user.role,
        is_approved: user.is_approved,
      },
      token,
    });
  } catch (err) {
    console.error("login failed:", err);
    res.status(500).json({ error: "login failed" });
  }
});

// GET /auth/me
router.get("/me", async (req, res) => {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ error: "missing token" });
  const token = auth.replace("Bearer ", "");
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await users.findById(decoded.id);
    if (!user) return res.status(404).json({ error: "user not found" });
    res.json(user);
  } catch (err) {
    res.status(401).json({ error: "invalid token" });
  }
});

module.exports = router;
