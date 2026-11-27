-- Federal money per disaster. Public Assistance (pa_obligated) already
-- contains emergency work (categories A-B) and permanent work (C-G).
-- Rounded to cents, as in the dashboard's pipeline; non-finite values become null.
select
    try_cast(trunc(try_cast("disasterNumber" as double)) as integer)  as disaster_number,
    case when isfinite(try_cast("totalAmountIhpApproved" as double)) then round(try_cast("totalAmountIhpApproved" as double), 2) end                as ihp_approved,
    case when isfinite(try_cast("totalObligatedAmountPa" as double)) then round(try_cast("totalObligatedAmountPa" as double), 2) end                as pa_obligated,
    case when isfinite(try_cast("totalObligatedAmountCatAb" as double)) then round(try_cast("totalObligatedAmountCatAb" as double), 2) end             as pa_emergency_work,
    case when isfinite(try_cast("totalObligatedAmountCatC2g" as double)) then round(try_cast("totalObligatedAmountCatC2g" as double), 2) end            as pa_permanent_work,
    case when isfinite(try_cast("totalObligatedAmountHmgp" as double)) then round(try_cast("totalObligatedAmountHmgp" as double), 2) end              as hmgp_obligated
from {{ source('fema', 'payouts') }}
where try_cast(trunc(try_cast("disasterNumber" as double)) as integer) is not null
