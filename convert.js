const fs = require("fs");

function telemetryToCSV(rawText) {
  // Remove JSON alert blocks {...}
  const textWithoutAlerts = rawText.replace(/\{[\s\S]*?\}/g, "");

  const lines = textWithoutAlerts.split("\n");
  const rows = [["time", "cpu", "mem", "temp"]];

  for (let line of lines) {
    line = line.trim();
    if (!line) continue;

    // Match verbose format
    const verboseMatch = line.match(
      /Time:\s*([0-9.]+)\s*\|\s*CPU:\s*([0-9.]+)\s*\|\s*Mem:\s*([0-9.]+)\s*\|\s*Temp:\s*([0-9.]+)/,
    );

    if (verboseMatch) {
      rows.push([
        verboseMatch[1],
        verboseMatch[2],
        verboseMatch[3],
        verboseMatch[4],
      ]);
      continue;
    }

    // Match simple CSV-like format
    const simpleMatch = line.match(
      /^\s*([0-9.]+)\s*,\s*([0-9.]+)\s*,\s*([0-9.]+)\s*,\s*([0-9.]+)\s*$/,
    );

    if (simpleMatch) {
      rows.push([
        simpleMatch[1],
        simpleMatch[2],
        simpleMatch[3],
        simpleMatch[4],
      ]);
    }
  }

  return rows.map((row) => row.join(",")).join("\n");
}

// 🔥 MAIN EXECUTION
const input = fs.readFileSync("input.txt", "utf-8");
const csv = telemetryToCSV(input);

fs.writeFileSync("output.csv", csv);

console.log("✅ Converted input.txt → output.csv");
