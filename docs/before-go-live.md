# Before go-live

Things that must be done before real leads use the CRM and the WhatsApp
number moves over from GymGrow. Unlike the improvement list, these all need
doing; each one still waits for Sammy to say when.

## 1. Privacy policy and consent on the form (added 02/10/2026)

The form collects names, mobiles, emails and answers, then WhatsApps and
emails people. Round One's website has no privacy policy yet (checked
30/09: no privacy page on roundonefitness.co.uk or round1boxfit.co.uk).

All four parts, in this order:

1. **Sammy:** add Wix's built-in Privacy Policy page to the website
   (Pages & Menu → Add Page → Policies / Legal → Privacy Policy), fill in
   the template, publish it and link it in the site footer.
2. **Claude:** write the extra CRM paragraphs, in plain English, for Sammy to
   paste into that page:
   - WhatsApp messages and emails about the intro meeting (and, later,
     marketing);
   - tracking which Meta ad someone came from;
   - where details are kept and who handles them: Supabase (database,
     Ireland), Vercel (website, Dublin), Meta (WhatsApp) and Resend (email);
   - how long details are kept, and how to ask for them to be deleted or to
     stop messages (reply STOP, or email info@round1boxfit.co.uk).
3. **Sammy:** send Claude the privacy page's web address.
4. **Claude:** add a consent line with a link on the form, just above Send:
   "By sending this you agree to Round One contacting you by WhatsApp and
   email about your intro meeting. Privacy policy".

Claude isn't a lawyer: Sammy checks the final wording (or has someone look
over it).

## 2. Other items (from earlier)

- Pre-live test checklist: build it, then run it.
- Decide which database is the real one (everything runs on `round1-dev`).
- Replace the keys that were pasted in chat: Supabase access token and
  database password, both Resend keys, the WhatsApp token and Meta app
  secret.
- Vercel Pro (needed for business use).
- The crm.round1boxfit.co.uk address (CNAME at SiteGround).
- Switch-over day: move the WhatsApp number from GymGrow, re-approve the
  templates on the real WhatsApp account, subscribe the webhook for it,
  change the ad links to the new form, turn GymGrow's workflows off.
