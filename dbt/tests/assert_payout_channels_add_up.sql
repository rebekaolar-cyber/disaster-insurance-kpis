-- The payout channels must add up to the total: IHP + emergency work +
-- other Public Assistance = IHP + Public Assistance. If emergency work were
-- added on top of Public Assistance (the course dashboard's double count),
-- every disaster with emergency work would fail here.
select disaster_number, ihp_approved, pa_emergency_work, pa_other_work, total_payout
from {{ ref('fct_disasters') }}
where abs(ihp_approved + pa_emergency_work + pa_other_work - total_payout) > 0.01
   or abs(total_payout - (ihp_approved + pa_obligated)) > 0.01
