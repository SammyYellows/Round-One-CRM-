-- GymGrow import (Sammy, 11/10/2026): keep each imported person's GymGrow
-- ids and stage, so a later export can update them without duplicates.
alter table contacts add column if not exists gymgrow jsonb;
