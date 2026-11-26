// KPI calculations for the dashboard. Pure functions, no DOM, so they can be
// tested with Node and reused in the browser (window.KPI).
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.KPI = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const DAY = 24 * 60 * 60 * 1000;

  function decode(payload) {
    const cols = payload.cols;
    return payload.rows.map((row) => {
      const r = {};
      cols.forEach((c, i) => (r[c] = row[i]));
      r.year = Number(String(r.d).slice(0, 4));
      return r;
    });
  }

  // filters: {from, to, types: ["DR","EM","FM"] or null for all, state: "TX" or null}
  function filterRows(rows, f) {
    return rows.filter(
      (r) =>
        (f.from == null || r.year >= f.from) &&
        (f.to == null || r.year <= f.to) &&
        (!f.types || f.types.includes(r.t)) &&
        (!f.state || r.s === f.state)
    );
  }

  function groupBy(rows, key) {
    const m = new Map();
    for (const r of rows) {
      const k = r[key];
      if (!m.has(k)) m.set(k, []);
      m.get(k).push(r);
    }
    return m;
  }

  const num = (v) => (typeof v === "number" && isFinite(v) ? v : 0);

  // Financial KPI: average federal payout per disaster, by incident type.
  // Public Assistance (pa) already contains emergency work (Category A-B, cab),
  // so the channels are IHP + PA emergency + PA permanent/other (+ HMGP).
  // Disasters without a payout record count as zero, as in the KPI formula
  // (total payout for a type / number of disasters of that type).
  function payoutByType(rows, opts = {}) {
    const includeHm = !!opts.includeHm;
    const out = [];
    for (const [type, list] of groupBy(rows, "i")) {
      let ihp = 0, paEm = 0, paOther = 0, hm = 0;
      for (const r of list) {
        const pa = num(r.pa);
        const cab = Math.min(num(r.cab), pa);
        ihp += num(r.ihp);
        paEm += cab;
        paOther += pa - cab;
        hm += num(r.hm);
      }
      const n = list.length;
      const total = ihp + paEm + paOther + (includeHm ? hm : 0);
      out.push({
        type, n,
        avgIhp: ihp / n, avgPaEmergency: paEm / n, avgPaOther: paOther / n,
        avgHm: includeHm ? hm / n : 0,
        avgTotal: total / n, total,
      });
    }
    return out.sort((a, b) => b.avgTotal - a.avgTotal);
  }

  function median(xs) {
    if (!xs.length) return null;
    const s = [...xs].sort((a, b) => a - b);
    const m = Math.floor(s.length / 2);
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
  }

  // Internal-process KPI: weeks from incident start to FEMA's declaration.
  // Records without a start date, or declared before the incident began
  // (e.g. emergencies declared ahead of a hurricane), are left out and counted.
  function lagByType(rows, stat = "mean") {
    const out = [];
    let excluded = 0;
    for (const [type, list] of groupBy(rows, "i")) {
      const weeks = [];
      for (const r of list) {
        if (!r.b || !r.d) { excluded++; continue; }
        const w = (Date.parse(r.d) - Date.parse(r.b)) / DAY / 7;
        if (!isFinite(w) || w < 0) { excluded++; continue; }
        weeks.push(w);
      }
      if (!weeks.length) continue;
      const value = stat === "median" ? median(weeks)
        : weeks.reduce((a, b) => a + b, 0) / weeks.length;
      out.push({ type, n: weeks.length, weeks: value });
    }
    out.sort((a, b) => b.weeks - a.weeks);
    return { rows: out, excluded };
  }

  function lagTier(weeks) {
    return weeks < 3 ? "Fast" : weeks <= 6 ? "Moderate" : "Slow";
  }

  // Customer KPI: share of disasters where FEMA activated aid for individual
  // households (IA or IHP), i.e. where people were left needing federal help.
  function iaRateByType(rows) {
    const out = [];
    for (const [type, list] of groupBy(rows, "i")) {
      const activated = list.filter((r) => r.ia === 1).length;
      out.push({ type, n: list.length, activated, rate: activated / list.length });
    }
    return out.sort((a, b) => b.rate - a.rate || b.n - a.n);
  }

  function iaOverall(rows) {
    const activated = rows.filter((r) => r.ia === 1).length;
    return { n: rows.length, activated, rate: rows.length ? activated / rows.length : 0 };
  }

  function iaTier(rate) {
    return rate > 0.5 ? "High" : rate >= 0.3 ? "Medium" : rate > 0 ? "Low" : "None";
  }

  // Learning & growth KPI: Predictive Disaster Learning Score per state.
  // DFLS = disasters in state / max disasters in any state
  // HDLS = distinct incident types in state / max distinct types in any state
  // PDLS = wFreq * DFLS + (1 - wFreq) * HDLS   (report used wFreq = 0.6)
  function pdls(rows, wFreq = 0.6) {
    const states = [];
    for (const [state, list] of groupBy(rows, "s")) {
      if (!state) continue;
      states.push({ state, count: list.length, types: new Set(list.map((r) => r.i)).size });
    }
    const maxCount = Math.max(1, ...states.map((s) => s.count));
    const maxTypes = Math.max(1, ...states.map((s) => s.types));
    for (const s of states) {
      s.dfls = s.count / maxCount;
      s.hdls = s.types / maxTypes;
      s.score = wFreq * s.dfls + (1 - wFreq) * s.hdls;
    }
    return states.sort((a, b) => b.score - a.score);
  }

  function pdlsTier(score) {
    return score >= 0.75 ? "High" : score >= 0.5 ? "Medium-High" : score >= 0.25 ? "Medium-Low" : "Low";
  }

  function money(v) {
    const a = Math.abs(v);
    if (a >= 1e9) return "$" + (v / 1e9).toFixed(a >= 1e10 ? 0 : 1) + "B";
    if (a >= 1e6) return "$" + (v / 1e6).toFixed(a >= 1e7 ? 0 : 1) + "M";
    if (a >= 1e3) return "$" + (v / 1e3).toFixed(0) + "K";
    return "$" + v.toFixed(0);
  }

  return {
    decode, filterRows, payoutByType, lagByType, lagTier, iaRateByType,
    iaOverall, iaTier, pdls, pdlsTier, median, money,
  };
});
