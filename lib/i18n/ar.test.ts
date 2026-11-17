import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import * as labels from "../labels";
import { NAV_GROUPS } from "../nav";
import { AR } from "./ar";
import { translate } from "./translate";

const root = process.cwd();
function sourceFiles(dir: string): string[] {
  return fs.readdirSync(path.join(root, dir), { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return sourceFiles(p);
    return /\.tsx?$/.test(e.name) && !/\.test\.ts$|-pdf\.tsx$/.test(e.name) ? [p] : [];
  });
}

describe("Arabic dictionary", () => {
  it("has every t(\"…\") and <T>…</T> text used on screen", () => {
    const missing = new Set<string>();
    for (const file of [...sourceFiles("app"), ...sourceFiles("components"), ...sourceFiles("lib")]) {
      const src = fs.readFileSync(path.join(root, file), "utf8");
      for (const m of src.matchAll(/\bt\(\s*"((?:[^"\\]|\\.)*)"|getT\(\)\)\(\s*"((?:[^"\\]|\\.)*)"|<T>([^<{]+)<\/T>/g)) {
        const key = m[3]?.trim() ?? (JSON.parse(`"${m[1] ?? m[2]}"`) as string);
        if (/[A-Za-z]{2,}/.test(key) && !(key in AR) && key !== "TypeDesk") missing.add(`${key}  (${file})`);
      }
    }
    expect([...missing]).toEqual([]);
  });

  it("has every status / category label and menu name", () => {
    const values = Object.values(labels).flatMap((v) => (Array.isArray(v) ? v : typeof v === "object" && v ? Object.values(v) : [])).filter((v): v is string => typeof v === "string" && !/^[A-Z_]+$/.test(v)); // skip enum code lists
    const nav = NAV_GROUPS.flatMap((g) => [g.label, ...g.items.map((i) => i.title)]);
    expect([...values, ...nav].filter((v) => !(v in AR))).toEqual([]);
  });

  it("keeps the same {placeholders} in every translation", () => {
    const names = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(",");
    expect(Object.entries(AR).filter(([en, ar]) => names(en) !== names(ar))).toEqual([]);
  });
});

describe("translate", () => {
  it("English passes through, with placeholders filled", () => expect(translate("en", "Edit {name}", { name: "Aisha" })).toBe("Edit Aisha"));
  it("Arabic exact and with placeholders", () => {
    expect(translate("ar", "Customers")).toBe(AR["Customers"]);
    expect(translate("ar", "Edit {name}", { name: "Aisha" })).toBe(AR["Edit {name}"]!.replace("{name}", "Aisha"));
  });
  it("matches already-filled server messages to their template", () =>
    expect(translate("ar", "Joanna has work on record. Deactivate them instead so their history keeps their name.")).toContain("Joanna"));
  it("falls back to English for unknown text and data", () => {
    expect(translate("ar", "Al Sadd Medical Center")).toBe("Al Sadd Medical Center");
    expect(translate("ar", undefined)).toBe("");
  });
});
