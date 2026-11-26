/* global Plotly, KPI */
"use strict";

const STATE_NAMES = {
  AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas", CA: "California", CO: "Colorado",
  CT: "Connecticut", DE: "Delaware", DC: "District of Columbia", FL: "Florida", GA: "Georgia",
  HI: "Hawaii", ID: "Idaho", IL: "Illinois", IN: "Indiana", IA: "Iowa", KS: "Kansas",
  KY: "Kentucky", LA: "Louisiana", ME: "Maine", MD: "Maryland", MA: "Massachusetts",
  MI: "Michigan", MN: "Minnesota", MS: "Mississippi", MO: "Missouri", MT: "Montana",
  NE: "Nebraska", NV: "Nevada", NH: "New Hampshire", NJ: "New Jersey", NM: "New Mexico",
  NY: "New York", NC: "North Carolina", ND: "North Dakota", OH: "Ohio", OK: "Oklahoma",
  OR: "Oregon", PA: "Pennsylvania", RI: "Rhode Island", SC: "South Carolina", SD: "South Dakota",
  TN: "Tennessee", TX: "Texas", UT: "Utah", VT: "Vermont", VA: "Virginia", WA: "Washington",
  WV: "West Virginia", WI: "Wisconsin", WY: "Wyoming", PR: "Puerto Rico", GU: "Guam",
  VI: "US Virgin Islands", AS: "American Samoa", MP: "Northern Mariana Islands",
  FM: "Micronesia", MH: "Marshall Islands", PW: "Palau",
};
const nameOf = (s) => STATE_NAMES[s] || s;

const C = {
  ink: "#14213d", muted: "#718096", line: "#e6e1d8", grey: "#d9d4ca",
  ihp: "#c8553d", paEm: "#e0a526", paOther: "#2b6cb0", hm: "#2f855a",
  Fast: "#3a9d5d", Moderate: "#e0a526", Slow: "#c8553d",
  High: "#3a9d5d", Medium: "#e0a526", Low: "#c8553d", None: "#a0aec0",
};
const FONT = { family: '-apple-system, BlinkMacSystemFont, "Segoe UI", Inter, Roboto, sans-serif', color: C.ink, size: 13 };
const CONFIG = { displayModeBar: false, responsive: true, topojsonURL: "vendor/topojson/" };

const state = {
  all: [], meta: null, from: null, to: null, types: null, st: "",
  selected: null, includeHm: false, stat: "mean", minN: true, w: 0.6,
};

const $ = (id) => document.getElementById(id);
const pct = (x) => (x * 100).toFixed(0) + "%";
const fmtInt = (x) => x.toLocaleString("en-US");
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

function layout(extra) {
  return Object.assign({
    font: FONT, paper_bgcolor: "rgba(0,0,0,0)", plot_bgcolor: "rgba(0,0,0,0)",
    margin: { l: 130, r: 30, t: 20, b: 40 }, hoverlabel: { font: FONT, bgcolor: "#fff" },
  }, extra);
}

// Highlight the clicked disaster type in every type chart.
const dim = (type, color) => (state.selected && state.selected !== type ? C.grey : color);

function current() {
  return KPI.filterRows(state.all, { from: state.from, to: state.to, types: state.types, state: state.st || null });
}

// ---------- charts ----------

function drawFinancial(rows) {
  const minN = state.minN ? 10 : 1;
  const data = KPI.payoutByType(rows, { includeHm: state.includeHm }).filter((d) => d.n >= minN).slice(0, 14).reverse();
  const y = data.map((d) => d.type);
  const series = [
    ["avgIhp", "Households (IHP)", C.ihp],
    ["avgPaEmergency", "Public Assistance: emergency work", C.paEm],
    ["avgPaOther", "Public Assistance: permanent work", C.paOther],
  ];
  if (state.includeHm) series.push(["avgHm", "Hazard mitigation (HMGP)", C.hm]);
  const traces = series.map(([k, name, color]) => ({
    type: "bar", orientation: "h", name, y, x: data.map((d) => d[k]),
    marker: { color: data.map((d) => dim(d.type, color)) },
    customdata: data.map((d) => [d.n, KPI.money(d.avgTotal)]),
    text: data.map((d) => KPI.money(d[k])), textposition: "none",
    hovertemplate: `<b>%{y}</b><br>${name}: %{text}<br>Total per disaster: %{customdata[1]}<br>%{customdata[0]} disasters<extra></extra>`,
  }));
  traces.push({
    type: "scatter", mode: "text", y, x: data.map((d) => d.avgTotal), showlegend: false, hoverinfo: "skip",
    text: data.map((d) => `  ${KPI.money(d.avgTotal)} · n=${fmtInt(d.n)}`), textposition: "middle right",
    textfont: { size: 11, color: C.muted },
  });
  const max = Math.max(1, ...data.map((d) => d.avgTotal));
  Plotly.react("c-fin", traces, layout({
    barmode: "stack", height: 470,
    xaxis: { title: "Average payout per disaster (USD)", tickprefix: "$", exponentformat: "B", gridcolor: C.line, range: [0, max * 1.35] },
    yaxis: { automargin: true },
    legend: { orientation: "h", y: -0.16, font: { size: 12 } },
    margin: { l: 10, r: 20, t: 10, b: 90 },
  }), CONFIG);

  const all = KPI.payoutByType(rows, { includeHm: state.includeHm }).filter((d) => d.n >= minN);
  const cov = KPI.payoutCoverage(rows);
  $("n-fin").textContent = cov.withRecord
    ? `Averaged over the ${fmtInt(cov.withRecord)} of ${fmtInt(cov.n)} disasters in this filter that have a FEMA payout record (records start in ${cov.firstYear}).`
    : "";
  if (!all.length) return ($("t-fin").textContent = "No disasters with payout records match these filters.");
  const top = all[0];
  const common = [...all].sort((a, b) => b.n - a.n)[0];
  $("t-fin").innerHTML = `<b>${esc(top.type)}</b> is the costliest per event: <b>${KPI.money(top.avgTotal)}</b> per disaster across ${fmtInt(top.n)} disasters. ` +
    (common.type !== top.type ? `<b>${esc(common.type)}</b> is the most frequent (${fmtInt(common.n)}) at ${KPI.money(common.avgTotal)} each.` : "It is also the most frequent.");
}

function drawProcess(rows) {
  const { rows: data, excluded } = KPI.lagByType(rows, state.stat);
  const minN = state.minN ? 10 : 3;
  const shown = data.filter((d) => d.n >= minN).slice(0, 18).reverse();
  Plotly.react("c-proc", [{
    type: "bar", orientation: "h", y: shown.map((d) => d.type), x: shown.map((d) => d.weeks),
    marker: { color: shown.map((d) => dim(d.type, C[KPI.lagTier(d.weeks)])) },
    text: shown.map((d) => d.weeks.toFixed(1)), textposition: "outside", cliponaxis: false,
    customdata: shown.map((d) => [d.n, KPI.lagTier(d.weeks)]),
    hovertemplate: "<b>%{y}</b><br>%{x:.1f} weeks · %{customdata[1]}<br>%{customdata[0]} disasters<extra></extra>",
  }], layout({
    height: 470, margin: { l: 10, r: 40, t: 10, b: 50 },
    xaxis: { title: `${state.stat === "median" ? "Median" : "Average"} weeks from incident start to declaration`, gridcolor: C.line, zeroline: false },
    yaxis: { automargin: true },
    shapes: [3, 6].map((x) => ({ type: "line", x0: x, x1: x, yref: "paper", y0: 0, y1: 1, line: { dash: "dot", color: C.muted, width: 1 } })),
    annotations: [
      { x: 1.5, y: 1.02, yref: "paper", text: "fast", showarrow: false, font: { size: 11, color: C.Fast } },
      { x: 4.5, y: 1.02, yref: "paper", text: "moderate", showarrow: false, font: { size: 11, color: "#b7841a" } },
      { x: 7.5, y: 1.02, yref: "paper", text: "slow", showarrow: false, font: { size: 11, color: C.Slow } },
    ],
  }), CONFIG);

  $("n-proc").textContent = `Types with fewer than ${minN} dated disasters are hidden (one old eruption can swing an average). ${fmtInt(excluded)} disasters left out (no start date, or declared before the incident began).`;
  const ranked = data.filter((d) => d.n >= minN);
  if (!ranked.length) return ($("t-proc").textContent = "Not enough dated disasters for these filters.");
  const slow = ranked[0], fast = ranked[ranked.length - 1];
  const nSlow = ranked.filter((d) => d.weeks > 6).length;
  $("t-proc").innerHTML = `<b>${esc(slow.type)}</b> takes longest to be declared: <b>${slow.weeks.toFixed(1)} weeks</b>; <b>${esc(fast.type)}</b> only ${fast.weeks.toFixed(1)}. ` +
    `${nSlow} of ${ranked.length} types fall in the slow tier (over 6 weeks).`;
}

function drawCustomer(rows) {
  const overall = KPI.iaOverall(rows);
  Plotly.react("c-donut", [{
    type: "pie", hole: 0.62, sort: false, direction: "clockwise",
    values: [overall.activated, overall.n - overall.activated], labels: ["Household aid activated", "Not activated"],
    marker: { colors: ["#5a67d8", "#e6e1d8"] }, textinfo: "none",
    hovertemplate: "%{label}: %{value:,} disasters (%{percent})<extra></extra>",
  }], layout({
    height: 300, margin: { l: 10, r: 10, t: 30, b: 10 }, showlegend: false,
    annotations: [{ text: `<b>${pct(overall.rate)}</b><br><span style="font-size:11px">activated</span>`, showarrow: false, font: { size: 22 } }],
    title: { text: "All disasters", font: { size: 13, color: C.muted }, y: 0.98 },
  }), CONFIG);

  let data = KPI.iaRateByType(rows);
  if (state.minN) data = data.filter((d) => d.n >= 10);
  const shown = data.slice(0, 16).reverse();
  Plotly.react("c-cust", [{
    type: "bar", orientation: "h", y: shown.map((d) => d.type), x: shown.map((d) => d.rate),
    marker: { color: shown.map((d) => dim(d.type, C[KPI.iaTier(d.rate)])) },
    text: shown.map((d) => `${pct(d.rate)}  (${fmtInt(d.n)})`), textposition: "outside", cliponaxis: false,
    customdata: shown.map((d) => [d.activated, d.n, KPI.iaTier(d.rate)]),
    hovertemplate: "<b>%{y}</b><br>%{x:.1%} activated · %{customdata[2]}<br>%{customdata[0]} of %{customdata[1]} disasters<extra></extra>",
  }], layout({
    height: 470, margin: { l: 10, r: 70, t: 10, b: 50 },
    xaxis: { title: "Share of disasters with household aid", tickformat: ".0%", range: [0, 1.15], gridcolor: C.line },
    yaxis: { automargin: true },
    shapes: [0.3, 0.5].map((x) => ({ type: "line", x0: x, x1: x, yref: "paper", y0: 0, y1: 1, line: { dash: "dot", color: C.muted, width: 1 } })),
  }), CONFIG);

  if (!data.length) return ($("t-cust").textContent = "Not enough disasters for these filters.");
  const top3 = data.slice(0, 3).map((d) => `${esc(d.type)} (${pct(d.rate)})`).join(", ");
  const low = data[data.length - 1];
  $("t-cust").innerHTML = `<b>${pct(overall.rate)}</b> of declarations needed federal aid for households. Highest rates: <b>${top3}</b>.` +
    (data.length > 3 ? ` Lowest: ${esc(low.type)} (${pct(low.rate)}), where existing cover or other programmes seem to carry more.` : "");
}

function drawLearning(rows) {
  const data = KPI.pdls(rows, state.w);
  const inMap = data.filter((d) => d.state.length === 2 && STATE_NAMES[d.state]);
  Plotly.react("c-map", [{
    type: "choropleth", locationmode: "USA-states", locations: inMap.map((d) => d.state), z: inMap.map((d) => d.score),
    zmin: 0, zmax: 1,
    colorscale: [[0, "#f0f4ec"], [0.35, "#a8d5a2"], [0.6, "#3a9d5d"], [0.8, "#e0a526"], [1, "#c8553d"]],
    marker: { line: { color: "#fff", width: 0.8 } },
    customdata: inMap.map((d) => [nameOf(d.state), d.count, d.types, d.dfls, d.hdls, KPI.pdlsTier(d.score)]),
    hovertemplate: "<b>%{customdata[0]}</b><br>PDLS %{z:.2f} · %{customdata[5]}<br>%{customdata[1]} disasters, %{customdata[2]} hazard types<br>frequency %{customdata[3]:.2f} · diversity %{customdata[4]:.2f}<extra></extra>",
    colorbar: { title: { text: "PDLS", side: "top" }, thickness: 10, len: 0.6, tickformat: ".1f" },
  }], layout({
    height: 470, margin: { l: 0, r: 0, t: 10, b: 0 },
    geo: { scope: "usa", projection: { type: "albers usa" }, bgcolor: "rgba(0,0,0,0)", showlakes: false },
  }), CONFIG);

  $("w-f").textContent = state.w.toFixed(2);
  $("w-d").textContent = (1 - state.w).toFixed(2);
  $("o-w-out").textContent = state.w.toFixed(2);
  $("top-states").innerHTML = data.slice(0, 8).map((d) => `<li>${esc(nameOf(d.state))} <span>${d.score.toFixed(2)}</span></li>`).join("");
  if (!data.length) return ($("t-learn").textContent = "No disasters match these filters.");
  const t = data.slice(0, 3).map((d) => `${esc(nameOf(d.state))} (${d.score.toFixed(2)})`).join(", ");
  $("t-learn").innerHTML = `Strongest history to learn from: <b>${t}</b>. Move the slider to see how much the ranking depends on the weighting.`;
}

function drawCards(rows) {
  const pay = KPI.payoutByType(rows, { includeHm: state.includeHm }).filter((d) => d.n >= (state.minN ? 10 : 1));
  const lag = KPI.lagByType(rows, state.stat).rows.filter((d) => d.n >= (state.minN ? 10 : 3));
  const ia = KPI.iaOverall(rows);
  const pd = KPI.pdls(rows, state.w);
  const cards = [
    ["#financial", "var(--fin)", "Financial", pay[0] ? KPI.money(pay[0].avgTotal) : "–", pay[0] ? `per ${pay[0].type.toLowerCase()} disaster, the costliest type` : ""],
    ["#process", "var(--proc)", "Internal process", lag[0] ? `${lag[0].weeks.toFixed(1)} wks` : "–", lag[0] ? `to declare ${lag[0].type.toLowerCase()}, the slowest type` : ""],
    ["#customer", "var(--cust)", "Customer", pct(ia.rate), "of disasters needed household aid"],
    ["#learning", "var(--learn)", "Learning & growth", pd[0] ? nameOf(pd[0].state) : "–", pd[0] ? `top learning score (${pd[0].score.toFixed(2)})` : ""],
  ];
  $("cards").innerHTML = cards.map(([href, c, label, big, sub]) =>
    `<a class="card" href="${href}" style="--c:${c}"><small>${label}</small><b>${esc(big)}</b><span>${esc(sub)}</span></a>`).join("");

  const total = rows.reduce((s, r) => s + (r.ihp || 0) + (r.pa || 0) + (state.includeHm ? r.hm || 0 : 0), 0);
  const years = rows.length ? `${Math.min(...rows.map((r) => r.year))}–${Math.max(...rows.map((r) => r.year))}` : "";
  $("stats").innerHTML =
    `<div class="stat"><b>${fmtInt(rows.length)}</b><span>disasters declared ${years}</span></div>` +
    `<div class="stat"><b>${KPI.money(total)}</b><span>federal aid to households and public assistance</span></div>` +
    `<div class="stat"><b>${pct(ia.rate)}</b><span>triggered aid to individual households</span></div>`;
}

function drawRecs(rows) {
  const pay = KPI.payoutByType(rows, { includeHm: state.includeHm }).filter((d) => d.n >= 10);
  const ia = KPI.iaRateByType(rows).filter((d) => d.n >= 10);
  const lag = KPI.lagByType(rows, state.stat).rows.filter((d) => d.n >= 10);
  const pd = KPI.pdls(rows, state.w);
  const recs = [];
  const gap = ia.filter((d) => d.rate > 0.5).length >= 2 ? ia.filter((d) => d.rate > 0.5) : ia;
  if (ia.length) recs.push(["Close the household gap", `Build or widen cover for ${gap.slice(0, 3).map((d) => d.type.toLowerCase()).join(", ")}: these trigger federal household aid most often, a sign that private cover falls short.`]);
  if (pay.length) recs.push(["Price the costliest types first", `${pay.slice(0, 2).map((d) => d.type).join(" and ")} cost the most per event (${KPI.money(pay[0].avgTotal)} for the top one). Consider parametric policies that pay out at a set trigger, such as wind speed or magnitude.`]);
  if (lag.length) recs.push(["Staff claims to the declaration clock", `${lag[lag.length - 1].type} is declared within ${lag[lag.length - 1].weeks.toFixed(1)} weeks, so claims teams must be ready at once. ${lag[0].type} takes ${lag[0].weeks.toFixed(1)} weeks, leaving time to assess damage first.`]);
  if (pd.length > 3) recs.push(["Add an uncertainty surcharge where history is thin", `Use the learning score when pricing: ${nameOf(pd[0].state)} and ${nameOf(pd[1].state)} have the richest history; low-scoring states need a margin for the unknown.`]);
  $("rec-grid").innerHTML = recs.map(([h, p]) => `<div class="rec"><h3>${esc(h)}</h3><p>${esc(p)}</p></div>`).join("");
}

function render() {
  const rows = current();
  drawCards(rows);
  drawFinancial(rows);
  drawProcess(rows);
  drawCustomer(rows);
  drawLearning(rows);
  drawRecs(rows);
  const chip = $("sel-chip");
  if (state.selected) {
    chip.hidden = false;
    chip.innerHTML = `Highlighting: ${esc(state.selected)} <button aria-label="Clear highlight">×</button>`;
    chip.querySelector("button").onclick = () => { state.selected = null; render(); };
  } else chip.hidden = true;
}

// ---------- controls ----------

function bindSeg(id, onPick) {
  $(id).addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    $(id).querySelectorAll("button").forEach((x) => x.classList.toggle("on", x === b));
    onPick(b.dataset.v);
    render();
  });
}

function setup(payload) {
  state.all = KPI.decode(payload);
  state.meta = payload.meta;
  const years = [...new Set(state.all.map((r) => r.year))].sort((a, b) => a - b);
  const minY = years[0], maxY = years[years.length - 1];
  state.from = minY; state.to = maxY;
  const opts = years.map((y) => `<option>${y}</option>`).join("");
  $("f-from").innerHTML = opts; $("f-to").innerHTML = opts;
  $("f-from").value = minY; $("f-to").value = maxY;
  const states = [...new Set(state.all.map((r) => r.s))].filter(Boolean).sort((a, b) => nameOf(a).localeCompare(nameOf(b)));
  $("f-state").innerHTML += states.map((s) => `<option value="${esc(s)}">${esc(nameOf(s))}</option>`).join("");
  $("span-years").textContent = `${minY}–${maxY}`;
  $("meta-line").textContent = `Last refreshed ${payload.meta.built}; ${fmtInt(payload.meta.disasters)} disasters declared ${payload.meta.first} to ${payload.meta.last}.`;

  $("f-from").onchange = (e) => { state.from = +e.target.value; if (state.from > state.to) { state.to = state.from; $("f-to").value = state.to; } render(); };
  $("f-to").onchange = (e) => { state.to = +e.target.value; if (state.to < state.from) { state.from = state.to; $("f-from").value = state.from; } render(); };
  $("f-state").onchange = (e) => { state.st = e.target.value; render(); };
  bindSeg("f-type", (v) => (state.types = v === "all" ? null : [v]));
  bindSeg("o-stat", (v) => (state.stat = v));
  $("o-hm").onchange = (e) => { state.includeHm = e.target.checked; render(); };
  $("o-minn").onchange = (e) => { state.minN = e.target.checked; render(); };
  $("o-w").oninput = (e) => { state.w = +e.target.value; render(); };
  $("f-reset").onclick = () => {
    Object.assign(state, { from: minY, to: maxY, types: null, st: "", selected: null, includeHm: false, stat: "mean", minN: true, w: 0.6 });
    $("f-from").value = minY; $("f-to").value = maxY; $("f-state").value = "";
    $("o-hm").checked = false; $("o-minn").checked = true; $("o-w").value = 0.6;
    for (const id of ["f-type", "o-stat"]) $(id).querySelectorAll("button").forEach((b, i) => b.classList.toggle("on", i === 0));
    render();
  };

  render();
  for (const id of ["c-fin", "c-proc", "c-cust"]) {
    $(id).on("plotly_click", (ev) => {
      const type = ev.points && ev.points[0] && ev.points[0].y;
      if (!type) return;
      state.selected = state.selected === type ? null : type;
      render();
    });
  }
  $("loading").hidden = true;
}

window.addEventListener("DOMContentLoaded", () => {
  fetch("data/disasters.json")
    .then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(setup)
    .catch((err) => { $("loading").textContent = "Could not load the data (" + err.message + "). Please refresh."; });
});
