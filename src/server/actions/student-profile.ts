"use server";

/**
 * Student → Profile: the student edits their own contact fields. guard_students() (database) allows a student
 * to change only phone, city, github_url and linkedin_url; RLS limits the update to their own row.
 * Name, name on documents, email, code and college are changed by the office in Student 360.
 */
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { assertStudent } from "@/server/guard";
import { done, fail, fromDb, fromZod, type ActionResult } from "@/server/result";
import { formToObject, indianPhone, optionalText, optionalUrl } from "@/lib/validators";

const MyProfileForm = z.object({
  phone: indianPhone,
  city: optionalText(80),
  github_url: optionalUrl,
  linkedin_url: optionalUrl,
});

export async function updateMyProfile(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  const { supabase } = await assertStudent();
  const parsed = MyProfileForm.safeParse(formToObject(fd));
  if (!parsed.success) return fromZod(parsed.error);
  const v = parsed.data;

  // RLS returns only the signed-in student's own row.
  const { data: me } = await supabase.from("students").select("id").maybeSingle<{ id: string }>();
  if (!me) return fail("Your student record was not found. Please contact the Quellflow team.");

  const { data, error } = await supabase
    .from("students")
    .update({ phone: v.phone, city: v.city ?? null, github_url: v.github_url ?? null, linkedin_url: v.linkedin_url ?? null })
    .eq("id", me.id)
    .select("id");
  if (error) return fromDb(error);
  if (!data?.length) return fail("Your profile could not be saved. Please try again.");

  revalidatePath("/student/profile");
  return done("Profile saved");
}
