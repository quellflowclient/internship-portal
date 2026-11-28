import "server-only";
import { readdir } from "node:fs/promises";
import path from "node:path";

/** Canva PDFs in public/templates/ (read at request time; the folder ships with the deployment). */
export async function listTemplateFiles(): Promise<string[]> {
  try {
    const files = await readdir(path.join(process.cwd(), "public", "templates"));
    return files.filter((f) => /^[A-Za-z0-9._-]+\.pdf$/.test(f)).sort();
  } catch {
    return [];
  }
}
