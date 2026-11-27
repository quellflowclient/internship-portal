import * as React from "react";
import { CalendarDays, FileText, ShieldCheck } from "lucide-react";
import { Wordmark } from "@/components/ui";

const BENEFITS = [
  { icon: CalendarDays, text: "Your batch plan, sessions and tasks" },
  { icon: FileText, text: "Offer letter, terms and certificates" },
  { icon: ShieldCheck, text: "Certificates anyone can check by QR" },
];

/**
 * Frame for the sign-in screens (login, no access, password): a light brand panel on the left
 * from tablet width, the form on the right. Phones get one column with the wordmark on top.
 */
export function AuthFrame({ children }: { children: React.ReactNode }) {
  return (
    <main className="grid min-h-dvh grid-cols-1 bg-bg md:grid-cols-2">
      <aside className="hidden flex-col justify-between gap-8 border-r border-line bg-side p-11 md:flex">
        <Wordmark />
        <div className="flex flex-col gap-6">
          <h2 className="max-w-[16ch] text-[28px] leading-tight font-bold">Learn, build and get certified in one place.</h2>
          <ul className="flex flex-col gap-3.5 text-fg-2">
            {BENEFITS.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-start gap-2.5">
                <Icon className="mt-0.5 size-[18px] shrink-0 text-accent-ink" aria-hidden />
                {text}
              </li>
            ))}
          </ul>
        </div>
        <small className="text-xs text-fg-3">© {new Date().getFullYear()} Quellflow Technologies LLP</small>
      </aside>
      <div className="flex flex-col items-center justify-center px-5 py-8 md:px-8">
        <div className="flex w-full max-w-[380px] flex-col gap-5">
          <div className="md:hidden">
            <Wordmark />
          </div>
          {children}
        </div>
      </div>
    </main>
  );
}
