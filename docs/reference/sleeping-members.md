# Sleeping members: should a gym contact people who pay but don't come?

Research note for Round One, 10/10/2026. Written because Sammy asked
whether anything out there describes the trade-off he raised: a message
to a member who hasn't been in for weeks can nudge them back, or it can
remind them they're paying for a gym they don't use and get them to
cancel. His rule stands and this note doesn't change it: **nothing about
lapsed or inactive members is ever sent to the member automatically.
Alerts go to staff only; contacting someone is a human decision.**

What follows is what the published research and the industry say, how
solid each source is, and what it suggests for how staff use the
inactivity alerts the CRM now raises (settings `inactivity`, default 20
days, see `docs/improvement-list.md` item 18).

## 1. The trade-off is real and well documented

**People pay for gyms they don't use, and they take months to cancel.**
The best-known study is DellaVigna and Malmendier, *Paying Not to Go to
the Gym* (American Economic Review, 2006), which followed 7,752 members
of three US clubs for three years. Members on a flat monthly plan went
about 4.3 times a month and so paid over $17 a visit, when a ten-visit
pass would have cost $10 a visit. On average they gave up around $600
over a membership. Monthly members waited on average **2.3 full months
between their last visit and cancelling** (working-paper figure), and the
authors' explanation is overconfidence: people overestimate how often
they'll go and how quickly they'll get round to cancelling.
([AEA abstract](https://www.aeaweb.org/articles?id=10.1257%2Faer.96.3.694),
[Berkeley PDF](https://eml.berkeley.edu/~sdellavi/wp/gymempAER.pdf))

**The gap between "still a member" and "still training" is large.** A
Norwegian one-year study of 250 new members at 25 gyms (Gjestvang et al.,
*Frontiers in Psychology*, 2021) found that **86.6% were still members at
twelve months, but only about 37% exercised regularly**, and only 17% had
used the gym twice a week in their first year. The authors' conclusion:
most new members never reach a regular habit.
([Frontiers](https://www.frontiersin.org/journals/psychology/articles/10.3389/fpsyg.2021.638928/full))

**UK figures exist but are survey extrapolations.** A 2025 survey of
2,000 UK adults put wasted gym fees at about £503m a year, with 27%
saying they'd given up by March and 18% within one to two months. A 2019
survey put the figure at £4bn. Treat these as indicative, not measured.
([SME Today](https://www.smetoday.co.uk/well-being/brits-estimated-to-waste-503-million-on-unused-gym-memberships-in-2025/),
[Mail on Sunday, 2019](https://www.pressreader.com/uk/the-scottish-mail-on-sunday/20190303/282248076859653))

So the member Sammy is worried about is not rare. In a 300-member gym a
quarter or more may be paying and not coming at any one time. Our first
activity run found 104 of 306 active members past 20 days without a
ticked-in class or door entry (some of that is email mismatch and
un-ticked classes, so the true number is lower).

## 2. Whether a sleeper is revenue or a risk depends on the kind of gym

The industry openly splits on this.

**Low-cost, high-volume gyms count on sleepers.** Planet Fitness
(US, around $10 to $15 a month) has roughly 7,000 members per club.
Sherwood News worked out that if every member came four times a week,
each club would need about 257 people in at all times, above the
occupancy of many sites; staff at two clubs said peak attendance is 50 to
60. The model only works because most members stay away, and cancelling
is made deliberately awkward (in person or by post, bank account not
card). ([Sherwood News](https://sherwood.news/business/planet-fitnesss-membership-gym-cancellation/))
Nobody is suggesting Round One copy this. It's the model the DMCC Act
(section 4) is aimed at.

**Smaller, higher-priced gyms see sleepers as cancellations in waiting.**
GymMaster's guide says low-cost clubs may treat sleepers as steady
revenue, but at higher-priced clubs with fewer members "sleepers there
are more likely to cancel and their departure has a bigger financial
impact", and that as many as 30% of a club's members can be sleeping.
It is also the one source that states Sammy's worry directly: "many
sleeping members might see communications from your facility as a prompt
to cancel", so it advises not sending anything to them until there is a
re-engagement plan.
([GymMaster](https://www.gymmaster.com/blog/sleeping-gym-members/))

Clubwise (UK gym software) makes the opposite case for the same gyms: "a
frozen member isn't a retained member. They're a cancellation waiting to
happen." Guilt fades within a couple of months, by month three many have
mentally quit, and the cancellation then lands without warning. Their
point is that silence doesn't keep the money; it only delays the loss
and removes the chance to fix it.
([Clubwise](https://www.clubwise.com/clubwise-blog/re-engaging-the-sleeper-fixing-frozen-gym-memberships/))

Round One is firmly in the second group: around 300 members, a coached
product (28 Day Program, accountability programme, named coaches), and a
brand built on people actually training. A member paying and not coming
is not a win here, for the business or the member.

## 3. Does contacting a sleeper make them cancel? What the evidence says

**No study directly tests "we messaged inactive members and X% cancelled
because of it."** I looked for one and didn't find it. What exists:

- **Staff contact is linked to staying, not leaving.** Dr Paul Bedford
  (Retention Guru, the main UK researcher on gym retention) is widely
  quoted for the finding that two meaningful staff interactions a month
  go with roughly a third fewer cancellations, and that each extra visit
  in a month lowers next-month cancellation risk. Vendor blogs quote
  these numbers inconsistently and I couldn't find the primary report,
  so treat the exact figures as unverified; the direction is consistent
  across everything he has published.
  ([Glofox](https://www.glofox.com/blog/gym-member-retention-strategies/),
  [Retention Guru](https://www.retentionguru.com/blog))
- **The real reasons people leave are things contact can address.**
  Bedford's exit research found the stated reasons (moved house 32%,
  money 16%) differ from the actual ones: club didn't meet expectations
  17%, loss of motivation 15%, bored 11%, **lack of support from staff
  10%**. He also warns that visit frequency on its own is a weak
  predictor: experienced exercisers train around work and family and
  still think of themselves as members. Members who feel ignored are
  less likely to stay.
  ([Health Club Management](https://www.healthclubmanagement.co.uk/health-club-management-features/Retention-Take-your-leave/28807))
- **The "silent member journey".** FM Consulting (US gym consultants)
  describe the member who joins online, trains with headphones in and
  cancels through a web form without ever having a conversation. Their
  advice: software should flag a change in someone's usual pattern, and
  a person, not an automation, should make the contact, personally.
  ([FM Consulting](https://www.fmconsulting.net/gym-consultant/has-the-gym-industry-outsmarted-itself-the-silent-member-journey-that-ends-in-cancellation/))
- **Where the backfire does show up: generic blasts and discounts.**
  Nutripy's win-back guide warns a blanket discount "trains members to
  cancel and wait for a deal". GymMaster's warning above is about
  communications in general, which in practice means the automated
  "we miss you" email. Every source that recommends contact says the
  same two things: make it personal and make it about them, not the
  membership.
  ([Nutripy](https://nutripy.io/blog/win-back-cancelled-gym-members))

**Reading all of it together:** the risk Sammy describes is attached to
*impersonal, automated* contact. A system email that says "we haven't
seen you" to someone who has half-forgotten they're a member does one
useful thing for them (reminds them of the direct debit) and nothing for
the relationship. A message from their coach that knows their name, what
they were working on and asks how they're doing is a different act, and
the research on staff contact says it keeps people.

The honest caveat: a member who has decided to leave will leave slightly
sooner if reminded. The research says that money was going anyway within
two or three months, and that a gym which relies on it is running the
Planet Fitness model whether it means to or not.

## 4. The law is moving the same way

The Digital Markets, Competition and Consumers Act 2024 brings in
subscription-contract rules that cover gym memberships: clear pre-contract
information, **reminder notices before renewal**, easy cancellation and
cooling-off rights, with the CMA able to fine up to 10% of turnover
directly. The subscription chapter is not in force yet; the government's
April 2026 response anticipates **commencement in spring 2027**. Some
blogs say the reminder duties already apply; they're confusing them with
the CMA's enforcement powers, which did start in April 2025.
([Browne Jacobson](https://www.brownejacobson.com/insights/retail-law-roundup-april-2026/subscriptions-and-dmcc-act),
[Clubwise on the DMCC](https://www.clubwise.com/clubwise-blog/what-the-dmcc-act-means-for-your-gym/),
[Smart Saver](https://getsmartsaver.co.uk/subscription-rules-uk-dmcc-2026/))

What this means for us: within about 18 months gyms will likely have to
remind members about their contract at set points anyway. "Don't remind
them they're paying" stops being an option the business can rely on, so
the only lever left is the one the retention research points at: make
the membership worth keeping, and have a person notice when someone
drifts.

## 5. What this suggests for Round One

None of this needs anything new built. It's about how staff use the
alerts that exist.

1. **Keep the rule.** Alerts stay staff-only. No automation ever messages
   a member about not coming in. The evidence that contact helps is
   evidence about *personal* contact; it doesn't rescue an automated
   nudge.
2. **Contact is the default response to an alert, not the exception,
   but by a person.** When the coach or front desk gets the inactivity
   task, the expected outcome is a WhatsApp or a call from someone the
   member knows, written for them. Ask how they are and what's got in
   the way. Don't mention the direct debit, the price or an offer.
3. **Prioritise by who contact is most likely to help.**
   - **Newer members (first 90 days) first.** Gjestvang and Bedford both
     show the habit is made or lost here, and a lapse at week three is a
     routine that broke, not a decision.
   - **People who were regular and stopped.** A pattern change is the
     signal FM Consulting and Clubwise describe. The Attendance report's
     "fastest declining" list is this.
   - **Accountability programme members** already expect contact; their
     check-in exists for exactly this.
   - **Long-standing, low-frequency members who are happy** are the
     group Bedford says not to misread. If someone has come twice a month
     for two years, that's their pattern. A friendly hello in person is
     fine; a "we've noticed you've not been in" is not.
4. **Never a discount to a sleeper.** Offers go to ex-members in a
   win-back, if at all (item 17, not yet). To a current member a
   discount says the membership was overpriced.
5. **Record the outcome so the question gets answered with our own
   numbers.** Each inactivity task should end with one of: came back,
   replied but not back, no reply, cancelled. After three months we can
   see whether contacted members cancel more or less than uncontacted
   ones, which is the thing nobody has published. This is a small
   addition to the task (a reason on completion) if Sammy wants it.
6. **Threshold.** 20 days is in line with the industry's escalation
   points (Clubwise: 7 to 14 days light touch, 21 to 30 personal, 45 to
   60 phone). Because ours is a single staff alert rather than a
   sequence, 20 days as the first and only trigger is sensible. If staff
   find it noisy, 28 days (two missed weekly patterns) is the next
   natural setting.

## 6. How much to trust each source

| Source | Type | Weight |
|---|---|---|
| DellaVigna & Malmendier 2006 | Peer-reviewed, 7,752 members, AER | High |
| Gjestvang et al. 2021 | Peer-reviewed, 250 members, one year | High for the pattern, small sample |
| Bedford / Retention Guru | Industry researcher; primary reports behind paywall, figures quoted second-hand | Medium; direction solid, numbers soft |
| Sherwood News on Planet Fitness | Journalism with own arithmetic | Medium |
| GymMaster, Clubwise, Nutripy, FM Consulting, Glofox | Vendor and consultant blogs | Low for figures; useful for what the industry actually does |
| UK "£503m wasted" surveys | PR surveys | Low |
| DMCC Act commentary | Law firms, April 2026 | High for the law; dates still subject to Parliament |
