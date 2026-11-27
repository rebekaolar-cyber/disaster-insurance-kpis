-- One row per declared area, typed and cleaned.
select
    try_cast(try_cast("disasterNumber" as double) as integer)  as disaster_number,
    nullif(trim("state"), '')                                   as state,
    nullif(trim("declarationType"), '')                         as declaration_type,
    nullif(trim("incidentType"), '')                            as incident_type,
    try_cast(substr("declarationDate", 1, 10) as date)          as declaration_date,
    try_cast(substr("incidentBeginDate", 1, 10) as date)        as incident_begin_date,
    lower(trim(coalesce("iaProgramDeclared", ''))) in ('1', '1.0', 'true')
        or lower(trim(coalesce("ihProgramDeclared", ''))) in ('1', '1.0', 'true')
                                                                as household_aid_declared
from {{ source('fema', 'declarations') }}
where try_cast(try_cast("disasterNumber" as double) as integer) is not null
