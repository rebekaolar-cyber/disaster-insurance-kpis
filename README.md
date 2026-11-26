# Where disasters outrun insurance

**Live dashboard:** https://rebekaolar-cyber.github.io/disaster-insurance-kpis/

An interactive KPI dashboard on every US federal disaster declaration since 1953, built on FEMA's open data. It answers four questions an insurer would ask:

| KPI | Question | Formula |
|---|---|---|
| **Financial** | Which disaster types cost the most per event? | Total federal payout for a type ÷ number of disasters of that type |
| **Internal process** | How long until FEMA declares a disaster? | Declaration date − incident start date, averaged (or median) per type |
| **Customer** | Where are households left needing federal aid? | Disasters with Individual Assistance / IHP activated ÷ all disasters of that type |
| **Learning & growth** | Which states have the richest history to price risk from? | PDLS = w × frequency score + (1 − w) × hazard-diversity score (w = 0.6 by default, adjustable) |

Every chart, headline number, finding and recommendation is recalculated in the browser when you change the period, declaration type or state. Click a disaster type in any chart to highlight it across all three type charts.

## How it works

```
OpenFEMA API ──► scripts/build_data.py ──► site/data/disasters.json ──► site/ (static page, Plotly)
   (weekly GitHub Action)        one row per disaster, ~300 KB          KPIs computed in site/kpis.js
```

- **Data:** `DisasterDeclarationsSummaries` v2 (one row per declared county, collapsed to one row per disaster) and `FemaWebDisasterSummaries` v1 (federal money per disaster).
- **Refresh:** `.github/workflows/publish.yml` runs the tests, re-downloads both datasets every Monday, commits the new data file if it changed and redeploys GitHub Pages. It refuses to publish if the download looks broken (fewer than 3,000 disasters).
- **No server, no build step:** the page is plain HTML, CSS and JavaScript. Plotly and the US map file are vendored in `site/vendor/` so the page does not depend on a CDN.

### Definitions and choices

- **Payout** = Individuals & Households Program approvals + Public Assistance obligations (hazard mitigation grants optional). Public Assistance is shown split into emergency work (categories A–B) and permanent work, so the stacked bars add up to the total. Disasters without a payout record count as $0, as the KPI formula divides by all disasters of a type.
- **Household aid** counts a disaster if the IA program (older disasters) or the IHP (newer disasters) was declared for at least one area.
- **Declaration lag** leaves out disasters without a start date or declared before the incident began (for example emergencies declared ahead of a hurricane's landfall). The page shows how many were left out.
- **Small samples:** types with fewer than 10 disasters can be hidden in the customer chart, so a 6-for-6 type doesn't top the ranking.

## Run it locally

```bash
python scripts/build_data.py            # downloads from fema.gov (a few minutes)
cd site && python -m http.server 8000   # open http://localhost:8000
```

Tests (Python pipeline + JavaScript KPI maths):

```bash
pip install pytest && pytest -q tests
node --test tests/*.test.js
```

## Origin

This began as a four-person University of Twente group project (Business Intelligence & Databases, BSc Business Information Technology): a normalised SQLite database, a balanced scorecard with these four KPIs, a Tableau dashboard and data mining in Orange, on a fixed data extract.

I rebuilt it as an open, self-updating dashboard: a tested Python pipeline from FEMA's live API, the KPI calculations in tested JavaScript, and an interactive page anyone can open. The rebuild also fixed a double count: the original payout chart stacked emergency-work spending on top of total Public Assistance, which already contains it. It adds filters, a median option, small-sample hiding and a slider to test the PDLS weighting.

## Credits

Data: [OpenFEMA](https://www.fema.gov/about/openfema/data-sets), US public domain. This product uses the FEMA OpenFEMA API, but is not endorsed by FEMA. FEMA's financial values come from NEMIS and are not official federal financial reporting.
Charts: [Plotly.js](https://plotly.com/javascript/) (MIT, see `site/vendor/PLOTLY-LICENSE`).
Code: MIT licence.
