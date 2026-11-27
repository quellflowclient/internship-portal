import { Info, UserPlus } from "lucide-react";
import { Avatar, ButtonLink, Card, CardHeader, Checkbox, DL, Field, Input, Notice, Pill, RadioSegment } from "@/components/ui";
import { Chevron, End, List, ListRow, MainCell } from "@/components/list";
import { Drawer } from "@/components/drawer";
import { ActionButton, ActionForm, FieldError, SubmitButton } from "@/components/toast";
import { createClient } from "@/lib/supabase/server";
import { ROLE_LABEL } from "@/lib/labels";
import type { Profile } from "@/lib/types";
import { formatDate } from "@/lib/utils";
import { inviteAdmin, revokeInvitation, setUserRole } from "@/server/actions/settings";

type Invitation = { id: string; email: string; created_at: string; expires_at: string };

const CLOSE = "/admin/settings?sec=users";

function Pills({ p }: { p: Profile }) {
  return (
    <>
      <Pill tone={p.role === "admin" ? "acc" : "mute"}>{ROLE_LABEL[p.role]}</Pill>
      {p.is_owner ? <Pill tone="vio">Owner</Pill> : null}
      {p.is_active ? <Pill tone="ok">Active</Pill> : <Pill tone="warn">No access</Pill>}
    </>
  );
}

export async function UsersSection({ isOwner, selfId, open, isNew }: { isOwner: boolean; selfId: string; open?: string; isNew: boolean }) {
  const supabase = await createClient();
  const [people, students, invites] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, role, is_owner, is_active, full_name, email, phone, created_at")
      .or("role.eq.admin,is_active.eq.false")
      .order("created_at"),
    supabase.from("profiles").select("id", { count: "exact", head: true }).eq("role", "student").eq("is_active", true),
    supabase
      .from("invitations")
      .select("id, email, created_at, expires_at")
      .eq("role", "admin")
      .is("accepted_at", null)
      .is("revoked_at", null)
      .order("created_at", { ascending: false }),
  ]);
  const profiles = ((people.data ?? []) as Profile[]).sort(
    (a, b) => Number(b.is_owner) - Number(a.is_owner) || Number(b.role === "admin") - Number(a.role === "admin") || Number(b.is_active) - Number(a.is_active),
  );
  const pending = (invites.data ?? []) as Invitation[];
  const sel = open ? profiles.find((p) => p.id === open) : undefined;
  const now = Date.now();

  return (
    <>
      <Card>
        <CardHeader
          title="Users and access"
          info="Students are not invited here. They get an invitation automatically when they are added in Students."
          actions={
            isOwner ? (
              <ButtonLink href={`${CLOSE}&new=1`} scroll={false} size="sm">
                <UserPlus aria-hidden />
                Invite admin
              </ButtonLink>
            ) : null
          }
        />
        <List
          cols="minmax(0,2fr) minmax(0,1fr) 20px"
          head={[["Person"], ["Access", "wide-right"], ["", "wide"]]}
          empty="No admin accounts yet."
        >
          {profiles.map((p, i) => (
            <ListRow key={p.id} href={`${CLOSE}&open=${p.id}`} i={i} selected={p.id === open}>
              <MainCell avatar={p.full_name ?? p.email} title={`${p.full_name ?? p.email}${p.id === selfId ? " (you)" : ""}`} sub={p.email} />
              <End>
                <span className="hidden items-center gap-1.5 md:inline-flex">
                  <Pills p={p} />
                </span>
                <span className="md:hidden">
                  {!p.is_active ? <Pill tone="warn">No access</Pill> : p.is_owner ? <Pill tone="vio">Owner</Pill> : <Pill tone={p.role === "admin" ? "acc" : "mute"}>{ROLE_LABEL[p.role]}</Pill>}
                </span>
              </End>
              <Chevron />
            </ListRow>
          ))}
        </List>
        <div className="border-t border-line">
          <List cols="minmax(0,2fr) minmax(0,1fr) 20px">
            <ListRow href="/admin/students" i={profiles.length}>
              <MainCell title="Students" sub="Sign in with Google or email and password" />
              <End>
                <Pill>{students.count ?? 0} accounts</Pill>
              </End>
              <Chevron />
            </ListRow>
          </List>
        </div>
      </Card>

      <Card>
        <CardHeader title="Pending admin invitations" info="The person becomes an admin the first time they sign in with this email." />
        {pending.length ? (
          <ul>
            {pending.map((inv) => {
              const expired = new Date(inv.expires_at).getTime() < now;
              return (
                <li key={inv.id} className="flex min-h-[52px] items-center gap-3 border-t border-line px-4 py-2 first:border-t-0">
                  <div className="min-w-0 flex-1">
                    <b className="block truncate text-sm font-semibold">{inv.email}</b>
                    <small className="block text-xs text-fg-3">
                      Invited {formatDate(inv.created_at)}, {expired ? "expired" : `expires ${formatDate(inv.expires_at)}`}
                    </small>
                  </div>
                  {expired ? <Pill tone="warn">Expired</Pill> : <Pill tone="info">Pending</Pill>}
                  {isOwner ? (
                    <ActionButton action={revokeInvitation.bind(null, inv.id)} variant="ghost" className="h-9 px-3 text-xs md:h-8">
                      Cancel invite
                    </ActionButton>
                  ) : null}
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="px-4 py-6 text-center text-sm text-fg-3">No pending invitations.</p>
        )}
      </Card>

      {isNew && isOwner ? (
        <Drawer
          closeHref={CLOSE}
          title="Invite admin"
          sub="Gives full access to leads, students and records"
          footer={
            <>
              <ButtonLink href={CLOSE} scroll={false}>
                Cancel
              </ButtonLink>
              <SubmitButton form="invite-form" pendingText="Saving…">
                Save invitation
              </SubmitButton>
            </>
          }
        >
          <ActionForm id="invite-form" action={inviteAdmin} closeHref={CLOSE} className="flex flex-col gap-4">
            <Field label="Email" htmlFor="invite-email" required hint="Use the Google account or email they will sign in with.">
              <Input id="invite-email" name="email" type="email" autoComplete="off" inputMode="email" placeholder="name@example.com" />
              <FieldError name="email" />
            </Field>
          </ActionForm>
          <Notice tone="info" icon={<Info aria-hidden />}>
            No email is sent yet. Share the portal link with them. The invitation expires in 30 days.
          </Notice>
        </Drawer>
      ) : null}

      {sel ? (
        <Drawer
          closeHref={CLOSE}
          title={sel.full_name ?? sel.email}
          sub={sel.email}
          lead={<Avatar name={sel.full_name ?? sel.email} size="lg" />}
          footer={
            isOwner && sel.id !== selfId ? (
              <>
                <ButtonLink href={CLOSE} scroll={false}>
                  Cancel
                </ButtonLink>
                <SubmitButton form="user-form">Save access</SubmitButton>
              </>
            ) : undefined
          }
        >
          <div className="flex flex-wrap gap-1.5">
            <Pills p={sel} />
          </div>
          <DL items={[["Email", sel.email], ["Account since", formatDate(sel.created_at)]]} />
          {sel.id === selfId ? (
            <Notice tone="info" icon={<Info aria-hidden />}>
              You cannot change your own role, owner flag or access. Ask another owner.
            </Notice>
          ) : !isOwner ? (
            <Notice tone="info" icon={<Info aria-hidden />}>
              Only an owner can change roles and access.
            </Notice>
          ) : (
            <ActionForm id="user-form" action={setUserRole} closeHref={CLOSE} className="flex flex-col gap-4">
              <input type="hidden" name="profile_id" value={sel.id} />
              <RadioSegment
                name="role"
                label="Role"
                defaultValue={sel.role}
                options={[
                  { value: "admin", label: "Admin" },
                  { value: "student", label: "Student" },
                ]}
              />
              <Checkbox name="active" defaultChecked={sel.is_active} label="Can sign in to the portal" />
              <div className="flex flex-col gap-1">
                <Checkbox name="owner" defaultChecked={sel.is_owner} label="Owner. Can change settings and manage admins." />
                <FieldError name="owner" />
              </div>
            </ActionForm>
          )}
        </Drawer>
      ) : null}
    </>
  );
}
