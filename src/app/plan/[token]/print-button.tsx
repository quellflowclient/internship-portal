"use client";

import * as React from "react";
import { Printer } from "lucide-react";
import { IconButton } from "@/components/ui";

/** Opens the browser's print dialog (students pick "Save as PDF" there). `auto` prints once on load. */
export function PrintButton({ auto }: { auto?: boolean }) {
  const printed = React.useRef(false);
  React.useEffect(() => {
    if (!auto || printed.current) return;
    printed.current = true;
    const t = setTimeout(() => window.print(), 400);
    return () => clearTimeout(t);
  }, [auto]);
  return (
    <IconButton label="Print or save as PDF" outline onClick={() => window.print()} className="print:hidden">
      <Printer aria-hidden />
    </IconButton>
  );
}
