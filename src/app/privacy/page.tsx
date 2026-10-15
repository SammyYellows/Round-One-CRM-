// The privacy policy (Sammy, 13/10/2026), needed to publish the Meta app so
// WhatsApp messages reach the CRM. Public, no login. Says what the CRM keeps
// and why; keep it true to the CRM whenever a new kind of data is added.

import type { Metadata } from "next";
import { GYM } from "@/lib/gym";

export const metadata: Metadata = { title: "Privacy policy | Round One" };

const UPDATED = "14 October 2026";
const EMAIL = "info@round1boxfit.co.uk";

export default function PrivacyPage() {
  return (
    <main className="unsub">
      <div className="unsub-bar">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/logo.avif" alt={GYM.name} width={96} style={{ display: "block", height: "auto" }} />
      </div>
      <article className="unsub-box privacy">
        <h1 className="h h2">Privacy policy</h1>
        <p className="privacy-date">Last updated {UPDATED}</p>

        <h2>Who we are</h2>
        <p>{GYM.name} is a boxing and strength gym run by Lee Haskins Ltd (“we”, “us”), {GYM.address}. We are responsible for the personal information described here. You can contact us at <a href={`mailto:${EMAIL}`}>{EMAIL}</a> or on 0117 2510 120.</p>
        <p>This policy covers how we handle your information when you enquire about the gym, book an intro meeting, message us on WhatsApp, Facebook, Instagram or by email, or become a member.</p>

        <h2>What we keep</h2>
        <ul>
          <li><strong>Contact details:</strong> your name, mobile number and email address.</li>
          <li><strong>Your answers:</strong> what you tell us on our enquiry form, such as your goals and how you like to train.</li>
          <li><strong>Bookings:</strong> intro meetings you book with us and whether you came.</li>
          <li><strong>Messages:</strong> WhatsApp, Facebook and Instagram messages and emails between you and us, and whether they were delivered and read. When you message us on Facebook or Instagram we keep your name or username and the id Meta gives us for replying to you.</li>
          <li><strong>Membership:</strong> from our booking system (TeamUp), your membership type, start and end dates, whether payments have gone through (not your card details) and the classes you attend.</li>
          <li><strong>Door entries:</strong> from our door system (Kisi), the times you came into the gym.</li>
          <li><strong>Safety:</strong> whether you have signed our waiver, and your emergency contact.</li>
          <li><strong>Area:</strong> for members, the first part of your postcode (for example BS5), taken from the address you gave TeamUp. We keep only that, never your full address, to see which areas our members come from.</li>
          <li><strong>How you found us:</strong> the advert or link you came from.</li>
          <li><strong>Notes:</strong> notes our staff make, for example after speaking to you at the desk.</li>
        </ul>

        <h2>How we use it</h2>
        <ul>
          <li>To reply to you and arrange your intro meeting, and to send reminders about it.</li>
          <li>To run your membership and send you messages about it.</li>
          <li>To keep the gym safe, for example checking that everyone training has signed a waiver and has an emergency contact.</li>
          <li>To look after members, for example so a coach can check in if you haven’t been in for a while. We never send messages about this automatically; a member of staff decides.</li>
          <li>To send you news and offers, where the law allows. You can stop these at any time by replying STOP on WhatsApp or using the unsubscribe link in our emails. Messages about your own bookings and membership still come through.</li>
          <li>To see which of our adverts work.</li>
        </ul>
        <p>We do this because it is needed to provide your membership, because it is in our legitimate interests to run and promote the gym, or, for marketing, with your agreement, which you can withdraw at any time.</p>

        <h2>AI</h2>
        <p>We use Claude, made by Anthropic, to help our staff draft replies, summarise messages and spot things we need to do. A member of staff reads every reply before it is sent. Nothing written by the AI is sent to you automatically.</p>

        <h2>Who we share it with</h2>
        <p>We don’t sell your information. These companies handle it for us, only to provide their services:</p>
        <ul>
          <li>Supabase: our database (London).</li>
          <li>Vercel: hosts our system (Dublin).</li>
          <li>Resend: sends our emails.</li>
          <li>Meta: WhatsApp, Facebook and Instagram messages.</li>
          <li>Anthropic: the AI described above.</li>
          <li>TeamUp: bookings and memberships.</li>
          <li>Kisi: door access.</li>
        </ul>
        <p>Some of these companies are based outside the UK, for example in the USA. Where your information leaves the UK, it is protected by the safeguards UK data protection law requires.</p>

        <h2>How long we keep it</h2>
        <p>We keep your information while you are in contact with us or a member, and for as long as we need it for the reasons above. You can ask us to delete it at any time (see below). Anything we are legally required to keep, such as financial records, we keep for as long as the law says.</p>

        <h2>Your rights</h2>
        <p>You can ask to see the information we hold about you, to correct it, to delete it, to limit how we use it, to object to how we use it, or to have a copy to take elsewhere. Email <a href={`mailto:${EMAIL}`}>{EMAIL}</a>. If you are unhappy with how we handle your information, you can complain to the Information Commissioner’s Office: <a href="https://ico.org.uk">ico.org.uk</a>, 0303 123 1113.</p>

        <h2 id="delete">How to have your data deleted</h2>
        <ol>
          <li>Email <a href={`mailto:${EMAIL}?subject=Delete%20my%20data`}>{EMAIL}</a> with the subject “Delete my data”, from the email address you gave us, or include the mobile number you used.</li>
          <li>We will delete your information from our system, apart from anything we are legally required to keep, and confirm by email within one month.</li>
          <li>If you only want to stop marketing messages, reply STOP on WhatsApp or use the unsubscribe link in any of our emails.</li>
        </ol>

        <h2>Changes</h2>
        <p>If we change how we use your information, we will update this page and the date at the top.</p>
      </article>
    </main>
  );
}
