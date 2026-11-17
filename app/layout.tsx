import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import localFont from "next/font/local";
import { I18nProvider } from "@/components/i18n";
import { ThemeProvider } from "@/components/theme-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { getLang } from "@/lib/i18n/server";
import { cn } from "@/lib/utils";
import "./globals.css";

const geist = Geist({ subsets: ["latin"], variable: "--font-geist" });
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-mono" });
// Arabic letters only (unicode-range), so English screens never download it.
const arabic = localFont({
  src: [
    { path: "../assets/fonts/NotoSansArabic-Regular.ttf", weight: "400" },
    { path: "../assets/fonts/NotoSansArabic-Bold.ttf", weight: "700" },
  ],
  variable: "--font-arabic",
  preload: false,
  declarations: [{ prop: "unicode-range", value: "U+0600-06FF, U+0750-077F, U+08A0-08FF, U+FB50-FDFF, U+FE70-FEFF" }],
});

export const metadata: Metadata = {
  title: { default: "TypeDesk", template: "%s · TypeDesk" },
  description: "Business management for translation & typing centers",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const lang = await getLang();
  const rtl = lang === "ar";
  return (
    <html lang={lang} dir={rtl ? "rtl" : "ltr"} className={cn("font-sans antialiased", geist.variable, geistMono.variable, arabic.variable)} suppressHydrationWarning>
      <body>
        <I18nProvider lang={lang}>
          <ThemeProvider>
            <TooltipProvider delayDuration={200}>{children}</TooltipProvider>
            <Toaster richColors position={rtl ? "top-left" : "top-right"} dir={rtl ? "rtl" : "ltr"} />
          </ThemeProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
