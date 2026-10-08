-- Accountability programme, step 1 (docs/accountability.md; Sammy 08/10/2026:
-- go, floor capped at three, Claude drafts the wording). The member's
-- commitment lives on the contact; the commitment form is reached from a
-- personalised link; the welcome email is OFF until approved on the
-- Accountability screen.
alter table public.contacts add column if not exists accountability jsonb; -- shape: Accountability in types.ts

insert into public.forms (id, slug, name, questions, thanks, thanks_title, responses)
values ('accountability', 'accountability', 'Your commitment',
  '[
    {"id":"a_floor","type":"choice","text":"What’s your minimum: the number of sessions you’ll hit even on your worst week?","help":"This is your floor, not your goal. Pick the number you’d bet on.","options":["Once a week","Twice a week","Three times a week"]},
    {"id":"a_stretch","type":"choice","text":"And on a good week, what would make you genuinely proud?","options":["Twice a week","Three times a week","Four times a week","Five or more times a week"]},
    {"id":"a_goal","type":"multi","text":"What are you here for?","help":"Tick up to two.","options":["Lose weight","Get fit","Learn to box","Build confidence","Mental health"],"max":2,"other":true},
    {"id":"a_why","type":"long","text":"Why does this matter to you right now?","help":"Your own words. We’ll remind you of them when a week goes sideways."},
    {"id":"a_derail","type":"multi","text":"What’s most likely to knock you off course?","options":["Shifts","Motivation dips","Nerves","Family","Injury worries"],"max":3,"other":true},
    {"id":"a_style","type":"choice","text":"When a week goes badly, how do you want us to play it?","options":["Straight talk: call me out","Encouragement","Just the facts"]},
    {"id":"a_freq","type":"choice","text":"During the week, how much do you want us on you?","options":["Only if I’m slipping","A regular mid-week pulse","Keep me posted daily","Just the weekly check-in"]},
    {"id":"a_slot","type":"choice","text":"When should your weekly check-in land?","options":["Sunday 6pm","Monday 8am","Wednesday 7pm","Friday 5pm"]},
    {"id":"a_notes","type":"long","text":"Anything the coaches should know?","help":"Optional.","optional":true}
  ]'::jsonb,
  'You set the commitment, we hold you to it, your way. Your first check-in comes at the time you picked.',
  'Locked in', 0)
on conflict (id) do nothing;

insert into public.automations (id, name, summary, enabled, trigger, steps)
values ('accountability_welcome', 'Accountability – locked in', 'When a member fills in the commitment form, confirms what they committed to. Off until Sammy approves the wording.', false,
  '{"type": "accountability.joined"}'::jsonb,
  '[{"kind": "email", "to": "contact", "subject": "Locked in, {first}", "body": "Hi {first},\n\nYou’re on the accountability programme. Here’s what you told us:\n\nYour floor: {floor} a week, even on a bad week.\nYour stretch: {stretch} a week when it’s going well.\nWhy it matters to you: “{why}”\n\nEvery week we’ll check your floor against what you actually did and send you a 30-second check-in on {slot}. When you’re on pace we’ll leave you alone. When you’re slipping we’ll say so, the way you asked us to.\n\nIf anything changes, reply to this email or tell a coach.\n\n{team}"}]'::jsonb)
on conflict (id) do nothing;
