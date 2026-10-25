import { LogoCard, SettingsForm } from "@/components/settings/settings-form";
import { PageHeader } from "@/components/shared/page-header";
import { requirePagePermission } from "@/lib/auth/session";
import { getSettings } from "@/lib/settings";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  await requirePagePermission("settings:manage");
  const s = await getSettings();

  return (
    <>
      <PageHeader title="Settings" description="Company details, VAT and invoice terms printed on every invoice and quotation." />
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <SettingsForm
          defaultValues={{
            companyName: s.companyName,
            companyTaxNo: s.companyTaxNo,
            companyPhone: s.companyPhone,
            companyEmail: s.companyEmail,
            companyAddress: s.companyAddress,
            vatPercent: s.vatRate.times(100).toString(),
            invoiceTerms: s.invoiceTerms,
          }}
        />
        <LogoCard url={s.companyLogo} />
      </div>
    </>
  );
}
