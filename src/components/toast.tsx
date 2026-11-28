"use client";

/**
 * Toasts (with Undo), the tooltip layer for [data-tip] / (i) buttons, and <ActionForm> –
 * the one way forms talk to server actions (docs/19 DB-8: Undo = reverse action, offered for 5 s).
 */
import * as React from "react";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { Copy, Mail, Phone } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ActionResult } from "@/server/result";
import { Button, IconButton } from "@/components/ui";
import { startNavProgress } from "@/components/nav-progress";

type ToastOpts = { tone?: "ok" | "error"; undo?: () => Promise<void> | void };
type ToastState = { id: number; message: string } & ToastOpts;

const ToastCtx = React.createContext<(message: string, opts?: ToastOpts) => void>(() => {});
export const useToast = () => React.useContext(ToastCtx);

export function Toaster({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = React.useState<ToastState | null>(null);
  const timer = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const show = React.useCallback((message: string, opts: ToastOpts = {}) => {
    clearTimeout(timer.current);
    setToast({ id: Date.now(), message, ...opts });
    timer.current = setTimeout(() => setToast(null), opts.undo ? 5000 : opts.tone === "error" ? 6000 : 3000);
  }, []);

  return (
    <ToastCtx.Provider value={show}>
      {children}
      <TooltipLayer />
      <div
        role="status"
        aria-live="polite"
        className={cn(
          "fixed bottom-[calc(20px+env(safe-area-inset-bottom))] left-1/2 z-[300] flex max-w-[calc(100%-32px)] -translate-x-1/2 items-center gap-3 rounded-[10px] py-2.5 pr-3 pl-4 text-sm font-semibold shadow-pop transition-all duration-200",
          toast ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-4 opacity-0",
          toast?.tone === "error" ? "bg-bad text-bg" : "bg-fg text-bg",
        )}
      >
        <span>{toast?.message}</span>
        {toast?.undo ? (
          <button
            type="button"
            className="-my-1.5 min-h-10 cursor-pointer rounded px-2 font-bold underline"
            onClick={async () => {
              const u = toast.undo;
              setToast(null);
              await u?.();
            }}
          >
            Undo
          </button>
        ) : null}
      </div>
    </ToastCtx.Provider>
  );
}

/** One tooltip element for every [data-tip]; (i) buttons also open on tap. */
function TooltipLayer() {
  const ref = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    const tip = ref.current;
    if (!tip) return;
    let current: HTMLElement | null = null;
    const show = (el: HTMLElement) => {
      current = el;
      tip.textContent = el.dataset.tip ?? "";
      tip.hidden = false;
      const r = el.getBoundingClientRect();
      const tw = tip.offsetWidth;
      const th = tip.offsetHeight;
      const x = Math.min(Math.max(12, r.left + r.width / 2 - tw / 2), window.innerWidth - tw - 12);
      let y = r.bottom + 8;
      if (y + th > window.innerHeight - 12) y = r.top - th - 8;
      tip.style.left = `${x}px`;
      tip.style.top = `${y}px`;
      requestAnimationFrame(() => tip.setAttribute("data-show", "true"));
    };
    const hide = () => {
      current = null;
      tip.removeAttribute("data-show");
      tip.hidden = true;
    };
    const canHover = window.matchMedia("(hover: hover)").matches;
    const over = (e: Event) => {
      const el = (e.target as HTMLElement).closest<HTMLElement>("[data-tip]");
      if (el && canHover) show(el);
    };
    const out = (e: Event) => {
      if ((e.target as HTMLElement).closest("[data-tip]")) hide();
    };
    const focus = (e: Event) => {
      const el = (e.target as HTMLElement).closest<HTMLElement>(".qf-info");
      if (el) show(el);
    };
    const click = (e: Event) => {
      const el = (e.target as HTMLElement).closest<HTMLElement>(".qf-info");
      if (el) {
        if (current === el && !tip.hidden) hide();
        else show(el);
      } else hide();
    };
    document.addEventListener("mouseover", over);
    document.addEventListener("mouseout", out);
    document.addEventListener("focusin", focus);
    document.addEventListener("focusout", out);
    document.addEventListener("click", click);
    window.addEventListener("scroll", hide, true);
    return () => {
      document.removeEventListener("mouseover", over);
      document.removeEventListener("mouseout", out);
      document.removeEventListener("focusin", focus);
      document.removeEventListener("focusout", out);
      document.removeEventListener("click", click);
      window.removeEventListener("scroll", hide, true);
    };
  }, []);
  return (
    <div
      ref={ref}
      hidden
      role="tooltip"
      className="qf-tip pointer-events-none fixed z-[200] max-w-[280px] rounded-lg bg-fg px-2.5 py-2 text-xs leading-snug text-bg shadow-pop"
    />
  );
}

const FieldErrors = React.createContext<Record<string, string> | undefined>(undefined);
/** Error text for one field inside an <ActionForm> (use next to the input). */
export function FieldError({ name }: { name: string }) {
  const errs = React.useContext(FieldErrors);
  const msg = errs?.[name];
  return msg ? <p className="text-xs text-bad">{msg}</p> : null;
}

/**
 * Wraps a server action. On success: toast (+ Undo when the action returns undoId and `undo` is given),
 * then go to `redirectTo` from the result, or `closeHref`. On failure: an error summary at the top.
 */
export function ActionForm({
  action,
  undo,
  closeHref,
  className,
  id,
  children,
}: {
  action: (prev: ActionResult, formData: FormData) => Promise<ActionResult>;
  undo?: (id: string) => Promise<ActionResult>;
  closeHref?: string;
  className?: string;
  id?: string;
  children: React.ReactNode;
}) {
  const toast = useToast();
  const router = useRouter();

  // Handle the result right when the action returns – not in an effect – because the page refresh
  // that follows a save can remount this form (loading boundary) and drop its state.
  const run = React.useCallback(
    async (prev: ActionResult, formData: FormData): Promise<ActionResult> => {
      const state = await action(prev, formData);
      if (!state) return state;
      if (state.ok) {
        const undoId = state.undoId;
        toast(state.message, {
          undo:
            undo && undoId
              ? async () => {
                  const r = await undo(undoId);
                  toast(r?.message ?? "Restored", { tone: r && !r.ok ? "error" : "ok" });
                  router.refresh();
                }
              : undefined,
        });
        if (state.redirectTo || closeHref) startNavProgress();
        if (state.redirectTo) router.push(state.redirectTo, { scroll: false });
        else if (closeHref) router.push(closeHref, { scroll: false });
      } else if (!state.fieldErrors) {
        toast(state.message, { tone: "error" });
      }
      return state;
    },
    [action, undo, closeHref, toast, router],
  );
  const [state, formAction, isPending] = useActionState(run, null);

  // Footer buttons outside the <form> (form="id") can't use useFormStatus – tell them here.
  React.useEffect(() => {
    if (id) window.dispatchEvent(new CustomEvent("qf-form-pending", { detail: { id, pending: isPending } }));
  }, [id, isPending]);

  return (
    <form action={formAction} className={className} id={id} noValidate>
      {state && !state.ok && state.fieldErrors ? (
        <div role="alert" className="mb-3 rounded-[10px] bg-bad-soft px-3 py-2.5 text-sm text-fg">
          <b className="block text-bad">{state.message}</b>
          <ul className="mt-1 list-disc pl-5">
            {Object.entries(state.fieldErrors).map(([k, v]) => (
              <li key={k}>{v}</li>
            ))}
          </ul>
        </div>
      ) : null}
      <FieldErrors.Provider value={state && !state.ok ? state.fieldErrors : undefined}>{children}</FieldErrors.Provider>
    </form>
  );
}

/** Submit button that shows progress while the action runs. Put it inside the form or link with form="id". */
export function SubmitButton({
  children,
  pendingText = "Saving…",
  variant = "primary",
  form,
  className,
}: {
  children: React.ReactNode;
  pendingText?: string;
  variant?: "primary" | "secondary" | "danger";
  form?: string;
  className?: string;
}) {
  const status = useFormStatus();
  const [external, setExternal] = React.useState(false);
  React.useEffect(() => {
    if (!form) return;
    const on = (e: Event) => {
      const d = (e as CustomEvent<{ id: string; pending: boolean }>).detail;
      if (d.id === form) setExternal(d.pending);
    };
    window.addEventListener("qf-form-pending", on);
    return () => window.removeEventListener("qf-form-pending", on);
  }, [form]);
  const pending = status.pending || external;
  return (
    <Button type="submit" variant={variant} form={form} disabled={pending} aria-busy={pending} className={className}>
      {pending ? pendingText : children}
    </Button>
  );
}

/** Copy text to the clipboard with a toast. Falls back to selecting nothing but telling the user. */
export function CopyButton({
  text,
  label = "Copy",
  outline,
  small,
  icon = "copy",
}: {
  text: string;
  label?: string;
  outline?: boolean;
  small?: boolean;
  icon?: "copy" | "phone" | "mail";
}) {
  const Icon = icon === "phone" ? Phone : icon === "mail" ? Mail : Copy;
  const toast = useToast();
  return (
    <IconButton
      label={label}
      outline={outline}
      className={small ? "size-11 md:size-[30px] [&_svg]:size-4" : undefined}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          toast(`Copied: ${text}`);
        } catch {
          toast("Copy was blocked. Select the text instead.", { tone: "error" });
        }
      }}
    >
      <Icon aria-hidden />
    </IconButton>
  );
}

/** Calls a server action directly (no form) – for one-click actions like "Mark lost" with Undo. */
export function ActionButton({
  action,
  undo,
  children,
  variant = "secondary",
  closeHref,
  className,
}: {
  action: () => Promise<ActionResult>;
  undo?: (id: string) => Promise<ActionResult>;
  children: React.ReactNode;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  closeHref?: string;
  className?: string;
}) {
  const toast = useToast();
  const router = useRouter();
  const [pending, start] = React.useTransition();
  return (
    <Button
      type="button"
      variant={variant}
      className={className}
      disabled={pending}
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
          if (r.redirectTo || closeHref) startNavProgress();
          if (r.redirectTo) router.push(r.redirectTo, { scroll: false });
          else if (closeHref) router.push(closeHref, { scroll: false });
          else router.refresh();
        })
      }
    >
      {children}
    </Button>
  );
}
