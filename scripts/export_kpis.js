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
const pay = KPI.payoutByType(rows, { includeHm: true });
const lagMean = KPI.lagByType(rows, "mean").rows;
const ia = KPI.iaRateByType(rows);
const pd = KPI.pdls(rows, 0.6);
const LAG_TIER = { Fast: 0, Moderate: 1, Slow: 2 };
const AID_TIER = { None: 0, Low: 1, Medium: 2, High: 3 };
const out = {
  // headline values (the total excludes HMGP, as on the page by default)
  payout: pairs(KPI.payoutByType(rows), "type", "avgTotal"),
  lag_mean: pairs(lagMean, "type", "weeks"),
  lag_median: pairs(KPI.lagByType(rows, "median").rows, "type", "weeks"),
  household_aid: pairs(ia, "type", "rate"),
  pdls: pairs(pd, "state", "score"),
  // every other column of the KPI tables
  payout_ihp: pairs(pay, "type", "avgIhp"),
  payout_pa_emergency: pairs(pay, "type", "avgPaEmergency"),
  payout_pa_other: pairs(pay, "type", "avgPaOther"),
  payout_hmgp: pairs(pay, "type", "avgHm"),
  payout_n: pairs(pay, "type", "n"),
  lag_n: pairs(lagMean, "type", "n"),
  lag_tier: lagMean.map((d) => ({ key: d.type, value: LAG_TIER[KPI.lagTier(d.weeks)] })),
  aid_n: pairs(ia, "type", "n"),
  aid_activated: pairs(ia, "type", "activated"),
  aid_tier: ia.map((d) => ({ key: d.type, value: AID_TIER[KPI.iaTier(d.rate)] })),
  pdls_count: pairs(pd, "state", "count"),
  pdls_types: pairs(pd, "state", "types"),
  pdls_frequency: pairs(pd, "state", "dfls"),
  pdls_diversity: pairs(pd, "state", "hdls"),
};
fs.writeFileSync(output, JSON.stringify(out));
console.log(`wrote ${output}: ${Object.values(out).reduce((n, l) => n + l.length, 0)} KPI values`);
