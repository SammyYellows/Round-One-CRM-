// The unsubscribe page linked from every mailout. A button rather than an
// instant unsubscribe, so link scanners in mail apps don't opt people out.

import { db } from "@/lib/server/supabase";
import { GYM } from "@/lib/gym";

export const dynamic = "force-dynamic";

export default async function UnsubscribePage({ params, searchParams }: { params: { id: string }; searchParams: { done?: string } }) {
  const { data } = await db().from("contacts").select("id, marketing_opt_out").eq("id", params.id).maybeSingle();
  const done = !!searchParams.done || !!data?.marketing_opt_out;
  return (
    <main className="unsub">
      <div className="unsub-bar">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/logo.avif" alt={GYM.name} width={96} style={{ display: "block", height: "auto" }} />
      </div>
      <div className="unsub-box">
        {!data ? (
          <>
            <h1 className="h h2">Link not recognised</h1>
            <p>If you’d like to stop our emails, reply to one and tell us, or email info@round1boxfit.co.uk.</p>
          </>
        ) : done ? (
          <>
            <h1 className="h h2">You’re unsubscribed</h1>
            <p>We won’t send you any more marketing emails. Messages about your own membership or bookings still come through.</p>
          </>
        ) : (
          <>
            <h1 className="h h2">Stop emails from {GYM.name}?</h1>
            <p>Press the button and we’ll stop sending you marketing emails. Messages about your own membership or bookings still come through.</p>
            <form method="post" action={`/api/unsubscribe/${params.id}`}>
              <button className="btn btn-red" type="submit">Unsubscribe</button>
            </form>
          </>
        )}
      </div>
    </main>
  );
}
