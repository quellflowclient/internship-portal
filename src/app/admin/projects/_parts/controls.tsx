"use client";

/** Small client controls for the project panel: icon buttons that call an action (with Undo) and the quick task status select. */
import * as React from "react";
import { useRouter } from "next/navigation";
import { ActionForm, useToast } from "@/components/toast";
import { IconButton } from "@/components/ui";
import type { ActionResult } from "@/server/result";
import { setTaskStatus } from "@/server/actions/projects";
import { TASK_STATUS, TASK_STATUSES, type TaskStatus } from "./shared";

/** Icon-only one-click action (remove member, delete task). `label` is the accessible name and the tooltip. */
export function IconAction({
  label,
  action,
  undo,
  children,
  className,
}: {
  label: string;
  action: () => Promise<ActionResult>;
  undo?: (id: string) => Promise<ActionResult>;
  children: React.ReactNode;
  className?: string;
}) {
  const toast = useToast();
  const router = useRouter();
  const [pending, start] = React.useTransition();
  return (
    <IconButton
      label={label}
      className={className}
      disabled={pending}
      aria-busy={pending}
      onClick={() =>
        start(async () => {
          const r = await action();
          if (!r) return;
          if (!r.ok) return toast(r.message, { tone: "error" });
          const undoId = r.undoId;
          toast(r.message, {
            undo:
              undo && undoId
                ? async () => {
                    const u = await undo(undoId);
                    toast(u?.message ?? "Restored", { tone: u && !u.ok ? "error" : "ok" });
                    router.refresh();
                  }
                : undefined,
          });
          router.refresh();
        })
      }
    >
      {children}
    </IconButton>
  );
}

/** Task status that saves on change. */
export function TaskStatusSelect({ id, status, title, disabled }: { id: string; status: TaskStatus; title: string; disabled?: boolean }) {
  return (
    <ActionForm action={setTaskStatus} key={status}>
      <input type="hidden" name="id" value={id} />
      <select
        name="status"
        aria-label={`Status of ${title}`}
        defaultValue={status}
        disabled={disabled}
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
        className="h-11 rounded-lg border border-line-strong bg-surface px-2 text-xs font-semibold text-fg md:h-8"
      >
        {TASK_STATUSES.map((s) => (
          <option key={s} value={s}>
            {TASK_STATUS[s].label}
          </option>
        ))}
      </select>
    </ActionForm>
  );
}
