-- Financial KPI: average federal payout per disaster, by incident type.
-- Averaged only over disasters with a FEMA payout record (records start in
-- 1998; counting older disasters as $0 would understate costs).
select
    incident_type,
    count(*)                    as disasters_with_record,
    avg(total_payout)           as avg_total_payout,
    avg(ihp_approved)           as avg_ihp,
    avg(pa_emergency_work)      as avg_pa_emergency_work,
    avg(pa_other_work)          as avg_pa_other_work,
    avg(hmgp_obligated)         as avg_hmgp
from {{ ref('fct_disasters') }}
where has_payout_record
group by incident_type
