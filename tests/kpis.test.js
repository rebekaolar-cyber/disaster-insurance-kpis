// Run with: node --test tests/*.test.js
const test = require("node:test");
const assert = require("node:assert/strict");
const KPI = require("../site/kpis.js");

const payload = {
  cols: ["n", "s", "t", "i", "d", "b", "ia", "ihp", "pa", "cab", "hm"],
  rows: [
    [1, "TX", "DR", "Flood", "2020-01-15", "2020-01-01", 1, 100, 1000, 400, 50],
    [2, "TX", "DR", "Flood", "2021-01-15", "2021-01-15", 0, null, 200, null, null],
    [3, "TX", "EM", "Hurricane", "2021-08-01", "2021-08-10", 0, null, null, null, null], // declared before start
    [4, "FL", "DR", "Hurricane", "2022-09-29", "2022-09-22", 1, 50, 3000, 3500, 10], // cab > pa (data quirk)
    [5, "FL", "FM", "Fire", "2010-06-01", null, 0, null, null, null, null],
  ],
};
const rows = KPI.decode(payload);
const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} != ${b}`);

test("decode adds year", () => {
  assert.equal(rows.length, 5);
  assert.equal(rows[0].year, 2020);
});

test("filters by year, type and state", () => {
  assert.equal(KPI.filterRows(rows, { from: 2021, to: 2021 }).length, 2);
  assert.equal(KPI.filterRows(rows, { types: ["DR"] }).length, 3);
  assert.equal(KPI.filterRows(rows, { state: "FL" }).length, 2);
});

test("payout: channels add up to the total, no double count", () => {
  const flood = KPI.payoutByType(rows).find((d) => d.type === "Flood");
  // total = ihp 100 + pa 1000 + pa 200 = 1300 over 2 disasters
  close(flood.avgTotal, 650);
  close(flood.avgIhp + flood.avgPaEmergency + flood.avgPaOther, flood.avgTotal);
  close(flood.avgPaEmergency, 200); // 400 / 2
});

test("payout: disasters without a payout record are left out, not counted as $0", () => {
  const h = KPI.payoutByType(rows).find((d) => d.type === "Hurricane");
  assert.equal(h.n, 1);
  assert.equal(h.declared, 2);
  assert.equal(KPI.payoutByType(rows).find((d) => d.type === "Fire"), undefined);
  const cov = KPI.payoutCoverage(rows);
  assert.equal(cov.withRecord, 3);
  assert.equal(cov.firstYear, 2020);
});

test("payout: emergency work is capped at total PA", () => {
  const h = KPI.payoutByType(rows).find((d) => d.type === "Hurricane");
  close(h.avgTotal, 50 + 3000);
  close(h.avgPaEmergency, 3000);
  close(h.avgPaOther, 0);
});

test("payout: HMGP only counted when asked", () => {
  const f = (o) => KPI.payoutByType(rows, o).find((d) => d.type === "Flood").avgTotal;
  close(f({ includeHm: true }) - f({}), 25);
});

test("lag: weeks, excludes missing and negative", () => {
  const { rows: lag, excluded } = KPI.lagByType(rows);
  const flood = lag.find((d) => d.type === "Flood");
  close(flood.weeks, (14 / 7 + 0) / 2);
  assert.equal(flood.n, 2);
  assert.equal(excluded, 2); // hurricane declared early + fire without start
  assert.equal(lag.find((d) => d.type === "Hurricane").n, 1);
  close(KPI.lagByType(rows, "median").rows.find((d) => d.type === "Flood").weeks, 1);
});

test("tiers", () => {
  assert.equal(KPI.lagTier(2.9), "Fast");
  assert.equal(KPI.lagTier(6), "Moderate");
  assert.equal(KPI.lagTier(6.1), "Slow");
  assert.equal(KPI.iaTier(0.51), "High");
  assert.equal(KPI.iaTier(0.3), "Medium");
  assert.equal(KPI.iaTier(0.1), "Low");
  assert.equal(KPI.iaTier(0), "None");
});

test("household aid rate", () => {
  const ia = KPI.iaRateByType(rows);
  close(ia.find((d) => d.type === "Flood").rate, 0.5);
  close(KPI.iaOverall(rows).rate, 2 / 5);
});

test("PDLS follows the report formula", () => {
  const p = KPI.pdls(rows, 0.6);
  const tx = p.find((d) => d.state === "TX"); // 3 disasters, 2 types (max)
  const fl = p.find((d) => d.state === "FL"); // 2 disasters, 2 types
  close(tx.score, 0.6 * 1 + 0.4 * 1);
  close(fl.score, 0.6 * (2 / 3) + 0.4 * 1);
  assert.equal(p[0].state, "TX");
  close(KPI.pdls(rows, 0).find((d) => d.state === "FL").score, 1);
});

test("money formatting", () => {
  assert.equal(KPI.money(1.25e9), "$1.3B");
  assert.equal(KPI.money(25e9), "$25B");
  assert.equal(KPI.money(4.2e6), "$4.2M");
  assert.equal(KPI.money(950), "$950");
});
