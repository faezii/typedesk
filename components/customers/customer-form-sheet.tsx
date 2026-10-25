"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { customerSchema, type CustomerData, type CustomerFormValues } from "@/lib/validation/customer";
import { saveCustomer } from "@/server/actions/customers";

const EMPTY: CustomerFormValues = {
  type: "INDIVIDUAL",
  name: "",
  companyName: "",
  phone: "",
  email: "",
  nationality: "",
  taxNo: "",
  nationalId: "",
  nationalIdExpiry: "",
  passportNo: "",
  passportExpiry: "",
  notes: "",
};

export function CustomerFormSheet({
  customerId,
  defaultValues,
  children,
}: {
  /** Omit to create a new customer. */
  customerId?: string;
  defaultValues?: CustomerFormValues;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const form = useForm<CustomerFormValues, unknown, CustomerData>({
    resolver: zodResolver(customerSchema),
    defaultValues: defaultValues ?? EMPTY,
  });
  const isCompany = useWatch({ control: form.control, name: "type" }) === "COMPANY";

  function onSubmit() {
    // Send the raw strings; the server re-validates and normalises with the same schema.
    const values = form.getValues();
    startTransition(async () => {
      const res = await saveCustomer(customerId ?? null, values);
      if (!res.ok) {
        for (const [field, message] of Object.entries(res.fieldErrors ?? {})) {
          form.setError(field as keyof CustomerFormValues, { message });
        }
        toast.error(res.error);
        return;
      }
      toast.success(customerId ? "Customer updated" : "Customer created");
      setOpen(false);
      if (customerId) router.refresh();
      else {
        form.reset(EMPTY);
        router.push(`/customers/${res.data.id}`);
      }
    });
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) form.reset(defaultValues ?? EMPTY);
      }}
    >
      <SheetTrigger asChild>{children}</SheetTrigger>
      <SheetContent className="w-full gap-0 sm:max-w-lg">
        <SheetHeader className="border-b">
          <SheetTitle>{customerId ? "Edit customer" : "New customer"}</SheetTitle>
          <SheetDescription>Phone numbers and QIDs are checked and formatted automatically.</SheetDescription>
        </SheetHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex min-h-0 flex-1 flex-col" noValidate>
            <div className="flex-1 space-y-5 overflow-y-auto p-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Type</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="INDIVIDUAL">Individual</SelectItem>
                          <SelectItem value="COMPANY">Company</SelectItem>
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )}
                />
                <TextField form={form} name="name" label={isCompany ? "Contact name" : "Full name"} autoComplete="off" />
                {isCompany && <TextField form={form} name="companyName" label="Company name" className="sm:col-span-2" />}
                <TextField form={form} name="phone" label="Phone" placeholder="+974 5512 3456" inputMode="tel" />
                <TextField form={form} name="email" label="Email" type="email" placeholder="Optional" />
                <TextField form={form} name="nationality" label="Nationality" placeholder="Optional" />
                {isCompany && <TextField form={form} name="taxNo" label="CR / tax no." placeholder="e.g. CR 123456" />}
              </div>

              <fieldset className="space-y-4">
                <legend className="text-muted-foreground mb-3 text-xs font-medium tracking-wider uppercase">Identity documents</legend>
                <div className="grid gap-4 sm:grid-cols-2">
                  <TextField form={form} name="nationalId" label="QID" placeholder="11 digits" inputMode="numeric" />
                  <TextField form={form} name="nationalIdExpiry" label="QID expiry" type="date" />
                  <TextField form={form} name="passportNo" label="Passport no." placeholder="Optional" />
                  <TextField form={form} name="passportExpiry" label="Passport expiry" type="date" />
                </div>
                <FormDescription>A follow-up is scheduled automatically 30 days before each expiry date.</FormDescription>
              </fieldset>

              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes</FormLabel>
                    <FormControl>
                      <Textarea rows={3} placeholder="Preferences, instructions…" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <SheetFooter className="border-t sm:flex-row sm:justify-end">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={pending}>
                {pending && <Loader2 className="animate-spin" />}
                {customerId ? "Save changes" : "Create customer"}
              </Button>
            </SheetFooter>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  );
}

function TextField({
  form,
  name,
  label,
  className,
  ...input
}: {
  form: ReturnType<typeof useForm<CustomerFormValues, unknown, CustomerData>>;
  name: Exclude<keyof CustomerFormValues, "type">;
  label: string;
  className?: string;
} & Omit<React.ComponentProps<"input">, "name" | "form">) {
  return (
    <FormField
      control={form.control}
      name={name}
      render={({ field }) => (
        <FormItem className={className}>
          <FormLabel>{label}</FormLabel>
          <FormControl>
            <Input {...input} {...field} value={field.value ?? ""} />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
