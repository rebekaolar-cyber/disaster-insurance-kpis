-- One row per disaster. A disaster's attributes repeat on every declared
-- area; household aid counts if any area had it; the incident start is the
-- earliest start reported for any area.
select
    disaster_number,
    min(state)                     as state,
    min(declaration_type)          as declaration_type,
    min(incident_type)             as incident_type,
    min(declaration_date)          as declaration_date,
    min(incident_begin_date)       as incident_begin_date,
    bool_or(household_aid_declared) as household_aid_declared,
    count(*)                       as declared_areas
from {{ ref('stg_fema__declarations') }}
group by disaster_number
having min(declaration_date) is not null and min(incident_type) is not null
