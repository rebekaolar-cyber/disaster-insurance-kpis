// Writes the dashboard's own KPI results (site/kpis.js, default settings,
// all years) so dbt can check its KPI tables against them.
// Usage: node scripts/export_kpis.js <disasters.json> <out.json>
const fs = require("fs");
const path = require("path");
const KPI = require(path.join(__dirname, "..", "site", "kpis.js"));

const [input, output] = process.argv.slice(2);
if (!input || !output) {
  console.error("usage: node scripts/export_kpis.js <disasters.json> <out.json>");
  process.exit(2);
}
const rows = KPI.decode(JSON.parse(fs.readFileSync(input, "utf8")));
const pairs = (list, key, value) => list.map((d) => ({ key: d[key], value: d[value] }));
const out = {
  payout: pairs(KPI.payoutByType(rows), "type", "avgTotal"),
  lag_mean: pairs(KPI.lagByType(rows, "mean").rows, "type", "weeks"),
  lag_median: pairs(KPI.lagByType(rows, "median").rows, "type", "weeks"),
  household_aid: pairs(KPI.iaRateByType(rows), "type", "rate"),
  pdls: pairs(KPI.pdls(rows, 0.6), "state", "score"),
};
fs.writeFileSync(output, JSON.stringify(out));
console.log(`wrote ${output}: ${Object.values(out).reduce((n, l) => n + l.length, 0)} KPI values`);
