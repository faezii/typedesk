"use client";

import { useRef, useTransition } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ImageIcon, Loader2, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import type { z } from "zod";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { settingsSchema, type SettingsFormValues } from "@/lib/validation/settings";
import { saveLogo, saveSettings } from "@/server/actions/settings";

const TEXT_FIELDS = [
  { name: "companyName", label: "Company name", span: true },
  { name: "companyTrn", label: "TRN", placeholder: "15 digits", inputMode: "numeric" },
  { name: "companyPhone", label: "Phone", placeholder: "+971 4 123 4567", inputMode: "tel" },
  { name: "companyEmail", label: "Email", placeholder: "info@example.ae", inputMode: "email", span: true },
] as const;

export function SettingsForm({ defaultValues }: { defaultValues: SettingsFormValues }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const form = useForm<SettingsFormValues, unknown, z.output<typeof settingsSchema>>({ resolver: zodResolver(settingsSchema), defaultValues });

  function onSubmit(data: z.output<typeof settingsSchema>) {
    startTransition(async () => {
      const res = await saveSettings(data);
      if (!res.ok) {
        for (const [field, message] of Object.entries(res.fieldErrors ?? {})) form.setError(field as keyof SettingsFormValues, { message });
        return void toast.error(res.error);
      }
      toast.success("Settings saved");
      form.reset(data); // show the normalised TRN / phone
      router.refresh();
    });
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="bg-card space-y-6 rounded-xl border p-5" noValidate>
        <section>
          <h2 className="font-medium">Company</h2>
          <p className="text-muted-foreground mt-0.5 mb-4 text-sm">Shown in the header of invoices, quotations and report PDFs.</p>
          <div className="grid gap-4 sm:grid-cols-2">
            {TEXT_FIELDS.map((f) => (
              <FormField
                key={f.name}
                control={form.control}
                name={f.name}
                render={({ field }) => (
                  <FormItem className={"span" in f ? "sm:col-span-2" : undefined}>
                    <FormLabel>{f.label}</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder={"placeholder" in f ? f.placeholder : undefined} inputMode={"inputMode" in f ? f.inputMode : undefined} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            ))}
            <FormField
              control={form.control}
              name="companyAddress"
              render={({ field }) => (
                <FormItem className="sm:col-span-2">
                  <FormLabel>Address</FormLabel>
                  <FormControl>
                    <Textarea rows={2} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </section>

        <section className="border-t pt-5">
          <h2 className="font-medium">VAT and invoicing</h2>
          <div className="mt-4 grid gap-4">
            <FormField
              control={form.control}
              name="vatPercent"
              render={({ field }) => (
                <FormItem className="max-w-48">
                  <FormLabel>VAT rate (%)</FormLabel>
                  <FormControl>
                    <Input inputMode="decimal" {...field} />
                  </FormControl>
                  <FormDescription>UAE standard rate is 5%. Applies to new invoices and quotes only.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="invoiceTerms"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Invoice terms</FormLabel>
                  <FormControl>
                    <Textarea rows={3} {...field} />
                  </FormControl>
                  <FormDescription>Printed at the bottom of every invoice and quotation, e.g. payment terms and bank details.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </section>

        <div className="flex justify-end border-t pt-5">
          <Button type="submit" disabled={pending}>
            {pending && <Loader2 className="animate-spin" />}
            Save settings
          </Button>
        </div>
      </form>
    </Form>
  );
}

export function LogoCard({ url }: { url: string }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();

  const submit = (file: File | null) =>
    startTransition(async () => {
      const fd = new FormData();
      if (file) fd.set("logo", file);
      const res = await saveLogo(fd);
      if (input.current) input.current.value = "";
      if (!res.ok) return void toast.error(res.error);
      toast.success(file ? "Logo updated" : "Logo removed");
      router.refresh();
    });

  return (
    <section className="bg-card rounded-xl border p-5">
      <h2 className="font-medium">Logo</h2>
      <p className="text-muted-foreground mt-0.5 mb-4 text-sm">PNG or JPG up to 1 MB, printed on invoices and quotations.</p>
      <div className="bg-muted/40 grid h-28 place-items-center rounded-lg border border-dashed p-3">
        {url ? (
          // unoptimized: the file route needs the signed-in user's cookies
          <Image src={url} alt="Company logo" width={240} height={96} unoptimized className="max-h-20 w-auto max-w-full object-contain" />
        ) : (
          <div className="text-muted-foreground flex flex-col items-center gap-1 text-sm">
            <ImageIcon className="size-5" />
            No logo yet
          </div>
        )}
      </div>
      <input ref={input} type="file" accept="image/png,image/jpeg" className="sr-only" aria-label="Choose logo file" onChange={(e) => e.target.files?.[0] && submit(e.target.files[0])} />
      <div className="mt-3 flex gap-2">
        <Button type="button" variant="outline" className="flex-1" disabled={pending} onClick={() => input.current?.click()}>
          {pending ? <Loader2 className="animate-spin" /> : <Upload />}
          {url ? "Replace" : "Upload logo"}
        </Button>
        {url && (
          <Button type="button" variant="ghost" size="icon" disabled={pending} onClick={() => submit(null)} aria-label="Remove logo">
            <Trash2 />
          </Button>
        )}
      </div>
    </section>
  );
}
