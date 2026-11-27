-- The four KPI tables must match what the dashboard's JavaScript computes
-- from the same data (exported by scripts/export_kpis.js into
-- var('js_kpis_json')). Catches mistakes inside the KPI models themselves:
-- a wrong average, a swapped weight, median instead of mean.
with js as (
    select json from read_json_objects('{{ var("js_kpis_json", "js_kpis.json") }}', format = 'unstructured')
),
js_rows as (
    select 'payout' as kpi, json_extract_string(e, '$.key') as key, json_extract(e, '$.value')::double as value
    from js, unnest(from_json(json -> 'payout', '["JSON"]')) as t(e)
    union all
    select 'lag_mean', json_extract_string(e, '$.key'), json_extract(e, '$.value')::double
    from js, unnest(from_json(json -> 'lag_mean', '["JSON"]')) as t(e)
    union all
    select 'lag_median', json_extract_string(e, '$.key'), json_extract(e, '$.value')::double
    from js, unnest(from_json(json -> 'lag_median', '["JSON"]')) as t(e)
    union all
    select 'household_aid', json_extract_string(e, '$.key'), json_extract(e, '$.value')::double
    from js, unnest(from_json(json -> 'household_aid', '["JSON"]')) as t(e)
    union all
    select 'pdls', json_extract_string(e, '$.key'), json_extract(e, '$.value')::double
    from js, unnest(from_json(json -> 'pdls', '["JSON"]')) as t(e)
),
dbt_rows as (
    select 'payout' as kpi, incident_type as key, avg_total_payout as value from {{ ref('kpi_payout_by_type') }}
    union all select 'lag_mean', incident_type, avg_lag_weeks from {{ ref('kpi_declaration_lag_by_type') }}
    union all select 'lag_median', incident_type, median_lag_weeks from {{ ref('kpi_declaration_lag_by_type') }}
    union all select 'household_aid', incident_type, household_aid_rate from {{ ref('kpi_household_aid_by_type') }}
    union all select 'pdls', state, pdls from {{ ref('kpi_pdls_by_state') }}
)
select coalesce(js_rows.kpi, dbt_rows.kpi) as kpi, coalesce(js_rows.key, dbt_rows.key) as key,
       js_rows.value as dashboard_value, dbt_rows.value as dbt_value
from js_rows
full outer join dbt_rows on js_rows.kpi = dbt_rows.kpi and js_rows.key = dbt_rows.key
where js_rows.key is null or dbt_rows.key is null
   or abs(js_rows.value - dbt_rows.value) > 1e-6 * greatest(1, abs(js_rows.value))
