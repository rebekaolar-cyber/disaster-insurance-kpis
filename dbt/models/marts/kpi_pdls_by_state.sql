-- Learning & growth KPI: Predictive Disaster Learning Score per state.
--   frequency score = disasters in state / most disasters in any state
--   diversity score = distinct hazard types in state / most in any state
--   PDLS = w * frequency + (1 - w) * diversity, w = var('pdls_frequency_weight')
with by_state as (
    select
        state,
        count(*)                        as disasters,
        count(distinct incident_type)   as hazard_types
    from {{ ref('fct_disasters') }}
    where state is not null
    group by state
),
scored as (
    select
        *,
        disasters / max(disasters) over ()::double          as frequency_score,
        hazard_types / max(hazard_types) over ()::double    as diversity_score
    from by_state
)
select
    *,
    {{ var('pdls_frequency_weight') }} * frequency_score
        + (1 - {{ var('pdls_frequency_weight') }}) * diversity_score  as pdls
from scored
