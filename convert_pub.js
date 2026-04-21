const fs = require("fs");

function telemetryToCSV(rawText) {
  const lines = rawText.split("\n");
  const rows = [["time", "cpu", "mem", "temp"]];

  for (let line of lines) {
    line = line.trim();
    if (!line) continue;

    const match = line.match(
      /Pi Metrics\s*\|\s*t:\s*([0-9.]+)\s*\|\s*CPU:\s*([0-9.]+)%\s*\|\s*Mem:\s*([0-9.]+)%\s*\|\s*Temp:\s*([0-9.]+)\s*C/,
    );

    if (match) {
      rows.push([
        match[1], // time
        match[2], // cpu
        match[3], // mem
        match[4], // temp
      ]);
    }
  }

  return rows.map((row) => row.join(",")).join("\n");
}

const input = fs.readFileSync("pod_logs.txt", "utf-8");
const csv = telemetryToCSV(input);

fs.writeFileSync("output_pub.csv", csv);

console.log("Converted input.txt -> output_pub.csv");
