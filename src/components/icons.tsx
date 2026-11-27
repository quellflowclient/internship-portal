import { cn } from "@/lib/utils";

/** WhatsApp glyph (simple-icons, CC0). Use with IconButton/IconAnchor and className="text-wa". */
export function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={cn("fill-current", className)} aria-hidden>
      <path d="M17.47 14.38c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.64.07-.3-.15-1.26-.46-2.4-1.48-.89-.79-1.49-1.77-1.66-2.07-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.61-.92-2.21-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.21 3.07c.15.2 2.1 3.2 5.08 4.49.71.31 1.26.49 1.69.63.71.23 1.36.2 1.87.12.57-.08 1.76-.72 2.01-1.41.25-.7.25-1.29.17-1.41-.07-.13-.27-.2-.57-.35zM12.05 21.5h-.01a9.4 9.4 0 0 1-4.8-1.31l-.34-.2-3.57.93.95-3.48-.22-.36a9.4 9.4 0 1 1 8 4.42zm8.04-17.4A11.33 11.33 0 0 0 12.04.75C5.8.75.73 5.82.73 12.06c0 2 .52 3.94 1.51 5.65L.64 23.25l5.68-1.49a11.3 11.3 0 0 0 5.4 1.38h.01c6.24 0 11.31-5.07 11.31-11.31 0-3.02-1.18-5.86-3.31-8z" />
    </svg>
  );
}

/** wa.me link for an Indian number in E.164 (+91…). */
export function waLink(phoneE164: string | null | undefined, text?: string): string | undefined {
  if (!phoneE164) return undefined;
  const digits = phoneE164.replace(/\D/g, "");
  return `https://wa.me/${digits}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
}
