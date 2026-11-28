/**
 * Projects panels (Drawer: side panel on desktop, bottom sheet on phones).
 *   ?new=1                         New project
 *   ?open=<code>                   Project detail (status, members, tasks, archive)
 *   ?open=<code>&panel=edit        Edit project
 *   ?open=<code>&panel=member      Add member  (&student=<id> edits one)
 *   ?open=<code>&panel=task        Add task    (&item=<id> edits one)
 */
import Link from "next/link";
import {
  ArchiveRestore,
  Award,
  BookOpen,
  ExternalLink,
  FolderGit2,
  FolderKanban,
  Link2,
  ListPlus,
  Pencil,
  ShieldAlert,
  Trash2,
  TriangleAlert,
  UserPlus,
} from "lucide-react";
import { Drawer } from "@/components/drawer";
import { ActionButton, ActionForm, FieldError, SubmitButton } from "@/components/toast";
import {
  Avatar,
  Bar,
  ButtonLink,
  DL,
  Field,
  FormGrid,
  IconAnchor,
  IconLink,
  InfoTip,
  Input,
  Notice,
  Pill,
  RadioSegment,
  Select,
  Textarea,
} from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { sp, type SearchParams } from "@/lib/url";
import { formatDate } from "@/lib/utils";
import {
  archiveProject,
  createProject,
  deleteTask,
  removeMember,
  restoreMember,
  restoreProject,
  restoreTask,
  saveMember,
  saveTask,
  setProjectStatus,
  updateProject,
} from "@/server/actions/projects";
import { IconAction, TaskStatusSelect } from "./controls";
import { formChoices, getProject, toInitial, type ProjectData } from "./data";
import { ProjectForm } from "./project-form";
import {
  KIND,
  KINDS,
  NEXT_STATUS,
  REPORT_STATUS,
  STATUS,
  TASK_STATUS,
  TASK_STATUSES,
  isUuid,
  projectHref,
  shortUrl,
  type ProjectKind,
} from "./shared";

const lead = (
  <span className="grid size-9 shrink-0 place-items-center rounded-full bg-surface-2 text-fg-2 [&_svg]:size-4">
    <FolderKanban aria-hidden />
  </span>
);

const studentPath = (code: string) => `/admin/students/${encodeURIComponent(code)}`;
const certificateHref = (studentId?: string) =>
  `/admin/documents?new=1&type=project_certificate${studentId ? `&student=${encodeURIComponent(studentId)}` : ""}`;

function CancelLink({ href }: { href: string }) {
  return (
    <ButtonLink variant="ghost" href={href} scroll={false}>
      Cancel
    </ButtonLink>
  );
}

/* =====================================================================
 * New project
 * ===================================================================== */
export async function NewProjectPanel({ params, closeHref }: { params: SearchParams; closeHref: string }) {
  const supabase = await createClient();
  const { batches, admins } = await formChoices(supabase);
  const kindParam = sp(params, "kind");
  const kind: ProjectKind = KINDS.includes(kindParam as ProjectKind) ? (kindParam as ProjectKind) : "college";
  // The list's batch filter (or Batch → Projects → New project) pre-selects that batch.
  const initial = { ...toInitial(null, kind), batch_id: batches.find((b) => b.label === sp(params, "batch"))?.value ?? "" };
  return (
    <Drawer
      closeHref={closeHref}
      title="New project"
      sub="Pick the kind first. The fields change with it."
      lead={lead}
      footer={
        <>
          <CancelLink href={closeHref} />
          <span className="flex-1 max-md:hidden" />
          <SubmitButton form="f-project" pendingText="Creating…">
            Create project
          </SubmitButton>
        </>
      }
    >
      <ProjectForm formId="f-project" action={createProject} initial={initial} isNew batches={batches} admins={admins} />
    </Drawer>
  );
}

/* =====================================================================
 * ?open=<code> – dispatches to the right panel
 * ===================================================================== */
export async function ProjectPanel({ code, params }: { code: string; params: SearchParams }) {
  const supabase = await createClient();
  const data = await getProject(supabase, code);
  const closeHref = projectHref(params);
  if (!data) {
    return (
      <Drawer closeHref={closeHref} title="Project not found">
        <Notice tone="warn" icon={<TriangleAlert aria-hidden />}>
          No project has the code {code}.
        </Notice>
      </Drawer>
    );
  }
  const selfHref = projectHref(params, { open: data.project.code });
  const panel = sp(params, "panel");
  const archived = !!data.project.archived_at;
  if (!archived && panel === "edit") return <EditPanel data={data} closeHref={closeHref} selfHref={selfHref} />;
  if (!archived && panel === "member") {
    return <MemberPanel data={data} closeHref={closeHref} selfHref={selfHref} studentId={sp(params, "student")} />;
  }
  if (!archived && panel === "task") return <TaskPanel data={data} closeHref={closeHref} selfHref={selfHref} taskId={sp(params, "item")} />;
  return <DetailPanel data={data} params={params} closeHref={closeHref} />;
}

/* ---------- detail ---------- */
function DetailPanel({ data, params, closeHref }: { data: ProjectData; params: SearchParams; closeHref: string }) {
  const { project: p, members, tasks } = data;
  const archived = !!p.archived_at;
  const at = (changes: Record<string, string | null>) => projectHref(params, { open: p.code, ...changes });
  const st = STATUS[p.status];
  const done = tasks.filter((t) => t.status === "done").length;
  const names = new Map(members.map((m) => [m.student_id, m.student?.full_name ?? "Student"]));

  const items: [React.ReactNode, React.ReactNode][] = [
    [
      "Batch",
      p.batch ? (
        <Link href={`/admin/batches/${encodeURIComponent(p.batch.code)}/projects`} className="font-semibold text-accent-ink">
          {p.batch.code}
        </Link>
      ) : (
        "—"
      ),
    ],
    ["Lead admin", p.lead ? p.lead.full_name || p.lead.email : "—"],
    ["Dates", p.start_date || p.due_date ? `${formatDate(p.start_date)} to ${formatDate(p.due_date)}` : "—"],
  ];
  if (p.kind === "client") {
    items.push(["Client", p.client_name ?? "—"]);
    items.push(["Client contact", p.client_contact ?? "—"]);
  }
  if (p.kind === "college") {
    items.push(["College", p.college_name ?? "—"]);
    items.push(["Guide", p.guide_name ?? "—"]);
    items.push(["Submission due", formatDate(p.submission_due)]);
    items.push([
      "Report",
      p.report_status ? (
        <Pill key="r" tone={REPORT_STATUS[p.report_status].tone}>
          {REPORT_STATUS[p.report_status].label}
        </Pill>
      ) : (
        "—"
      ),
    ]);
  }
  items.push([
    "GitHub",
    p.github_url ? (
      <a href={p.github_url} target="_blank" rel="noopener noreferrer" className="font-semibold break-all text-accent-ink">
        {shortUrl(p.github_url)}
      </a>
    ) : (
      "—"
    ),
  ]);
  if (p.description) items.push(["About", <span key="d" className="font-normal whitespace-pre-line">{p.description}</span>]);

  const certStudent = members.length === 1 ? members[0].student_id : undefined;
  const canCertify = p.kind === "college" && members.length > 0 && !archived;

  const footer = archived ? (
    <>
      <span className="text-xs text-fg-3 max-md:hidden">Archived projects cannot be changed.</span>
      <span className="flex-1 max-md:hidden" />
      <ActionButton action={restoreProject.bind(null, p.id)} variant="primary">
        <ArchiveRestore aria-hidden />
        Restore
      </ActionButton>
    </>
  ) : (
    <>
      <ActionButton action={archiveProject.bind(null, p.id)} undo={restoreProject} variant="danger">
        <Trash2 aria-hidden />
        Archive
      </ActionButton>
      <span className="flex-1 max-md:hidden" />
      {canCertify ? (
        <ButtonLink href={certificateHref(certStudent)}>
          <Award aria-hidden />
          Issue project certificate
        </ButtonLink>
      ) : null}
      <ButtonLink variant="primary" href={at({ panel: "edit" })} scroll={false}>
        <Pencil aria-hidden />
        Edit
      </ButtonLink>
    </>
  );

  return (
    <Drawer
      closeHref={closeHref}
      title={p.name}
      sub={p.code}
      lead={lead}
      icons={
        <>
          {p.github_url ? (
            <IconAnchor href={p.github_url} label="Open the GitHub repo">
              <FolderGit2 aria-hidden />
            </IconAnchor>
          ) : null}
          {p.demo_url ? (
            <IconAnchor href={p.demo_url} label="Open the demo">
              <ExternalLink aria-hidden />
            </IconAnchor>
          ) : null}
          {p.docs_url ? (
            <IconAnchor href={p.docs_url} label="Open the docs">
              <BookOpen aria-hidden />
            </IconAnchor>
          ) : null}
        </>
      }
      footer={footer}
    >
      {archived ? (
        <Notice tone="warn" icon={<TriangleAlert aria-hidden />}>
          Archived {formatDate(p.archived_at)}. Restore it to make changes.
        </Notice>
      ) : null}

      <div className="flex flex-wrap items-center gap-1.5">
        <Pill tone={KIND[p.kind].tone}>{KIND[p.kind].label}</Pill>
        <Pill tone={st.tone} dot>
          {st.label}
        </Pill>
        {p.github_visibility ? <Pill>{p.github_visibility === "org" ? "Org repo" : `${p.github_visibility[0].toUpperCase()}${p.github_visibility.slice(1)} repo`}</Pill> : null}
        {archived ? <Pill tone="mute">Archived</Pill> : null}
      </div>

      {!archived ? (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-semibold text-fg-2">Change status</span>
            <InfoTip text="Planned → Active → Completed, On hold or Cancelled. On hold can resume. Completed and Cancelled can be reopened." />
          </div>
          <div className="flex flex-wrap gap-2">
            {NEXT_STATUS[p.status].map((n) => (
              <ActionButton key={n.to} action={setProjectStatus.bind(null, p.id, n.to)} variant={n.to === "cancelled" ? "ghost" : "secondary"}>
                {n.label}
              </ActionButton>
            ))}
          </div>
        </div>
      ) : null}

      <DL items={items} />

      {/* ---------- members ---------- */}
      <section className="flex flex-col gap-2" aria-labelledby="pj-members">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <h3 id="pj-members" className="text-sm font-semibold">
              Members <span className="font-medium text-fg-3">{members.length}</span>
            </h3>
            <InfoTip
              text={
                p.kind === "client"
                  ? "Client project members must have accepted the NDA consent. Role, hours and the contribution note go into experience letters."
                  : "Role, hours and the contribution note go into the project certificate."
              }
            />
          </div>
          {!archived ? (
            <ButtonLink size="sm" href={at({ panel: "member" })} scroll={false}>
              <UserPlus aria-hidden />
              Add member
            </ButtonLink>
          ) : null}
        </div>
        {p.kind === "client" && !archived ? (
          <Notice tone="warn" icon={<ShieldAlert aria-hidden />}>
            Only students who accepted the NDA consent can join.
          </Notice>
        ) : null}
        {members.length ? (
          <ul className="flex flex-col divide-y divide-line rounded-lg border border-line">
            {members.map((m) => {
              const name = m.student?.full_name ?? "Student";
              return (
                <li key={m.student_id} className="flex items-start gap-2.5 py-2 pr-1 pl-3">
                  <Avatar name={name} />
                  <div className="min-w-0 flex-1 py-0.5">
                    {m.student ? (
                      <Link href={studentPath(m.student.code)} className="block truncate text-sm font-semibold text-fg">
                        {name}
                      </Link>
                    ) : (
                      <b className="block truncate text-sm font-semibold">{name}</b>
                    )}
                    <small className="block text-xs text-fg-3">
                      {[m.role, m.hours != null ? `${m.hours} hours` : null].filter(Boolean).join(", ") || "No role yet"}
                    </small>
                    {m.contribution_note ? <p className="mt-1 text-xs whitespace-pre-line text-fg-2">{m.contribution_note}</p> : null}
                  </div>
                  {!archived ? (
                    <div className="flex shrink-0 items-center">
                      {p.kind === "college" ? (
                        <IconLink href={certificateHref(m.student_id)} label={`Issue project certificate for ${name}`}>
                          <Award aria-hidden />
                        </IconLink>
                      ) : null}
                      <IconLink href={at({ panel: "member", student: m.student_id })} label={`Edit ${name}`} scroll={false}>
                        <Pencil aria-hidden />
                      </IconLink>
                      <IconAction label={`Remove ${name}`} action={removeMember.bind(null, p.id, m.student_id)} undo={restoreMember} className="hover:text-bad">
                        <Trash2 aria-hidden />
                      </IconAction>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-sm text-fg-3">No members yet.</p>
        )}
      </section>

      {/* ---------- tasks ---------- */}
      <section className="flex flex-col gap-2" aria-labelledby="pj-tasks">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <h3 id="pj-tasks" className="text-sm font-semibold">
              Tasks <span className="font-medium text-fg-3">{tasks.length ? `${done} of ${tasks.length} done` : ""}</span>
            </h3>
            <InfoTip text="Tracking only: To do, Doing, Review, Done. Change a status from the list." />
          </div>
          {!archived ? (
            <ButtonLink size="sm" href={at({ panel: "task" })} scroll={false}>
              <ListPlus aria-hidden />
              Add task
            </ButtonLink>
          ) : null}
        </div>
        {tasks.length ? <Bar pct={Math.round((done / tasks.length) * 100)} tone="ok" label={`${done} of ${tasks.length} tasks done`} /> : null}
        {tasks.length ? (
          <ul className="flex flex-col divide-y divide-line rounded-lg border border-line">
            {[...tasks]
              .sort((a, b) => TASK_STATUSES.indexOf(a.status) - TASK_STATUSES.indexOf(b.status))
              .map((t) => (
                <li key={t.id} className="flex flex-wrap items-center gap-x-2 gap-y-1 py-2 pr-1 pl-3">
                  <div className="min-w-0 flex-[1_1_160px]">
                    <b className={t.status === "done" ? "block text-sm font-semibold break-words text-fg-3 line-through" : "block text-sm font-semibold break-words"}>
                      {t.title}
                    </b>
                    <small className="block text-xs text-fg-3">
                      {[t.assignee_student_id ? (names.get(t.assignee_student_id) ?? "Former member") : "Not assigned", t.due_on ? `due ${formatDate(t.due_on)}` : null]
                        .filter(Boolean)
                        .join(", ")}
                    </small>
                  </div>
                  <div className="flex shrink-0 items-center gap-0.5">
                    <TaskStatusSelect id={t.id} status={t.status} title={t.title} disabled={archived} />
                    {t.link ? (
                      <IconAnchor href={t.link} label={`Open the link for ${t.title}`}>
                        <Link2 aria-hidden />
                      </IconAnchor>
                    ) : null}
                    {!archived ? (
                      <>
                        <IconLink href={at({ panel: "task", item: t.id })} label={`Edit ${t.title}`} scroll={false}>
                          <Pencil aria-hidden />
                        </IconLink>
                        <IconAction label={`Delete ${t.title}`} action={deleteTask.bind(null, t.id)} undo={restoreTask} className="hover:text-bad">
                          <Trash2 aria-hidden />
                        </IconAction>
                      </>
                    ) : null}
                  </div>
                </li>
              ))}
          </ul>
        ) : (
          <p className="text-sm text-fg-3">No tasks yet.</p>
        )}
      </section>
    </Drawer>
  );
}

/* ---------- edit ---------- */
async function EditPanel({ data, closeHref, selfHref }: { data: ProjectData; closeHref: string; selfHref: string }) {
  const supabase = await createClient();
  const { batches, admins } = await formChoices(supabase, data.project.batch_id);
  const p = data.project;
  return (
    <Drawer
      closeHref={closeHref}
      title={`Edit ${p.name}`}
      sub={`${p.code}, ${KIND[p.kind].label.toLowerCase()} project. The kind and code cannot change.`}
      lead={lead}
      footer={
        <>
          <CancelLink href={selfHref} />
          <span className="flex-1 max-md:hidden" />
          <SubmitButton form="f-project-edit">Save</SubmitButton>
        </>
      }
    >
      <ProjectForm formId="f-project-edit" closeHref={selfHref} action={updateProject} initial={toInitial(p)} isNew={false} batches={batches} admins={admins} />
    </Drawer>
  );
}

/* ---------- member ---------- */
type StudentOption = {
  id: string;
  code: string;
  full_name: string;
  enrollments: { batch_id: string; status: string }[];
};

async function MemberPanel({
  data,
  closeHref,
  selfHref,
  studentId,
}: {
  data: ProjectData;
  closeHref: string;
  selfHref: string;
  studentId?: string;
}) {
  const { project: p, members } = data;
  const editing = isUuid(studentId) ? members.find((m) => m.student_id === studentId) : undefined;
  const supabase = await createClient();

  let inBatch: StudentOption[] = [];
  let others: StudentOption[] = [];
  let nda = new Set<string>();
  if (!editing) {
    const [studentsRes, ndaRes] = await Promise.all([
      supabase.from("students").select("id, code, full_name, enrollments(batch_id, status)").neq("state", "archived").order("full_name"),
      p.kind === "client"
        ? supabase.from("documents").select("student_id").eq("type", "consent").eq("status", "accepted")
        : Promise.resolve({ data: [] }),
    ]);
    const taken = new Set(members.map((m) => m.student_id));
    const all = ((studentsRes.data ?? []) as unknown as StudentOption[]).filter((s) => !taken.has(s.id));
    nda = new Set(((ndaRes.data ?? []) as { student_id: string }[]).map((d) => d.student_id));
    const isIn = (s: StudentOption) =>
      !!p.batch_id && (s.enrollments ?? []).some((e) => e.batch_id === p.batch_id && !["withdrawn", "dropped", "transferred"].includes(e.status));
    inBatch = all.filter(isIn);
    others = all.filter((s) => !isIn(s));
  }
  const option = (s: StudentOption) => (
    <option key={s.id} value={s.id}>
      {s.full_name}, {s.code}
      {p.kind === "client" && !nda.has(s.id) ? " (no NDA yet)" : ""}
    </option>
  );
  const name = editing?.student?.full_name ?? "Student";

  return (
    <Drawer
      closeHref={closeHref}
      title={editing ? `Edit ${name}` : "Add member"}
      sub={`${p.name}, ${p.code}`}
      lead={lead}
      footer={
        <>
          <CancelLink href={selfHref} />
          <span className="flex-1 max-md:hidden" />
          <SubmitButton form="f-member" pendingText={editing ? "Saving…" : "Adding…"}>
            {editing ? "Save" : "Add member"}
          </SubmitButton>
        </>
      }
    >
      {p.kind === "client" ? (
        <Notice tone="warn" icon={<ShieldAlert aria-hidden />}>
          Client project. The student must have accepted the NDA consent (a Consent document) before they can join.
        </Notice>
      ) : null}
      <ActionForm action={saveMember} id="f-member" closeHref={selfHref}>
        <input type="hidden" name="project_id" value={p.id} />
        <FormGrid>
          {editing ? (
            <>
              <input type="hidden" name="student_id" value={editing.student_id} />
              <input type="hidden" name="editing" value="1" />
              <div className="flex items-center gap-2.5 md:col-span-2">
                <Avatar name={name} />
                <b className="text-sm font-semibold">{name}</b>
              </div>
              <FieldError name="student_id" />
            </>
          ) : (
            <Field label="Student" htmlFor="pm-student" required className="md:col-span-2">
              <Select id="pm-student" name="student_id" defaultValue="" aria-required>
                <option value="">Choose a student</option>
                {inBatch.length ? <optgroup label={`In ${p.batch?.code ?? "this batch"}`}>{inBatch.map(option)}</optgroup> : null}
                {others.length ? <optgroup label={inBatch.length ? "Other students" : "Students"}>{others.map(option)}</optgroup> : null}
              </Select>
              <FieldError name="student_id" />
            </Field>
          )}
          <Field label="Role" htmlFor="pm-role" hint="e.g. Developer, Designer, Tester">
            <Input id="pm-role" name="role" maxLength={60} defaultValue={editing?.role ?? ""} autoComplete="off" list="pm-roles" />
            <datalist id="pm-roles">
              {["Lead developer", "Developer", "Designer", "Tester", "Analyst", "BD"].map((r) => (
                <option key={r} value={r} />
              ))}
            </datalist>
            <FieldError name="role" />
          </Field>
          <Field label="Hours" htmlFor="pm-hours" hint="Total hours on this project">
            <Input id="pm-hours" name="hours" inputMode="numeric" defaultValue={editing?.hours ?? ""} autoComplete="off" />
            <FieldError name="hours" />
          </Field>
          <Field label="Contribution note" htmlFor="pm-note" hint="Used in the project certificate or experience letter." className="md:col-span-2">
            <Textarea id="pm-note" name="contribution_note" maxLength={1000} rows={3} defaultValue={editing?.contribution_note ?? ""} />
            <FieldError name="contribution_note" />
          </Field>
        </FormGrid>
      </ActionForm>
    </Drawer>
  );
}

/* ---------- task ---------- */
function TaskPanel({ data, closeHref, selfHref, taskId }: { data: ProjectData; closeHref: string; selfHref: string; taskId?: string }) {
  const { project: p, members, tasks } = data;
  const t = isUuid(taskId) ? tasks.find((x) => x.id === taskId) : undefined;
  return (
    <Drawer
      closeHref={closeHref}
      title={t ? "Edit task" : "Add task"}
      sub={`${p.name}, ${p.code}`}
      lead={lead}
      footer={
        <>
          <CancelLink href={selfHref} />
          <span className="flex-1 max-md:hidden" />
          <SubmitButton form="f-task" pendingText={t ? "Saving…" : "Adding…"}>
            {t ? "Save" : "Add task"}
          </SubmitButton>
        </>
      }
    >
      <ActionForm action={saveTask} id="f-task" closeHref={selfHref}>
        <input type="hidden" name="project_id" value={p.id} />
        {t ? <input type="hidden" name="id" value={t.id} /> : null}
        <FormGrid>
          <Field label="Task" htmlFor="pt-title" required className="md:col-span-2">
            <Input id="pt-title" name="title" maxLength={200} defaultValue={t?.title ?? ""} autoComplete="off" aria-required />
            <FieldError name="title" />
          </Field>
          <div className="md:col-span-2">
            <RadioSegment
              name="status"
              label="Status"
              defaultValue={t?.status ?? "todo"}
              options={TASK_STATUSES.map((s) => ({ value: s, label: TASK_STATUS[s].label }))}
            >
              <FieldError name="status" />
            </RadioSegment>
          </div>
          <Field label="Assignee" htmlFor="pt-assignee" hint={members.length ? undefined : "Add members first to assign tasks."}>
            <Select id="pt-assignee" name="assignee_student_id" defaultValue={t?.assignee_student_id ?? ""}>
              <option value="">Not assigned</option>
              {members.map((m) => (
                <option key={m.student_id} value={m.student_id}>
                  {m.student?.full_name ?? "Student"}
                </option>
              ))}
            </Select>
            <FieldError name="assignee_student_id" />
          </Field>
          <Field label="Due date" htmlFor="pt-due">
            <Input id="pt-due" name="due_on" type="date" defaultValue={t?.due_on ?? ""} />
            <FieldError name="due_on" />
          </Field>
          <Field label="Link" htmlFor="pt-link" hint="Pull request, commit or document" className="md:col-span-2">
            <Input id="pt-link" name="link" inputMode="url" placeholder="https://…" defaultValue={t?.link ?? ""} autoComplete="off" />
            <FieldError name="link" />
          </Field>
        </FormGrid>
      </ActionForm>
    </Drawer>
  );
}
