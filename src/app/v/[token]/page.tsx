/**
 * Public certificate check by QR (docs/20 E-6, §7; docs/19 §8 P6 step 4).
 * verify_document(token, ip_hash) is granted to anon, returns only public fields and logs the scan.
 */
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { VerifyHeader, VerifyResult } from "../_parts/result";
import { visitorIpHash } from "../_parts/ip-hash";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Certificate check", robots: { index: false, follow: false } };

export default async function VerifyByTokenPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  let data: unknown = { result: "not_found" };
  let failed = false;

  // Abuse guard: only well-formed tokens reach the database.
  if (/^[0-9a-f]{32,64}$/.test(token)) {
    const supabase = await createClient();
    const res = await supabase.rpc("verify_document", { p_token: token, p_ip_hash: await visitorIpHash() });
    data = res.data;
    failed = !!res.error;
  }

  return (
    <div className="min-h-dvh bg-bg">
      <VerifyHeader />
      <main className="mx-auto flex max-w-2xl flex-col gap-3.5 px-4 pt-5 pb-10">
        <VerifyResult data={data} failed={failed} />
      </main>
    </div>
  );
}
