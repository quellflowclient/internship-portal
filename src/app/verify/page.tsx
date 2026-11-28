/**
 * Public certificate check by number + surname (docs/20 §7). A plain GET form to this page;
 * verify_by_number(number, surname, ip_hash) is granted to anon and logs the scan.
 */
import type { Metadata } from "next";
import { Button, Card, Field, Input } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { sp, type SearchParams } from "@/lib/url";
import { VerifyHeader, VerifyResult } from "../v/_parts/result";
import { visitorIpHash } from "../v/_parts/ip-hash";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Certificate check", robots: { index: false, follow: false } };

export default async function VerifyByNumberPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const query = await searchParams;
  const number = (sp(query, "number") ?? "").trim().slice(0, 40);
  const surname = (sp(query, "surname") ?? "").trim().slice(0, 60);
  const asked = number !== "" || surname !== "";
  const complete = number !== "" && surname !== "";

  let data: unknown = null;
  let failed = false;
  if (complete) {
    const supabase = await createClient();
    const res = await supabase.rpc("verify_by_number", { p_number: number, p_surname: surname, p_ip_hash: await visitorIpHash() });
    data = res.data;
    failed = !!res.error;
  }

  return (
    <div className="min-h-dvh bg-bg">
      <VerifyHeader />
      <main className="mx-auto flex max-w-2xl flex-col gap-3.5 px-4 pt-5 pb-10">
        <div>
          <h1 className="text-lg font-bold md:text-xl">Check a document</h1>
          <p className="mt-1 text-sm text-fg-2">No QR code? Enter the number printed on the document and the holder&apos;s surname.</p>
        </div>
        <Card>
          <form method="get" action="/verify" className="flex flex-col gap-3.5 p-4">
            <Field
              label="Document number"
              htmlFor="v-number"
              required
              error={asked && !number ? "Enter the number printed on the document." : undefined}
            >
              <Input
                id="v-number"
                name="number"
                defaultValue={number}
                maxLength={40}
                placeholder="QF-CERT-2627-FS-0007"
                autoCapitalize="characters"
                autoComplete="off"
                spellCheck={false}
                aria-invalid={asked && !number ? true : undefined}
                aria-describedby={asked && !number ? "v-number-error" : undefined}
              />
            </Field>
            <Field label="Surname" htmlFor="v-surname" required error={asked && !surname ? "Enter the holder's surname." : undefined}>
              <Input
                id="v-surname"
                name="surname"
                defaultValue={surname}
                maxLength={60}
                autoComplete="off"
                aria-invalid={asked && !surname ? true : undefined}
                aria-describedby={asked && !surname ? "v-surname-error" : undefined}
              />
            </Field>
            <Button type="submit" className="w-full md:w-fit">
              Check
            </Button>
          </form>
        </Card>
        {complete ? <VerifyResult data={data} failed={failed} byNumber /> : null}
      </main>
    </div>
  );
}
