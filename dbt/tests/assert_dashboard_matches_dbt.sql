-- The dashboard's data file (built by the Python pipeline) and this dbt
-- pipeline must agree on every field of every disaster: same disasters,
-- state, declaration type, incident type, dates, household aid flag and
-- payouts. Two independent pipelines that agree are much harder to get
-- wrong together. The file is var('dashboard_json').
with dash as (
    select
        try_cast(json_extract_string(r, '$[0]') as integer)     as disaster_number,
        coalesce(json_extract_string(r, '$[1]'), '')            as state,
        coalesce(json_extract_string(r, '$[2]'), '')            as declaration_type,
        json_extract_string(r, '$[3]')                          as incident_type,
        try_cast(json_extract_string(r, '$[4]') as date)        as declaration_date,
        try_cast(json_extract_string(r, '$[5]') as date)        as incident_begin_date,
        json_extract_string(r, '$[6]') = '1'                    as household_aid_declared,
        coalesce(try_cast(json_extract_string(r, '$[7]') as double), 0)  as ihp_approved,
        coalesce(try_cast(json_extract_string(r, '$[8]') as double), 0)  as pa_obligated,
        coalesce(try_cast(json_extract_string(r, '$[9]') as double), 0)  as pa_emergency_raw,
        coalesce(try_cast(json_extract_string(r, '$[10]') as double), 0) as hmgp_obligated
    from (
        select unnest(from_json(json -> 'rows', '["JSON"]')) as r
        from read_json_objects('{{ var("dashboard_json", "../site/data/disasters.json") }}', format = 'unstructured')
    )
),
dbt as (
    select
        f.disaster_number, coalesce(f.state, '') as state, coalesce(f.declaration_type, '') as declaration_type,
        f.incident_type, f.declaration_date, f.incident_begin_date, f.household_aid_declared,
        f.ihp_approved, f.pa_obligated, coalesce(p.pa_emergency_work, 0) as pa_emergency_raw, f.hmgp_obligated
    from {{ ref('fct_disasters') }} f
    left join {{ ref('stg_fema__payouts') }} p using (disaster_number)
),
compared as (
    select
        coalesce(dash.disaster_number, dbt.disaster_number) as disaster_number,
        case
            when dash.disaster_number is null then 'missing from dashboard'
            when dbt.disaster_number is null then 'missing from dbt'
            when dash.state <> dbt.state then 'state differs'
            when dash.declaration_type <> dbt.declaration_type then 'declaration type differs'
            when dash.incident_type <> dbt.incident_type then 'incident type differs'
            when dash.declaration_date is distinct from dbt.declaration_date then 'declaration date differs'
            when dash.incident_begin_date is distinct from dbt.incident_begin_date then 'incident start differs'
            when dash.household_aid_declared <> dbt.household_aid_declared then 'household aid differs'
            when abs(dash.ihp_approved - dbt.ihp_approved) > 0.005
              or abs(dash.pa_obligated - dbt.pa_obligated) > 0.005
              or abs(dash.pa_emergency_raw - dbt.pa_emergency_raw) > 0.005
              or abs(dash.hmgp_obligated - dbt.hmgp_obligated) > 0.005 then 'payout differs'
        end as problem
    from dash
    full outer join dbt using (disaster_number)
)
select * from compared where problem is not null
