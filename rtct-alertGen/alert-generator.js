const fetch = require("node-fetch");

const API_URL =
  process.env.API_URL ||
  "http://api.rtct.svc.cluster.local:4000/internal/alert";

const TOKEN = process.env.INTERNAL_ALERT_TOKEN;
const INTERVAL = parseInt(process.env.INTERVAL || "10000"); // default 10 seconds

function randomAlert() {
  const generatorCreatedAt = new Date().toISOString();
  return {
    source: "alert-generator-pod",
    type: ["network", "system", "application"][Math.floor(Math.random() * 3)],
    severity: ["low", "medium", "high"][Math.floor(Math.random() * 3)],
    confidence: Math.round(Math.random() * 100) / 100, // 0.00–1.00
    message: `Test alert ${Math.floor(Math.random() * 10000)}`,
    data: { generatorCreatedAt },
  };
}

async function sendAlert() {
  try {
    const body = randomAlert();
    const res = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-internal-token": TOKEN,
      },
      body: JSON.stringify(body),
    });

    const out = await res.text();
    console.log("Sent alert:", body, "response:", out);
  } catch (err) {
    console.error("Failed to send alert", err);
  }
}

console.log("Alert generator starting…");

setInterval(sendAlert, INTERVAL);
