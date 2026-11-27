-- The dashboard's data file (built by the Python pipeline) and this dbt
-- pipeline must agree, disaster by disaster: same disasters, same household
-- aid flag, same incident start, same payouts. Two independent pipelines
-- that agree are much harder to get wrong together.
with dash as (
    select
        json_extract_string(r, '$[0]')::integer                 as disaster_number,
        json_extract_string(r, '$[5]')::date                    as incident_begin_date,
        json_extract_string(r, '$[6]')::integer = 1             as household_aid_declared,
        coalesce(json_extract_string(r, '$[7]')::double, 0)     as ihp_approved,
        coalesce(json_extract_string(r, '$[8]')::double, 0)     as pa_obligated
    from (
        select unnest(from_json(json -> 'rows', '["JSON"]')) as r
        from read_json_objects('../site/data/disasters.json', format = 'unstructured')
    )
),
dbt as (
    select disaster_number, incident_begin_date, household_aid_declared, ihp_approved, pa_obligated
    from {{ ref('fct_disasters') }}
)
select
    coalesce(dash.disaster_number, dbt.disaster_number) as disaster_number,
    case
        when dash.disaster_number is null then 'missing from dashboard'
        when dbt.disaster_number is null then 'missing from dbt'
        when dash.household_aid_declared <> dbt.household_aid_declared then 'household aid differs'
        when dash.incident_begin_date is distinct from dbt.incident_begin_date then 'incident start differs'
        when abs(dash.ihp_approved - dbt.ihp_approved) > 0.01
          or abs(dash.pa_obligated - dbt.pa_obligated) > 0.01 then 'payout differs'
    end as problem
from dash
full outer join dbt using (disaster_number)
where dash.disaster_number is null
   or dbt.disaster_number is null
   or dash.household_aid_declared <> dbt.household_aid_declared
   or dash.incident_begin_date is distinct from dbt.incident_begin_date
   or abs(dash.ihp_approved - dbt.ihp_approved) > 0.01
   or abs(dash.pa_obligated - dbt.pa_obligated) > 0.01
