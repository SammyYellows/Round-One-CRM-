-- Free-trial self-booking (Sammy, 27/09/2026): up to 7 days ahead, and
-- weekends added (09:00–16:00, the gym's weekend opening hours). Weekday
-- hours stay as they were in GymGrow. Staff can still change these under
-- Calendar → Booking hours.
update public.calendars
set availability = '{"slotMin": 30, "capacity": 1, "minNoticeHours": 2, "daysAhead": 7, "hours": {"0": [["09:00", "16:00"]], "1": [["08:00", "19:30"]], "2": [["08:00", "19:30"]], "3": [["08:00", "19:30"]], "4": [["08:00", "19:30"]], "5": [["08:00", "17:00"]], "6": [["09:00", "16:00"]]}}'::jsonb
where id = 'trial';
