import { redirect } from "next/navigation";
import { getSession, homeFor } from "@/lib/auth/session";

/** Entry point: send each user to their own area. */
export default async function Home() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!session.profile || !session.profile.is_active) redirect("/no-access");
  redirect(homeFor(session.profile.role));
}
