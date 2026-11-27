"""Fetch FEMA's open data and build the compact file the dashboard reads.

Two OpenFEMA datasets are used:
  * DisasterDeclarationsSummaries (v2): one row per declared county or area.
    Reduced here to one row per disaster.
  * FemaWebDisasterSummaries (v1): federal money per disaster
    (Individuals and Households Program, Public Assistance, Hazard Mitigation).

Usage:
  python scripts/build_data.py                # fetch from fema.gov and build
  python scripts/build_data.py --from-csv DECL.csv SUMS.csv   # build from local CSVs
"""
from __future__ import annotations

import argparse
import csv
import json
import math
import sys
import time
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

API = "https://www.fema.gov/api/open"
PAGE = 10_000

DECL_FIELDS = [
    "disasterNumber", "state", "declarationType", "declarationDate",
    "incidentType", "incidentBeginDate", "iaProgramDeclared", "ihProgramDeclared",
]
SUM_FIELDS = [
    "disasterNumber", "totalAmountIhpApproved", "totalObligatedAmountPa",
    "totalObligatedAmountCatAb", "totalObligatedAmountCatC2g", "totalObligatedAmountHmgp",
]

OUT = Path(__file__).resolve().parent.parent / "site" / "data" / "disasters.json"


# ---------- fetching ----------

def fetch_all(path: str, entity: str, fields: list[str]) -> list[dict]:
    """Page through an OpenFEMA endpoint and return every record."""
    rows: list[dict] = []
    skip = 0
    while True:
        query = urllib.parse.urlencode({
            "$select": ",".join(fields),
            "$top": PAGE,
            "$skip": skip,
            "$orderby": "id",
        }, safe="$,")
        url = f"{API}/{path}?{query}"
        for attempt in range(5):
            try:
                with urllib.request.urlopen(url, timeout=120) as resp:
                    batch = json.load(resp)[entity]
                break
            except Exception as exc:  # network hiccup: back off and retry
                if attempt == 4:
                    raise
                print(f"retry {attempt + 1} for {path} skip={skip}: {exc}", file=sys.stderr)
                time.sleep(5 * (attempt + 1))
        rows.extend(batch)
        print(f"{entity}: {len(rows)} rows", file=sys.stderr)
        if len(batch) < PAGE:
            return rows
        skip += PAGE


def write_raw(rows: list[dict], fields: list[str], path: Path) -> None:
    """Save the downloaded rows untouched, for the dbt pipeline to read."""
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=fields, extrasaction="ignore")
        w.writeheader()
        for r in rows:
            w.writerow({k: r.get(k, "") for k in fields})


def read_csv(path: str) -> list[dict]:
    with open(path, newline="", encoding="utf-8") as f:
        return list(csv.DictReader(f))


# ---------- transforming (pure, tested) ----------

def _flag(value) -> bool:
    return str(value).strip().lower() in {"1", "true", "1.0"}


def _day(value) -> str | None:
    """YYYY-MM-DD from an ISO timestamp; None if missing or not a real date."""
    value = (value or "").strip()[:10]
    try:
        return datetime.strptime(value, "%Y-%m-%d").strftime("%Y-%m-%d")
    except ValueError:
        return None


def _money(value) -> float | None:
    if value in (None, ""):
        return None
    try:
        v = float(value)
    except (TypeError, ValueError):
        return None
    return round(v, 2) if math.isfinite(v) else None


def disasters_from_declarations(rows: list[dict]) -> dict[int, dict]:
    """Collapse county-level declaration rows into one record per disaster.

    Same rules as the dbt model int_disasters, so the two pipelines agree:
    state, declaration type, incident type, declaration date and incident
    start are the smallest value over the disaster's areas; household aid
    counts if any area had the IA program (older disasters) or the
    Individuals and Households program (newer disasters) declared.
    """
    out: dict[int, dict] = {}

    def keep_min(rec: dict, key: str, value) -> None:
        if value and (rec[key] is None or value < rec[key]):
            rec[key] = value

    for r in rows:
        try:
            n = int(float(r["disasterNumber"]))
        except (KeyError, TypeError, ValueError):
            continue
        rec = out.setdefault(n, {"n": n, "s": None, "t": None, "i": None, "d": None, "b": None, "ia": 0})
        keep_min(rec, "s", (r.get("state") or "").strip())
        keep_min(rec, "t", (r.get("declarationType") or "").strip())
        keep_min(rec, "i", (r.get("incidentType") or "").strip())
        keep_min(rec, "d", _day(r.get("declarationDate")))
        keep_min(rec, "b", _day(r.get("incidentBeginDate")))
        if _flag(r.get("iaProgramDeclared")) or _flag(r.get("ihProgramDeclared")):
            rec["ia"] = 1
    for rec in out.values():
        rec["s"] = rec["s"] or ""
        rec["t"] = rec["t"] or ""
    return out


def attach_payouts(disasters: dict[int, dict], summaries: list[dict]) -> None:
    """Add federal money per disaster. Missing amounts stay None (no record)."""
    by_n = {}
    for r in summaries:
        try:
            by_n[int(float(r["disasterNumber"]))] = r
        except (KeyError, TypeError, ValueError):
            continue
    for n, rec in disasters.items():
        r = by_n.get(n, {})
        rec["ihp"] = _money(r.get("totalAmountIhpApproved"))
        rec["pa"] = _money(r.get("totalObligatedAmountPa"))
        rec["cab"] = _money(r.get("totalObligatedAmountCatAb"))
        rec["hm"] = _money(r.get("totalObligatedAmountHmgp"))


COLS = ["n", "s", "t", "i", "d", "b", "ia", "ihp", "pa", "cab", "hm"]


def to_payload(disasters: dict[int, dict], source: str) -> dict:
    recs = sorted(disasters.values(), key=lambda r: r["n"])
    recs = [r for r in recs if r["d"] and r["i"]]
    return {
        "meta": {
            "source": source,
            "built": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
            "disasters": len(recs),
            "first": min(r["d"] for r in recs),
            "last": max(r["d"] for r in recs),
        },
        "cols": COLS,
        "rows": [[r.get(c) for c in COLS] for r in recs],
    }


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--from-csv", nargs=2, metavar=("DECLARATIONS", "SUMMARIES"))
    ap.add_argument("--out", default=str(OUT))
    ap.add_argument("--raw-dir", help="also save the raw rows as CSV here (input for dbt)")
    args = ap.parse_args()

    if args.from_csv:
        decl, sums = read_csv(args.from_csv[0]), read_csv(args.from_csv[1])
        source = "local CSV sample (not the full dataset)"
    else:
        decl = fetch_all("v2/DisasterDeclarationsSummaries", "DisasterDeclarationsSummaries", DECL_FIELDS)
        sums = fetch_all("v1/FemaWebDisasterSummaries", "FemaWebDisasterSummaries", SUM_FIELDS)
        source = "OpenFEMA API (fema.gov): DisasterDeclarationsSummaries v2 + FemaWebDisasterSummaries v1"

    if args.raw_dir:
        write_raw(decl, DECL_FIELDS, Path(args.raw_dir) / "declarations.csv")
        write_raw(sums, SUM_FIELDS, Path(args.raw_dir) / "payouts.csv")

    disasters = disasters_from_declarations(decl)
    attach_payouts(disasters, sums)
    payload = to_payload(disasters, source)
    if not args.from_csv and payload["meta"]["disasters"] < 3000:
        # FEMA has declared well over 4,000 disasters; fewer means a broken download.
        print(f"only {payload['meta']['disasters']} disasters fetched; refusing to publish", file=sys.stderr)
        return 1

    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(payload, separators=(",", ":"), allow_nan=False), encoding="utf-8")
    print(f"wrote {out} with {payload['meta']['disasters']} disasters", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
