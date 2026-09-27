-- Round One's lead journey from GymGrow: the WhatsApp templates, the six
-- workflows (plus the Intro Programme check-in, off as it was in GymGrow, and
-- Did not convert), the real trial form and the free-trial booking hours.
-- Generated from src/lib/playbook.ts on 27/09/2026. Replaces the prototype's
-- three sample automations and five sample templates.

delete from public.automations where id in ('new_trial', 'trial_reminder', 'no_show');
delete from public.templates where name in ('trial_welcome', 'trial_nudge', 'trial_confirmed', 'trial_reminder', 'missed_you');

insert into public.templates (name, body, category, header_video, button_text, button_url) values
  ('leads_1', 'Hi {first}, it’s the Round One team. Thanks for your interest in joining us! ✅

The next step is to book your intro session so we can chat about your goals, show you around, and get you set up.

You can grab a time that suits you by clicking the button below.

Speak soon 🙌', 'marketing', 'leads_video.mp4', 'Book meeting', '/book/{{1}}'),
  ('leads_2', 'Hi {first},

Just checking in - we haven’t seen your meeting booked yet and spaces are filling up fast.

If you’re still looking to get started, you can choose a time by clicking the button below 🗓️

Let me know if you have any questions!', 'marketing', null, 'Book meeting', '/book/{{1}}'),
  ('leads_3', 'Hi {first},

Last chance - we can’t hold your place on the programme without booking a quick meet to get you set up.

If you’d like to move forward, grab a time now by clicking the button below.', 'marketing', null, 'Book meeting', '/book/{{1}}'),
  ('discovery_1', 'Hi {first},

Thanks for booking your meeting with us for {date} at {time}.

This is an in person meeting at our HQ 📍 {address}

The purpose of the meeting is to find out more about you and your goals, show you around, and run through the program and how everything works! 🙌

Let me know all is good and I’ll confirm your meeting

The Round One team 😝', 'utility', 'booked_video.mp4', null, null),
  ('discovery_2', 'Hi {first},

Just a quick courtesy reminder for our in person meeting tomorrow at {time}. We are really looking forward to meeting you :)

Please reply to this text to confirm you’ll 100% be attending, or to reschedule.

If you are attending. Before you come in, I just wanted to get a better understanding of what you’re hoping to get out of training — whether that’s fitness goals, confidence, strength, weight loss, stress relief, learning a skill, or anything personal that’s motivating you. If you could reply anything at all to this chat please.

The more we know beforehand, the better we can tailor the session and help the coaches understand what’s important to you from day one 👍

Looking forward to meeting you!

The Round One team ⭐', 'utility', null, null, null),
  ('discovery_3', 'Hi {first},

Looking forward to meeting you in a couple of hours

See you in person at our HQ 📍 {address}

The Round One team 😄', 'utility', null, null, null),
  ('no_showed_1', 'Hey {first} - we had you booked in for a session recently but looks like we missed you.

These sessions are important as we map out your plan properly, so let’s get you rebooked while it’s still fresh.

Give me a shout if anything came up

The Round One team 👍', 'marketing', null, 'Book meeting', '/book/{{1}}'),
  ('cancelled_1', 'Hey {first} - noticed you cancelled your slot.

We’ve only got limited spaces left at the moment, so I’d get another time booked in ASAP if you’re still interested!

Let me know if you need help

The Round One team 👍', 'marketing', null, 'Book meeting', '/book/{{1}}'),
  ('discovery_4', 'Hi {first},

Great having you in for your intro appointment, hope you enjoyed meeting the team and seeing the space!

Our 28 Day Program is the perfect next step to build consistency and experience the coaching and community properly. You can grab a spot here:

https://goteamup.com/p/10418134-round-one/memberships/274852/

If you’d prefer to jump straight into a full membership, just let me know and I’ll walk you through the best options for your goals and schedule.

Any questions, just reply here 👊', 'marketing', null, null, null),
  ('intro_programme_1', 'Hey {first},

We’re so excited to have you starting your programme with us! ⭐

Your first session is the beginning of something great - we can’t wait to see what you achieve.

Any questions before your first session, just reply here and we’ll help you out.

The Round One team 😄', 'marketing', null, null, null),
  ('intro_programme_2', 'Hi {first},

Just checking in after your first week - how are your sessions going? 🙌

Wanted to make sure you’re getting the most out of the programme!

Anything at all - questions, feedback, anything - just reply here.

The Round One team :)', 'marketing', null, null, null),
  ('recurring_member', 'Hi {first},

Welcome to the Round One community! ⭐

I couldn’t be happier to have you with us.

If there’s ever anything you need, just reach out - always happy to help.

The Round One team 🙌', 'marketing', null, null, null),
  ('did_not_convert_intro_to_recurring', 'Hey {first},

It was great having you with us on the programme

If you’d like to chat about your goals, how we can keep supporting you or any feedback, we’d love to book a quick catch-up session.

No pressure - we’re here whenever you’re ready.

The Round One team 😄', 'marketing', null, 'Book a catch up', '/book/{{1}}')
on conflict (name) do update set body = excluded.body, category = excluded.category, header_video = excluded.header_video,
  button_text = excluded.button_text, button_url = excluded.button_url, updated_at = now();

insert into public.automations (id, name, summary, enabled, trigger, steps, stop_on_reply) values
  ('new_lead', 'New lead – booking push', 'Tells the front desk, emails and WhatsApps the lead a booking link, then nudges twice, two days apart, until they book or reply. GymGrow workflow 1.', true, '{"type":"form.submitted","formId":"free-trial"}'::jsonb, '[{"kind":"email","to":"staff","subject":"New trial lead: {name}"},{"kind":"email","to":"contact","subject":"{gym} next steps","body":"Hi {first},\n\nThanks for your enquiry! We’re excited to help you get started.\n\nThe next step is to book your onsite intro session. This gives us a chance to learn more about your goals, show you around, and explain how everything works.\n\nYou can choose a time that suits you here:\n{bookLink}\n\nIf you have any questions before booking, just reply to this email and we’ll help you out.\n\nSpeak soon,\nThe Round One team"},{"kind":"whatsapp","template":"leads_1"},{"kind":"wait","hours":48},{"kind":"if_stage_in","stages":["new","contacted"]},{"kind":"whatsapp","template":"leads_2"},{"kind":"wait","hours":48},{"kind":"if_stage_in","stages":["new","contacted"]},{"kind":"whatsapp","template":"leads_3"}]'::jsonb, true),
  ('trial_booked', 'Trial booked – show-up reminders', 'Confirms the booking by email and WhatsApp, then reminds them the day before and two hours before. GymGrow workflow 2.', true, '{"type":"stage.changed","to":"booked"}'::jsonb, '[{"kind":"email","to":"staff","subject":"Trial booked: {name}, {date} at {time}"},{"kind":"email","to":"contact","subject":"Discovery meeting with {gym}","body":"Hey {first},\n\nIt’s the Round One team here!\n\nThanks for booking your meeting with us for {date} at {time}.\n\nSUPER important\n\n1 - Please reply to this email to confirm you’ll 100% be attending our meeting.\n\n2 - This is an in person meeting at our HQ at {address}\n\nLet me know all is good and we’ll confirm your meeting!"},{"kind":"whatsapp","template":"discovery_1"},{"kind":"wait_until_trial","hoursBefore":24,"skipIfLate":true},{"kind":"whatsapp","template":"discovery_2"},{"kind":"wait_until_trial","hoursBefore":2,"skipIfLate":true},{"kind":"whatsapp","template":"discovery_3"}]'::jsonb, false),
  ('trial_cancelled', 'Cancelled – rebooking push', 'When a free trial is cancelled, sends a rebooking link by email and WhatsApp. GymGrow workflow 3, cancelled branch.', true, '{"type":"appointment.status","status":"cancelled"}'::jsonb, '[{"kind":"email","to":"contact","subject":"Reschedule with {gym}","body":"Hi {first},\n\nWe had you booked in for {date} at {time}, but it looks like you’re not able to make it.\n\nNo worries, things happen.\nIf you’d still like to chat, you can rebook using the link below:\n{bookLink}\n\nIf now’s not the right time, just reply and let me know.\n\nSpeak soon\nThe Round One team"},{"kind":"whatsapp","template":"cancelled_1"}]'::jsonb, false),
  ('no_show', 'No-show – rebooking push', 'When someone misses their free trial, sends a rebooking link, then asks staff to call if they haven’t rebooked in two days. GymGrow workflow 3, no-show branch.', true, '{"type":"appointment.status","status":"no_show"}'::jsonb, '[{"kind":"email","to":"contact","subject":"Reschedule with {gym}","body":"Hi {first},\n\nWe had you booked in for {date} at {time}, but it looks like you weren’t able to make it.\n\nNo worries, things happen.\nIf you’d still like to chat, you can rebook using the link below:\n{bookLink}\n\nIf now’s not the right time, just reply and let me know.\n\nSpeak soon\nThe Round One team"},{"kind":"whatsapp","template":"no_showed_1"},{"kind":"wait","hours":48},{"kind":"if_stage_in","stages":["no_show"]},{"kind":"task","text":"Call {name} about rebooking their trial"}]'::jsonb, false),
  ('trial_attended', 'Trial attended – follow-up', 'Four hours after the trial, offers the 28 Day Program, unless they’ve already bought. GymGrow workflow 4.', true, '{"type":"stage.changed","to":"attended"}'::jsonb, '[{"kind":"wait","hours":4},{"kind":"if_stage_in","stages":["attended","nurture"]},{"kind":"whatsapp","template":"discovery_4"}]'::jsonb, false),
  ('sold_programme', 'Intro Programme – welcome', 'Welcomes someone who has bought the Intro Programme. GymGrow workflow 5.', true, '{"type":"stage.changed","to":"sold_programme"}'::jsonb, '[{"kind":"email","to":"staff","subject":"Sold – Programme: {name}"},{"kind":"email","to":"contact","subject":"Welcome to {gym}, {first}!","body":"Hey {first},\n\nWe’re so excited to have you starting with us.\n\nYour first session is the beginning of something great - we’re really glad you’ve taken this step and we can’t wait to see what you achieve.\n\nIf you have any questions before your first session, just reach out and we’ll help you out.\n\nThe Round One team"},{"kind":"whatsapp","template":"intro_programme_1"}]'::jsonb, false),
  ('programme_week_one', 'Intro Programme – first week check-in', 'A week into the programme, asks how it’s going. Off, as it was in GymGrow: switch it on to use it.', false, '{"type":"stage.changed","to":"sold_programme"}'::jsonb, '[{"kind":"wait","hours":168},{"kind":"if_stage_in","stages":["sold_programme"]},{"kind":"whatsapp","template":"intro_programme_2"}]'::jsonb, false),
  ('sold_membership', 'Recurring member – welcome', 'Welcomes someone who has taken a recurring membership. GymGrow workflow 6.', true, '{"type":"stage.changed","to":"sold_membership"}'::jsonb, '[{"kind":"email","to":"staff","subject":"Sold – Recurring membership: {name}"},{"kind":"email","to":"contact","subject":"Welcome to {gym}, {first}!","body":"Hey {first},\n\nWe’re so excited to have you starting with us.\n\nYour first session is the beginning of something great - we’re really glad you’ve taken this step and we can’t wait to see what you achieve.\n\nIf you have any questions before your first session, just reach out and we’ll help you out.\n\nThe Round One team"},{"kind":"whatsapp","template":"recurring_member"}]'::jsonb, false),
  ('did_not_convert', 'Did not convert – catch-up', 'When staff mark a programme customer as not carrying on, offers a catch-up session.', true, '{"type":"tag.added","tag":"did-not-convert"}'::jsonb, '[{"kind":"whatsapp","template":"did_not_convert_intro_to_recurring"}]'::jsonb, false)
on conflict (id) do update set name = excluded.name, summary = excluded.summary, enabled = excluded.enabled,
  trigger = excluded.trigger, steps = excluded.steps, stop_on_reply = excluded.stop_on_reply;

update public.forms set name = 'Free trial', questions = '[{"id":"q1","type":"choice","text":"Do you prefer training alone or in a group?","options":["Alone","Group","Either"]},{"id":"q2","type":"choice","text":"Are you willing to invest in your health and fitness?","options":["Yes, I’m ready to commit","I’m considering it","Not right now"]},{"id":"q3","type":"long","text":"What is your #1 fitness goal right now?"},{"id":"q4","type":"long","text":"Why is now the right time for you to start?"},{"id":"q5","type":"long","text":"What have you tried before?"},{"id":"q6","type":"choice","text":"How many days per week are you willing to train?","options":["1–2 days","3–4 days","5+ days"]},{"id":"q7","type":"choice","text":"Are you looking for coaching & accountability?","options":["Yes","No","Not sure"]},{"id":"q8","type":"choice","text":"How soon would you be ready to start?","options":["Immediately","This week","This month","Just browsing"]},{"id":"q9","type":"scale","text":"How committed are you?","low":"Not very - just browsing","high":"I’m ready to commit"},{"id":"q10","type":"text","field":"name","text":"What’s your full name?"},{"id":"q11","type":"phone","field":"phone","text":"What’s the best phone number to reach you?","help":"We’ll message you about your intro meeting on WhatsApp."},{"id":"q12","type":"email","field":"email","text":"And finally, what’s your email address?"}]'::jsonb, thanks = 'Based on your answers, you’ve qualified for our programme. Please book an in-person intro meeting with a member of our team to secure your spot.',
  thanks_title = 'Congratulations 🎉', book_button = 'Book a meeting'
where id = 'free-trial';

update public.calendars set duration_min = 30, availability = '{"slotMin":30,"capacity":1,"minNoticeHours":2,"daysAhead":14,"hours":{"1":[["08:00","19:30"]],"2":[["08:00","19:30"]],"3":[["08:00","19:30"]],"4":[["08:00","19:30"]],"5":[["08:00","17:00"]]}}'::jsonb where id = 'trial';
