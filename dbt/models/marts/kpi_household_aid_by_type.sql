-- Customer KPI: share of disasters where FEMA activated aid for individual
-- households (Individual Assistance or the Individuals and Households Program).
select
    incident_type,
    count(*)                                            as disasters,
    count(*) filter (where household_aid_declared)      as with_household_aid,
    count(*) filter (where household_aid_declared) / count(*)::double
                                                        as household_aid_rate,
    case when count(*) filter (where household_aid_declared) / count(*)::double > 0.5 then 'High'
         when count(*) filter (where household_aid_declared) / count(*)::double >= 0.3 then 'Medium'
         when count(*) filter (where household_aid_declared) > 0 then 'Low'
         else 'None' end                                as aid_tier
from {{ ref('fct_disasters') }}
group by incident_type
