-- Federal money per disaster. Public Assistance (pa_obligated) already
-- contains emergency work (categories A-B) and permanent work (C-G).
select
    try_cast(try_cast("disasterNumber" as double) as integer)  as disaster_number,
    try_cast("totalAmountIhpApproved" as double)                as ihp_approved,
    try_cast("totalObligatedAmountPa" as double)                as pa_obligated,
    try_cast("totalObligatedAmountCatAb" as double)             as pa_emergency_work,
    try_cast("totalObligatedAmountCatC2g" as double)            as pa_permanent_work,
    try_cast("totalObligatedAmountHmgp" as double)              as hmgp_obligated
from {{ source('fema', 'payouts') }}
where try_cast(try_cast("disasterNumber" as double) as integer) is not null
