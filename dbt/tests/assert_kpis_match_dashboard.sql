-- Every column of the four KPI tables must match what the dashboard's
-- JavaScript computes from the same data (exported by scripts/export_kpis.js
-- into var('js_kpis_json')): averages, channel splits, counts, tiers and
-- scores. Catches mistakes inside the KPI models themselves: a wrong
-- average, a swapped weight or channel, median instead of mean, a moved tier.
with js as (
    select json from read_json_objects('{{ var("js_kpis_json", "js_kpis.json") }}', format = 'unstructured')
),
js_rows as (
    select 'payout' as kpi, json_extract_string(e, '$.key') as key, json_extract(e, '$.value')::double as value
    from js, unnest(from_json(json -> 'payout', '["JSON"]')) as t(e)
    union all
    select 'lag_mean' as kpi, json_extract_string(e, '$.key') as key, json_extract(e, '$.value')::double as value
    from js, unnest(from_json(json -> 'lag_mean', '["JSON"]')) as t(e)
    union all
    select 'lag_median' as kpi, json_extract_string(e, '$.key') as key, json_extract(e, '$.value')::double as value
    from js, unnest(from_json(json -> 'lag_median', '["JSON"]')) as t(e)
    union all
    select 'household_aid' as kpi, json_extract_string(e, '$.key') as key, json_extract(e, '$.value')::double as value
    from js, unnest(from_json(json -> 'household_aid', '["JSON"]')) as t(e)
    union all
    select 'pdls' as kpi, json_extract_string(e, '$.key') as key, json_extract(e, '$.value')::double as value
    from js, unnest(from_json(json -> 'pdls', '["JSON"]')) as t(e)
    union all
    select 'payout_ihp' as kpi, json_extract_string(e, '$.key') as key, json_extract(e, '$.value')::double as value
    from js, unnest(from_json(json -> 'payout_ihp', '["JSON"]')) as t(e)
    union all
    select 'payout_pa_emergency' as kpi, json_extract_string(e, '$.key') as key, json_extract(e, '$.value')::double as value
    from js, unnest(from_json(json -> 'payout_pa_emergency', '["JSON"]')) as t(e)
    union all
    select 'payout_pa_other' as kpi, json_extract_string(e, '$.key') as key, json_extract(e, '$.value')::double as value
    from js, unnest(from_json(json -> 'payout_pa_other', '["JSON"]')) as t(e)
    union all
    select 'payout_hmgp' as kpi, json_extract_string(e, '$.key') as key, json_extract(e, '$.value')::double as value
    from js, unnest(from_json(json -> 'payout_hmgp', '["JSON"]')) as t(e)
    union all
    select 'payout_n' as kpi, json_extract_string(e, '$.key') as key, json_extract(e, '$.value')::double as value
    from js, unnest(from_json(json -> 'payout_n', '["JSON"]')) as t(e)
    union all
    select 'lag_n' as kpi, json_extract_string(e, '$.key') as key, json_extract(e, '$.value')::double as value
    from js, unnest(from_json(json -> 'lag_n', '["JSON"]')) as t(e)
    union all
    select 'lag_tier' as kpi, json_extract_string(e, '$.key') as key, json_extract(e, '$.value')::double as value
    from js, unnest(from_json(json -> 'lag_tier', '["JSON"]')) as t(e)
    union all
    select 'aid_n' as kpi, json_extract_string(e, '$.key') as key, json_extract(e, '$.value')::double as value
    from js, unnest(from_json(json -> 'aid_n', '["JSON"]')) as t(e)
    union all
    select 'aid_activated' as kpi, json_extract_string(e, '$.key') as key, json_extract(e, '$.value')::double as value
    from js, unnest(from_json(json -> 'aid_activated', '["JSON"]')) as t(e)
    union all
    select 'aid_tier' as kpi, json_extract_string(e, '$.key') as key, json_extract(e, '$.value')::double as value
    from js, unnest(from_json(json -> 'aid_tier', '["JSON"]')) as t(e)
    union all
    select 'pdls_count' as kpi, json_extract_string(e, '$.key') as key, json_extract(e, '$.value')::double as value
    from js, unnest(from_json(json -> 'pdls_count', '["JSON"]')) as t(e)
    union all
    select 'pdls_types' as kpi, json_extract_string(e, '$.key') as key, json_extract(e, '$.value')::double as value
    from js, unnest(from_json(json -> 'pdls_types', '["JSON"]')) as t(e)
    union all
    select 'pdls_frequency' as kpi, json_extract_string(e, '$.key') as key, json_extract(e, '$.value')::double as value
    from js, unnest(from_json(json -> 'pdls_frequency', '["JSON"]')) as t(e)
    union all
    select 'pdls_diversity' as kpi, json_extract_string(e, '$.key') as key, json_extract(e, '$.value')::double as value
    from js, unnest(from_json(json -> 'pdls_diversity', '["JSON"]')) as t(e)
),
dbt_rows as (
    select 'payout' as kpi, incident_type as key, avg_total_payout as value from {{ ref('kpi_payout_by_type') }}
    union all select 'payout_ihp', incident_type, avg_ihp from {{ ref('kpi_payout_by_type') }}
    union all select 'payout_pa_emergency', incident_type, avg_pa_emergency_work from {{ ref('kpi_payout_by_type') }}
    union all select 'payout_pa_other', incident_type, avg_pa_other_work from {{ ref('kpi_payout_by_type') }}
    union all select 'payout_hmgp', incident_type, avg_hmgp from {{ ref('kpi_payout_by_type') }}
    union all select 'payout_n', incident_type, disasters_with_record from {{ ref('kpi_payout_by_type') }}
    union all select 'lag_mean', incident_type, avg_lag_weeks from {{ ref('kpi_declaration_lag_by_type') }}
    union all select 'lag_median', incident_type, median_lag_weeks from {{ ref('kpi_declaration_lag_by_type') }}
    union all select 'lag_n', incident_type, disasters from {{ ref('kpi_declaration_lag_by_type') }}
    union all select 'lag_tier', incident_type,
        case speed_tier when 'Fast' then 0 when 'Moderate' then 1 when 'Slow' then 2 end
        from {{ ref('kpi_declaration_lag_by_type') }}
    union all select 'household_aid', incident_type, household_aid_rate from {{ ref('kpi_household_aid_by_type') }}
    union all select 'aid_n', incident_type, disasters from {{ ref('kpi_household_aid_by_type') }}
    union all select 'aid_activated', incident_type, with_household_aid from {{ ref('kpi_household_aid_by_type') }}
    union all select 'aid_tier', incident_type,
        case aid_tier when 'None' then 0 when 'Low' then 1 when 'Medium' then 2 when 'High' then 3 end
        from {{ ref('kpi_household_aid_by_type') }}
    union all select 'pdls', state, pdls from {{ ref('kpi_pdls_by_state') }}
    union all select 'pdls_count', state, disasters from {{ ref('kpi_pdls_by_state') }}
    union all select 'pdls_types', state, hazard_types from {{ ref('kpi_pdls_by_state') }}
    union all select 'pdls_frequency', state, frequency_score from {{ ref('kpi_pdls_by_state') }}
    union all select 'pdls_diversity', state, diversity_score from {{ ref('kpi_pdls_by_state') }}
)
select coalesce(js_rows.kpi, dbt_rows.kpi) as kpi, coalesce(js_rows.key, dbt_rows.key) as key,
       js_rows.value as dashboard_value, dbt_rows.value as dbt_value
from js_rows
full outer join dbt_rows on js_rows.kpi = dbt_rows.kpi and js_rows.key = dbt_rows.key
where js_rows.key is null or dbt_rows.key is null
   or abs(js_rows.value - dbt_rows.value) > 1e-6 * greatest(1, abs(js_rows.value))
