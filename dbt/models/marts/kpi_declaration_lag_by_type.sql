-- Internal-process KPI: weeks from incident start to FEMA's declaration.
-- Left out: no start date, or declared before the incident began
-- (e.g. emergencies declared ahead of a hurricane).
select
    incident_type,
    count(*)                            as disasters,
    avg(declaration_lag_weeks)          as avg_lag_weeks,
    median(declaration_lag_weeks)       as median_lag_weeks,
    case when avg(declaration_lag_weeks) < 3 then 'Fast'
         when avg(declaration_lag_weeks) <= 6 then 'Moderate'
         else 'Slow' end                as speed_tier
from {{ ref('fct_disasters') }}
where declaration_lag_weeks is not null and declaration_lag_weeks >= 0
group by incident_type
