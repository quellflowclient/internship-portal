"use client";

/**
 * Signature image picker for Settings → Signatories: a PNG is read in the browser into a data URL
 * (kept inline in signatories.signature_data, no cloud storage) and posted in the hidden "signature" field.
 * "" keeps the current image, "remove" removes it.
 */
import * as React from "react";
import { Trash2, Upload } from "lucide-react";
import { Button, Label } from "@/components/ui";

/** The database caps signature_data at 400,000 characters; base64 adds a third, so files stay under 290 KB. */
const MAX_BYTES = 290 * 1024;

export function SignatureInput({ current }: { current: string | null }) {
  const [value, setValue] = React.useState("");
  const [error, setError] = React.useState("");
  const fileRef = React.useRef<HTMLInputElement>(null);
  const preview = value === "remove" ? null : value || current;

  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor="sig-file">Signature image</Label>
      <input type="hidden" name="signature" value={value} />
      {/* White on purpose, in both themes: it shows the signature as it prints on paper. */}
      <div className="grid h-24 place-items-center rounded-lg border border-dashed border-line-strong bg-white p-2">
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element -- inline data URL, nothing to optimise
          <img src={preview} alt="Signature preview" className="max-h-full max-w-full object-contain" />
        ) : (
          <span className="text-xs text-fg-3">No signature yet</span>
        )}
      </div>
      <input
        ref={fileRef}
        id="sig-file"
        type="file"
        accept="image/png"
        className="sr-only"
        onChange={(e) => {
          const file = e.currentTarget.files?.[0];
          setError("");
          if (!file) return;
          if (file.type !== "image/png") return setError("Use a PNG image (transparent background works best).");
          if (file.size > MAX_BYTES) return setError("The image is too large. Use a PNG under 290 KB.");
          const reader = new FileReader();
          reader.onload = () => setValue(String(reader.result ?? ""));
          reader.onerror = () => setError("The file could not be read. Try again.");
          reader.readAsDataURL(file);
        }}
      />
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="secondary" size="sm" onClick={() => fileRef.current?.click()}>
          <Upload aria-hidden />
          {preview ? "Replace image" : "Upload PNG"}
        </Button>
        {preview ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              setValue(current ? "remove" : "");
              if (fileRef.current) fileRef.current.value = "";
            }}
          >
            <Trash2 aria-hidden />
            Remove
          </Button>
        ) : null}
      </div>
      {error ? <p className="text-xs text-bad">{error}</p> : <p className="text-xs text-fg-3">Transparent PNG, under 290 KB. Printed above the signatory name.</p>}
    </div>
  );
}
