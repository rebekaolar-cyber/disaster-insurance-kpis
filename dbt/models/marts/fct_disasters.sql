-- One row per disaster with its money and timing.
-- total_payout = IHP + Public Assistance. Emergency work is a PART of Public
-- Assistance, so it is split out of it, never added on top (the double count
-- in the original course dashboard).
with d as (select * from {{ ref('int_disasters') }}),
     p as (select * from {{ ref('stg_fema__payouts') }})
select
    d.disaster_number,
    d.state,
    d.declaration_type,
    d.incident_type,
    d.declaration_date,
    year(d.declaration_date)                                    as declaration_year,
    d.incident_begin_date,
    d.household_aid_declared,
    d.declared_areas,
    (p.ihp_approved is not null or p.pa_obligated is not null
        or p.hmgp_obligated is not null)                        as has_payout_record,
    coalesce(p.ihp_approved, 0)                                 as ihp_approved,
    coalesce(p.pa_obligated, 0)                                 as pa_obligated,
    least(coalesce(p.pa_emergency_work, 0), coalesce(p.pa_obligated, 0))
                                                                as pa_emergency_work,
    coalesce(p.pa_obligated, 0)
        - least(coalesce(p.pa_emergency_work, 0), coalesce(p.pa_obligated, 0))
                                                                as pa_other_work,
    coalesce(p.hmgp_obligated, 0)                               as hmgp_obligated,
    coalesce(p.ihp_approved, 0) + coalesce(p.pa_obligated, 0)   as total_payout,
    date_diff('day', d.incident_begin_date, d.declaration_date) / 7.0
                                                                as declaration_lag_weeks
from d
left join p using (disaster_number)
