import Link from "next/link";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Check,
  Pencil,
  RotateCcw,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import { Drawer } from "@/components/drawer";
import {
  ActionButton,
  ActionForm,
  CopyButton,
  FieldError,
  SubmitButton,
} from "@/components/toast";
import {
  ButtonLink,
  DL,
  Field,
  IconLink,
  Notice,
  Pill,
  Textarea,
} from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { modeLabel, MONEY_CATEGORY_LABEL } from "@/lib/labels";
import { cn, formatDate, formatDateTime, formatDay, inr } from "@/lib/utils";
import { hrefWith, PANEL_PARAMS, type SearchParams } from "@/lib/url";
import { academicYear, paymentsFolder, proofFileName } from "@/lib/files";
import { restoreEntry, voidEntry } from "@/server/actions/payments";
import { ProofToggle } from "./proof-toggle";
import {
  CATEGORY_TONE,
  dayMonthYear,
  monthLabel,
  PAYMENTS_PATH,
  signed,
  SETTINGS_FIELDS,
  type EntryRow,
  type SettingsRow,
} from "./shared";

type Full = EntryRow & {
  student: {
    id: string;
    code: string;
    full_name: string;
    created_at: string;
  } | null;
  enrollment: { id: string; batch: { code: string } | null } | null;
};

/** Payments → ?open=<entry id> (and &void=1 for the reason field). */
export async function EntryPanel({
  id,
  voidMode,
  params,
}: {
  id: string;
  voidMode: boolean;
  params: SearchParams;
}) {
  const supabase = await createClient();
  const closeHref = hrefWith(PAYMENTS_PATH, params, PANEL_PARAMS);
  const { data } = await supabase
    .from("money_entries")
    .select(
      "*, student:students(id, code, full_name, created_at), enrollment:enrollments(id, batch:batches(code))",
    )
    .eq("id", id)
    .maybeSingle();
  const e = data as unknown as Full | null;

  if (!e) {
    return (
      <Drawer closeHref={closeHref} title="Entry not found">
        <Notice tone="warn" icon={<TriangleAlert aria-hidden />}>
          This entry does not exist. It may have been opened from an old link.
        </Notice>
      </Drawer>
    );
  }

  const [settingsRes, byRes, relRes] = await Promise.all([
    supabase
      .from("org_settings")
      .select(SETTINGS_FIELDS)
      .eq("id", 1)
      .maybeSingle(),
    e.created_by
      ? supabase
          .from("profiles")
          .select("full_name, email")
          .eq("id", e.created_by)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    e.related_entry_id
      ? supabase
          .from("money_entries")
          .select("amount_inr, paid_on")
          .eq("id", e.related_entry_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  const settings = settingsRes.data as SettingsRow | null;
  const by = byRes.data as { full_name: string | null; email: string } | null;
  const rel = relRes.data as {
    amount_inr: number;
    paid_on: string | null;
  } | null;

  const s = e.student;
  const voided = e.status === "void";
  const expected = e.status === "expected";
  const inflow = e.direction === "in";
  const DirIcon = inflow ? ArrowDownLeft : ArrowUpRight;
  const fileName = proofFileName(settings?.file_patterns, {
    category: e.category,
    code: s?.code ?? "",
    date: e.paid_on,
    month: e.period_month,
    amount: e.amount_inr,
  });
  const folder = s
    ? paymentsFolder(
        settings?.file_patterns,
        settings?.local_files_root,
        academicYear(
          s.created_at,
          settings?.academic_year_start_month ?? 6,
          settings?.academic_year_label_override,
        ),
        s.code,
        s.full_name,
      )
    : null;
  const editHref = hrefWith(PAYMENTS_PATH, params, {
    ...PANEL_PARAMS,
    new: 1,
    entry: e.id,
  });
  const payHref = hrefWith(PAYMENTS_PATH, params, {
    ...PANEL_PARAMS,
    new: 1,
    category: "stipend",
    entry: e.id,
    student: e.student_id,
    amount: e.amount_inr,
    month: e.period_month?.slice(0, 7) ?? null,
  });
  const selfHref = hrefWith(PAYMENTS_PATH, params, {
    ...PANEL_PARAMS,
    open: e.id,
  });

  const items: [React.ReactNode, React.ReactNode][] = [
    [
      "Student",
      s ? (
        <>
          <Link
            href={`/admin/students/${encodeURIComponent(s.code)}`}
            className="font-semibold text-accent-ink"
          >
            {s.full_name}
          </Link>
          , {s.code}
        </>
      ) : (
        "—"
      ),
    ],
    ["For", e.note || "—"],
    [
      "Entry",
      <Pill key="c" tone={CATEGORY_TONE[e.category]}>
        {MONEY_CATEGORY_LABEL[e.category]}
      </Pill>,
    ],
  ];
  if (e.enrollment?.batch?.code) items.push(["Batch", e.enrollment.batch.code]);
  if (e.period_month)
    items.push(["Stipend month", monthLabel(e.period_month.slice(0, 7), true)]);
  if (rel)
    items.push([
      "Refund of",
      `${inr(rel.amount_inr)} fee on ${formatDate(rel.paid_on)}`,
    ]);
  if (expected) items.push(["Pay by", dayMonthYear(e.due_on)]);
  else items.push(["Date paid", dayMonthYear(e.paid_on)]);
  if (!expected) {
    items.push(["Mode", modeLabel(e.mode)]);
    items.push(["UTR", e.ref_last4 ? `Ending ${e.ref_last4}` : "—"]);
  }
  items.push([
    "Recorded by",
    `${by?.full_name || by?.email || "System"}, ${formatDateTime(e.created_at)}`,
  ]);

  const footer = voided ? (
    <>
      <span className="text-xs text-fg-3 max-md:hidden">
        Voided entries are left out of every total.
      </span>
      <span className="flex-1 max-md:hidden" />
      <ActionButton action={restoreEntry.bind(null, e.id)} variant="secondary">
        <RotateCcw aria-hidden />
        Restore
      </ActionButton>
    </>
  ) : voidMode ? (
    <>
      <ButtonLink variant="ghost" href={selfHref} scroll={false}>
        Cancel
      </ButtonLink>
      <span className="flex-1 max-md:hidden" />
      <SubmitButton form="f-void" variant="danger" pendingText="Voiding…">
        Void entry
      </SubmitButton>
    </>
  ) : (
    <>
      <ButtonLink
        variant="danger"
        href={hrefWith(PAYMENTS_PATH, params, {
          ...PANEL_PARAMS,
          open: e.id,
          void: 1,
        })}
        scroll={false}
      >
        <Trash2 aria-hidden />
        Void
      </ButtonLink>
      <span className="flex-1 max-md:hidden" />
      {expected ? (
        <ButtonLink variant="primary" href={payHref} scroll={false}>
          Record payment
        </ButtonLink>
      ) : (
        <ButtonLink variant="secondary" href={editHref} scroll={false}>
          <Pencil aria-hidden />
          Edit
        </ButtonLink>
      )}
    </>
  );

  return (
    <Drawer
      closeHref={closeHref}
      title={MONEY_CATEGORY_LABEL[e.category]}
      sub={
        voided
          ? "Voided"
          : expected
            ? `Not paid yet, due ${formatDay(e.due_on)}`
            : formatDate(e.paid_on)
      }
      lead={
        <span
          className={cn(
            "grid size-9 shrink-0 place-items-center rounded-full [&_svg]:size-4",
            inflow ? "bg-ok-soft text-ok" : "bg-bad-soft text-bad",
          )}
        >
          <DirIcon aria-label={inflow ? "Money in" : "Money out"} />
        </span>
      }
      icons={
        !voided && !expected && !voidMode ? (
          <IconLink href={editHref} label="Edit entry" scroll={false}>
            <Pencil aria-hidden />
          </IconLink>
        ) : null
      }
      footer={footer}
    >
      <div>
        <span
          className={cn(
            "text-[28px] leading-tight font-bold tabular-nums",
            voided ? "text-fg-3 line-through" : inflow && "text-ok",
          )}
        >
          {signed(e.direction, e.amount_inr)}
        </span>
        {expected ? (
          <Pill tone="warn" className="ml-2 align-middle">
            Unpaid
          </Pill>
        ) : null}
        {voided ? <Pill className="ml-2 align-middle">Voided</Pill> : null}
      </div>

      {voided ? (
        <Notice tone="warn" icon={<TriangleAlert aria-hidden />}>
          Voided {formatDateTime(e.voided_at)}. Reason: {e.void_reason ?? "—"}
        </Notice>
      ) : null}

      {voidMode && !voided ? (
        <ActionForm
          action={voidEntry}
          undo={restoreEntry}
          closeHref={closeHref}
          id="f-void"
        >
          <input type="hidden" name="id" value={e.id} />
          <Field
            label="Why void this entry?"
            htmlFor="pv-reason"
            required
            hint="The entry stays in the audit log and leaves every total."
          >
            <Textarea
              id="pv-reason"
              name="void_reason"
              maxLength={300}
              required
              autoFocus
              placeholder="e.g. Recorded twice"
            />
            <FieldError name="void_reason" />
          </Field>
        </ActionForm>
      ) : null}

      <DL items={items} />

      {!voided && !expected ? (
        <div className="flex flex-col gap-2">
          <span className="text-xs font-semibold text-fg-2">
            Screenshot on the office PC
          </span>
          {e.proof_saved ? (
            <Notice tone="success" icon={<Check aria-hidden />}>
              Saved in the student’s payments folder.
            </Notice>
          ) : (
            <Notice tone="error" icon={<TriangleAlert aria-hidden />}>
              Not saved yet. Save the screenshot with this name, then tick the
              box.
            </Notice>
          )}
          <div className="flex items-center gap-2 rounded-lg border border-line bg-surface-2 py-1 pr-1 pl-3">
            <code className="min-w-0 flex-1 text-xs break-all">{fileName}</code>
            <CopyButton text={fileName} label="Copy file name" small />
          </div>
          {folder ? (
            <div className="flex items-center gap-2 rounded-lg border border-line bg-surface-2 py-1 pr-1 pl-3">
              <code className="min-w-0 flex-1 text-xs break-all text-fg-2">
                {folder}
              </code>
              <CopyButton text={folder} label="Copy folder path" small />
            </div>
          ) : null}
          <ProofToggle id={e.id} saved={e.proof_saved} />
        </div>
      ) : null}
    </Drawer>
  );
}
