import "server-only";
import path from "node:path";
import { Font } from "@react-pdf/renderer";

// Noto Sans Arabic (SIL OFL, see assets/fonts/OFL.txt) supplies the Arabic letters Helvetica lacks;
// react-pdf picks the font per character and lays Arabic out right-to-left.
// The files are read at runtime, so next.config.ts adds assets/fonts to the server bundle.
const file = (name: string) => path.join(process.cwd(), "assets", "fonts", name);
Font.register({
  family: "NotoSansArabic",
  fonts: [
    { src: file("NotoSansArabic-Regular.ttf"), fontWeight: 400 },
    { src: file("NotoSansArabic-Bold.ttf"), fontWeight: 700 },
  ],
});

// Wrap whole words only — no "Cen-ter" splits in names and descriptions.
Font.registerHyphenationCallback((word) => [word]);

/** Font stack for every PDF: Latin from Helvetica, Arabic from Noto. Use fontWeight 700 for bold. */
// shortcut: Helvetica covers Latin-1 only; Cyrillic, Chinese or symbols like ⇄ print wrong. Add a Noto font per script here if needed.
export const PDF_FONT = ["Helvetica", "NotoSansArabic"];

/** Noto's Arabic is 2.1 em tall (Helvetica text uses 1.4): extra line height for text containing Arabic, so lines don't overlap. */
export const arabicLine = (text: unknown) => (typeof text === "string" && /[؀-ۿݐ-ݿﭐ-﻿]/.test(text) ? { lineHeight: 2.1 } : {});
