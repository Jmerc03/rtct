let config = { sensitivity: "medium" };
const express = require("express");
const router = express.Router();

router.get("/", (_req, res) => res.json(config));

router.put("/", (req, res) => {
  config = { ...config, ...req.body, updatedAt: new Date() };
  res.json(config);
});

module.exports = router;
