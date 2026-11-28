/**
 * Student → Profile (docs/18 §6, docs/19 §10: "students (limited columns)"). Own details from the students row (RLS: self read).
 * Editable: mobile, city, GitHub, LinkedIn (guard_students). Code, name, email and the rest are read-only.
 */
import type { Metadata } from "next";
import Link from "next/link";
import { KeyRound, Lock } from "lucide-react";
import { Avatar, Card, CardHeader, DL, EmptyState, Notice, PageHeader } from "@/components/ui";
import { requireRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/utils";
import { ProfileForm, type MyContact } from "./profile-form";

export const metadata: Metadata = { title: "Profile" };

type Me = MyContact & {
  code: string;
  full_name: string;
  name_on_documents: string;
  email: string;
  dob: string | null;
  college: string;
  course: string | null;
  year_of_study: number | null;
};

export default async function StudentProfilePage() {
  await requireRole(["student"]);
  const supabase = await createClient();
  const { data } = await supabase
    .from("students")
    .select("code, full_name, name_on_documents, email, phone, dob, city, college, course, year_of_study, github_url, linkedin_url")
    .maybeSingle<Me>();

  if (!data) {
    return (
      <>
        <PageHeader title="Profile" />
        <Card>
          <EmptyState title="Your student record was not found">Please contact the Quellflow team on WhatsApp or email.</EmptyState>
        </Card>
      </>
    );
  }

  return (
    <>
      <PageHeader title={data.full_name} description={data.code} lead={<Avatar name={data.full_name} size="xl" />} />

      <Card>
        <CardHeader title="My details" info="You can change these yourself. The team uses your mobile number for WhatsApp updates." />
        <ProfileForm me={data} />
      </Card>

      <Card>
        <CardHeader title="On your documents" info="These are printed on your offer letter and certificate, so only the office can change them." />
        <div className="flex flex-col gap-4 p-4">
          <DL
            items={[
              ["Student code", data.code],
              ["Full name", data.full_name],
              ["Name on certificates", data.name_on_documents],
              ["Email", <span key="e" className="[overflow-wrap:anywhere]">{data.email}</span>],
              ["Date of birth", data.dob ? formatDate(data.dob) : "—"],
              ["College", data.college],
              ["Course", [data.course, data.year_of_study ? `Year ${data.year_of_study}` : null].filter(Boolean).join(", ") || "—"],
            ]}
          />
          <Notice tone="info" icon={<Lock aria-hidden />}>
            Something wrong here? Ask the Quellflow team to correct it.
          </Notice>
        </div>
      </Card>

      <Card>
        <CardHeader title="Sign-in" />
        <Link href="/account/password" className="flex min-h-13 items-center gap-3 px-4 py-3 text-sm font-semibold text-fg no-underline hover:bg-hover">
          <KeyRound className="size-[18px] text-fg-2" aria-hidden />
          Change password
        </Link>
      </Card>
    </>
  );
}
