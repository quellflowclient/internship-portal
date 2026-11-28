import type { DocStatus, DocType } from "@/lib/types";

/** The exact agreement text stored with every acceptance (docs/19 §8 P6 step 3). */
export const ACCEPT_CHECKBOX_TEXT = "I have read and agree to this document.";

export type MyDocument = {
  id: string;
  type: DocType;
  number: string | null;
  version: number;
  status: DocStatus;
  issued_at: string | null;
  revoked_at: string | null;
  data: Record<string, unknown> | null;
};

export type MyAcceptance = { document_id: string; typed_name: string; accepted_at: string };
