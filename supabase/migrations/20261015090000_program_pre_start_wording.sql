-- Program 2-days-before wording: Sammy's own template, made personal, with
-- his point that routine on the normal classes matters most and the Program's
-- small group PT sessions get people used to the gym and the coaches
-- (Sammy, 15/10/2026, his emoji kept). Still OFF until approved.

update public.automations set steps = jsonb_set(steps, '{1}', jsonb_build_object('kind', 'email', 'to', 'contact', 'subject', 'Your 28 Day Program starts in two days, {first}', 'body', 'Hi {first},

We’re so excited to have you joining the program and becoming part of Round One! 💪

I know we covered everything during your appointment, but here’s a quick recap of what to expect.

Commitment fee
Your commitment fee is fully credited back to you over 6 months once you sign up for one of our memberships that includes gym access and classes. This means that, over time, your 28-day program (including your small group PT sessions, training plan and consultation) is essentially free. It’s our way of rewarding consistency and commitment to your fitness goals.

Building your routine
The aim of the program is to help you build positive, sustainable habits, so you’ll have access to everything the gym has to offer. The most important thing is getting into a routine with our normal group classes and the gym, at times that fit your life. That’s what makes the difference long term.

Your small group PT sessions are a great extra: they’re designed to get you used to being in the gym and working with the coaches, so you feel at home from day one. If you can’t make one, that’s fine, just keep your routine going.

Your 28-day program includes:
• 2 small group PT sessions per week (for 4 weeks)
• Full gym access
• Unlimited group fitness classes
• A personalised training plan
• An initial consultation

Our current small group PT sessions are:
📅 Tuesday at 10:00 AM
📅 Thursday at 10:00 AM

If these times don’t work for you, just send us a message and we’ll chat.

You should also have received an invitation to TeamUp, our gym management system. Please complete your account setup before your first session, and if you have any issues, just let us know!

Looking forward to getting started with you! 😊

The Round One team'::text))
where id = 'program_pre_start' and steps->1->>'kind' = 'email';

update public.templates set body = 'Hi {first}, your 28 Day Program starts in two days and we can’t wait to get started with you 💪 The most important thing is building a routine with our normal classes and the gym, at times that suit you. Your small group PT sessions (Tuesday and Thursday at 10:00) are designed to get you used to the gym and the coaches. Please finish setting up your TeamUp account before your first session, and message us here with any questions 😊

The Round One team', updated_at = now() where name = 'program_pre_start' and meta_status = 'draft';
