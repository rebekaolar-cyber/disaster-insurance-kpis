{{ config(severity = 'warn') }}
-- FEMA reports emergency work (categories A-B) as part of Public Assistance,
-- so it should never be larger. A few records break this; the model caps them.
select disaster_number, pa_obligated, pa_emergency_work
from {{ ref('stg_fema__payouts') }}
where pa_emergency_work > coalesce(pa_obligated, 0) + 1
