import { Flash } from "@/components/flash";
import { Button, Card, Field, Input, PageHeader, Select, StatusBadge } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/session";
import { ROLE_LABEL } from "@/lib/labels";
import { formatDate } from "@/lib/utils";
import { createInvitation, revokeInvitation, setUserRole } from "@/server/actions/admin";
import type { Profile, UserRole } from "@/lib/types";

export const metadata = { title: "Users" };

export default async function UsersPage({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const flash = await searchParams;
  const { profile: me } = await requireRole(["admin", "super_admin"]);
  const supabase = await createClient();
  const [{ data: users }, { data: invites }] = await Promise.all([
    supabase.from("profiles").select("id, full_name, email, role, is_active, created_at").order("created_at", { ascending: false }).returns<Profile[]>(),
    supabase
      .from("invitations")
      .select("id, email, role, created_at, applicant_id")
      .is("accepted_at", null)
      .is("revoked_at", null)
      .order("created_at", { ascending: false }),
  ]);
  const roles: UserRole[] = me.role === "super_admin" ? ["super_admin", "admin", "mentor", "student"] : ["admin", "mentor", "student"];

  return (
    <>
      <PageHeader title="Users & invitations" description="Access is invite-only. Invited people get their role on first sign-in." />
      <Flash {...flash} />

      <div className="grid gap-4 xl:grid-cols-[1fr_380px]">
        <Card className="overflow-x-auto p-0 sm:p-0">
          <table className="w-full text-left text-sm">
            <thead className="bg-navy text-xs text-white uppercase">
              <tr>
                <th className="px-3 py-2.5">User</th>
                <th className="px-3 py-2.5">Role & access</th>
                <th className="px-3 py-2.5">Joined</th>
              </tr>
            </thead>
            <tbody>
              {(users ?? []).map((u) => (
                <tr key={u.id} className="border-t border-line align-top">
                  <td className="px-3 py-3">
                    <p className="font-semibold">{u.full_name ?? "—"}</p>
                    <p className="text-xs text-slate">{u.email}</p>
                  </td>
                  <td className="px-3 py-3">
                    {u.id === me.id || (u.role === "super_admin" && me.role !== "super_admin") ? (
                      <span className="flex items-center gap-2">
                        {ROLE_LABEL[u.role]}
                        <StatusBadge status={u.is_active ? "active" : "not_now"} label={u.is_active ? "Active" : "Inactive"} />
                      </span>
                    ) : (
                      <form action={setUserRole} className="flex flex-wrap gap-2">
                        <input type="hidden" name="profile_id" value={u.id} />
                        <Select name="role" defaultValue={u.role} aria-label="Role" className="w-auto">
                          {roles.map((r) => (
                            <option key={r} value={r}>
                              {ROLE_LABEL[r]}
                            </option>
                          ))}
                        </Select>
                        <Select name="is_active" defaultValue={String(u.is_active)} aria-label="Access" className="w-auto">
                          <option value="true">Active</option>
                          <option value="false">Inactive</option>
                        </Select>
                        <Button type="submit" variant="secondary">
                          Save
                        </Button>
                      </form>
                    )}
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap">{formatDate(u.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        <div className="space-y-4">
          <Card>
            <h2 className="mb-3 font-bold">Invite someone</h2>
            <form action={createInvitation} className="space-y-3">
              <Field label="Email" htmlFor="inv_email" hint="Must match the Google account / email they will sign in with">
                <Input id="inv_email" name="email" type="email" required />
              </Field>
              <Field label="Role" htmlFor="inv_role">
                <Select id="inv_role" name="role" defaultValue="mentor">
                  {roles.map((r) => (
                    <option key={r} value={r}>
                      {ROLE_LABEL[r]}
                    </option>
                  ))}
                </Select>
              </Field>
              <label className="flex items-center gap-2 text-sm text-ink">
                <input type="checkbox" name="send_email" /> Send invitation email now
              </label>
              <Button type="submit" className="w-full">
                Invite
              </Button>
            </form>
          </Card>

          <Card>
            <h2 className="mb-2 font-bold">Pending invitations</h2>
            {!invites?.length ? (
              <p className="text-sm text-slate">None.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {invites.map((i) => (
                  <li key={i.id} className="flex items-center justify-between gap-2">
                    <span className="min-w-0">
                      <span className="block truncate">{i.email}</span>
                      <span className="text-xs text-slate">
                        {ROLE_LABEL[i.role as UserRole]} · {formatDate(i.created_at)}
                        {i.applicant_id ? " · from applicant" : ""}
                      </span>
                    </span>
                    <form action={revokeInvitation}>
                      <input type="hidden" name="id" value={i.id} />
                      <Button type="submit" variant="ghost" className="min-h-9 px-2 text-xs">
                        Revoke
                      </Button>
                    </form>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
