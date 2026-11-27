{{ config(severity = 'warn') }}
-- A disaster's state, type and declaration date should be the same on every
-- declared area. Lists the disasters where FEMA's rows disagree.
select disaster_number,
       count(distinct state)            as states,
       count(distinct declaration_type) as declaration_types,
       count(distinct incident_type)    as incident_types,
       count(distinct declaration_date) as declaration_dates
from {{ ref('stg_fema__declarations') }}
group by disaster_number
having count(distinct state) > 1
    or count(distinct declaration_type) > 1
    or count(distinct incident_type) > 1
    or count(distinct declaration_date) > 1
