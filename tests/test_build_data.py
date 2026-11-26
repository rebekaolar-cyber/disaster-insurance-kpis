import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "scripts"))
import build_data as b  # noqa: E402


DECL = [
    # disaster 10: two counties, IA only in the second, earliest begin date wins
    {"disasterNumber": "10", "state": "TX", "declarationType": "DR", "declarationDate": "2020-05-01T00:00:00.000Z",
     "incidentType": "Flood", "incidentBeginDate": "2020-04-10T00:00:00.000Z", "iaProgramDeclared": "0", "ihProgramDeclared": "0"},
    {"disasterNumber": "10", "state": "TX", "declarationType": "DR", "declarationDate": "2020-05-01T00:00:00.000Z",
     "incidentType": "Flood", "incidentBeginDate": "2020-04-03T00:00:00.000Z", "iaProgramDeclared": "1", "ihProgramDeclared": "0"},
    # disaster 11: newer disasters flag households via IHP, booleans as text
    {"disasterNumber": "11", "state": "FL", "declarationType": "EM", "declarationDate": "2021-09-01T00:00:00.000Z",
     "incidentType": "Hurricane", "incidentBeginDate": "", "iaProgramDeclared": "false", "ihProgramDeclared": "true"},
    # bad row is skipped
    {"disasterNumber": "", "state": "CA"},
]
SUMS = [
    {"disasterNumber": "10", "totalAmountIhpApproved": "100.5", "totalObligatedAmountPa": "1000",
     "totalObligatedAmountCatAb": "400", "totalObligatedAmountCatC2g": "600", "totalObligatedAmountHmgp": ""},
]


def build():
    d = b.disasters_from_declarations(DECL)
    b.attach_payouts(d, SUMS)
    return d


def test_one_record_per_disaster():
    d = build()
    assert sorted(d) == [10, 11]


def test_household_aid_flag_from_any_area_and_either_program():
    d = build()
    assert d[10]["ia"] == 1
    assert d[11]["ia"] == 1


def test_earliest_begin_date_kept():
    assert build()[10]["b"] == "2020-04-03"


def test_missing_begin_date_is_none():
    assert build()[11]["b"] is None


def test_payouts_joined_and_missing_stay_none():
    d = build()
    assert d[10]["ihp"] == 100.5 and d[10]["pa"] == 1000 and d[10]["cab"] == 400
    assert d[10]["hm"] is None
    assert d[11]["pa"] is None


def test_payload_is_columnar_and_sorted():
    p = b.to_payload(build(), "test")
    assert p["cols"] == b.COLS
    assert [r[0] for r in p["rows"]] == [10, 11]
    assert p["meta"]["disasters"] == 2
    assert p["meta"]["first"] == "2020-05-01" and p["meta"]["last"] == "2021-09-01"
