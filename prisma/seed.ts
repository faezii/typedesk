import {
  PrismaClient,
  Prisma,
  type CustomerType,
  type ExpenseCategory,
  type FollowUpStatus,
  type FollowUpType,
  type PaymentMethod,
  type Priority,
  type QaStatus,
  type ServiceCategory,
  type ServiceUnit,
  type TaskStatus,
  type WorkOrderStatus,
} from "@prisma/client";
import bcrypt from "bcryptjs";
import { addDays, addHours, differenceInCalendarDays, format, startOfDay, startOfMonth, subDays, subMonths } from "date-fns";
import { mkdirSync, writeFileSync } from "node:fs";
import { WORK_ORDER_STATUS_LABEL } from "../lib/labels";
import { s3, s3Put } from "../lib/s3";
import path from "node:path";

const prisma = new PrismaClient();

// ───────────── deterministic randomness (stable demo data) ─────────────
let seed = 20260927;
function rand() {
  // mulberry32
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const int = (min: number, max: number) => Math.floor(rand() * (max - min + 1)) + min;
const pick = <T,>(arr: readonly T[]): T => arr[Math.floor(rand() * arr.length)]!;
const chance = (p: number) => rand() < p;
function weighted<T>(entries: [T, number][]): T {
  const total = entries.reduce((s, [, w]) => s + w, 0);
  let r = rand() * total;
  for (const [v, w] of entries) {
    if ((r -= w) <= 0) return v;
  }
  return entries[entries.length - 1]![0];
}
const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const dec = (n: number) => new Prisma.Decimal(round2(n).toFixed(2));

const VAT_RATE = 0.05;
const NOW = new Date();
const TODAY = startOfDay(NOW);
const SIX_MONTHS_AGO = startOfMonth(subMonths(NOW, 5));

function randomDateBetween(from: Date, to: Date) {
  const d = new Date(from.getTime() + rand() * (to.getTime() - from.getTime()));
  // business hours 8:30 – 20:00 Dubai (UTC+4) → 04:30 – 16:00 UTC
  d.setUTCHours(int(4, 15), int(0, 59), 0, 0);
  return d;
}

// ───────────── reference data ─────────────
const FIRST_NAMES = [
  "Mohammed", "Ahmed", "Fatima", "Aisha", "Omar", "Khalid", "Mariam", "Rashid", "Priya", "Rajesh",
  "Anil", "Sunita", "Maria", "Jose", "Olga", "Dmitri", "Chen", "Li", "Hassan", "Layla",
  "Youssef", "Noura", "Imran", "Sana", "Arjun", "Deepa", "Tariq", "Huda", "Samir", "Rania",
];
const LAST_NAMES = [
  "Al Mansoori", "Al Hashimi", "Al Suwaidi", "Khan", "Sharma", "Nair", "Menon", "Santos", "Reyes", "Ivanova",
  "Petrov", "Wei", "Haddad", "Farouk", "Qureshi", "Siddiqui", "Pillai", "Abdullah", "Mahmoud", "Nasser",
];
const NATIONALITIES = ["Emirati", "Indian", "Pakistani", "Filipino", "Egyptian", "Jordanian", "Russian", "Chinese", "Lebanese", "British", "Syrian", "Bangladeshi"];
const COMPANIES = [
  "Gulf Horizon Trading LLC", "Al Noor General Contracting LLC", "Desert Pearl Real Estate", "Emirates Bright Logistics FZE",
  "Blue Dhow Shipping LLC", "Al Barsha Medical Center", "Silver Palm Hospitality LLC", "Marina Tech Solutions FZ-LLC",
  "Oasis Food Industries LLC", "Jumeirah Legal Consultants", "Falcon Auto Spare Parts Trading", "Creek Textiles Trading LLC",
];

type ServiceSeed = { title: string; category: ServiceCategory; unit: ServiceUnit; price: number; description: string };
const SERVICES: ServiceSeed[] = [
  { title: "Legal Translation (Arabic ⇄ English)", category: "LEGAL_TRANSLATION", unit: "PAGE", price: 120, description: "MOJ-certified legal translation, stamped & signed" },
  { title: "Legal Translation (Other Languages)", category: "LEGAL_TRANSLATION", unit: "PAGE", price: 180, description: "Certified translation for French, Russian, Chinese, etc." },
  { title: "Court Judgment Translation", category: "LEGAL_TRANSLATION", unit: "PAGE", price: 150, description: "Judgments, verdicts and court memos" },
  { title: "General / Technical Translation", category: "GENERAL_TRANSLATION", unit: "WORD", price: 0.35, description: "Non-certified translation charged per word" },
  { title: "Catalogue & Website Translation", category: "GENERAL_TRANSLATION", unit: "WORD", price: 0.3, description: "Marketing and product content" },
  { title: "Arabic Typing (Govt. Applications)", category: "TYPING", unit: "DOCUMENT", price: 35, description: "Typing for immigration, labour & DED applications" },
  { title: "Tenancy / MOA Drafting & Typing", category: "TYPING", unit: "DOCUMENT", price: 150, description: "Tenancy contracts, MOA and agreements" },
  { title: "Legal Memo Typing", category: "TYPING", unit: "PAGE", price: 40, description: "Legal memoranda and letters" },
  { title: "MOFA Attestation", category: "ATTESTATION", unit: "DOCUMENT", price: 150, description: "Ministry of Foreign Affairs attestation handling (excl. govt. fees)" },
  { title: "Certificate Attestation (Embassy)", category: "ATTESTATION", unit: "DOCUMENT", price: 250, description: "Embassy & consulate attestation service" },
  { title: "Court Submission Service", category: "COURT_SUBMISSION", unit: "DOCUMENT", price: 300, description: "Filing & submission at Dubai Courts" },
  { title: "Notary Public Appointment Handling", category: "OTHER", unit: "HOUR", price: 200, description: "Accompany & process notarisation" },
];

const LANG_PAIRS: [string, string][] = [
  ["Arabic", "English"], ["English", "Arabic"], ["Arabic", "English"], ["English", "Arabic"],
  ["French", "Arabic"], ["Russian", "English"], ["Chinese", "English"], ["Urdu", "English"], ["Hindi", "English"], ["Persian", "Arabic"],
];

const DOC_TITLES: Record<ServiceCategory, string[]> = {
  LEGAL_TRANSLATION: ["Marriage Certificate", "Birth Certificate", "Degree Certificate", "Power of Attorney", "Police Clearance", "Commercial Contract", "Divorce Decree", "Medical Report"],
  GENERAL_TRANSLATION: ["Product Catalogue", "Company Profile", "Website Content", "Technical Manual", "Brochure"],
  TYPING: ["Visa Application", "Labour Contract", "Tenancy Contract", "Trade License Application", "Family Visa Application", "Legal Memo"],
  ATTESTATION: ["Degree Certificate", "Commercial Invoice", "Salary Certificate", "Birth Certificate"],
  COURT_SUBMISSION: ["Rental Dispute Filing", "Labour Case Memo", "Execution Request", "Appeal Submission"],
  OTHER: ["Notarised POA", "Board Resolution"],
};

function phone() {
  return `+971 ${pick(["50", "52", "54", "55", "56", "58"])} ${int(100, 999)} ${int(1000, 9999)}`;
}
function emiratesId(birthYear: number) {
  return `784-${birthYear}-${String(int(0, 9999999)).padStart(7, "0")}-${int(0, 9)}`;
}
function passportNo() {
  return `${String.fromCharCode(65 + int(0, 25))}${String.fromCharCode(65 + int(0, 25))}${int(1000000, 9999999)}`;
}
function slug(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, ".").replace(/^\.|\.$/g, "");
}
/** Expiry distribution: mostly valid, some within 30 days, some expired. */
function expiryDate() {
  return weighted<() => Date>([
    [() => addDays(TODAY, int(60, 900)), 70],
    [() => addDays(TODAY, int(1, 30)), 18],
    [() => subDays(TODAY, int(1, 120)), 12],
  ])();
}

const counters = new Map<string, number>();
function nextNo(prefix: "WO" | "INV" | "QT", date: Date) {
  const key = `${prefix}-${date.getFullYear()}`;
  const v = (counters.get(key) ?? 0) + 1;
  counters.set(key, v);
  return `${key}-${String(v).padStart(4, "0")}`;
}

async function reset() {
  // children first
  await prisma.activityLog.deleteMany();
  await prisma.followUp.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.invoiceItem.deleteMany();
  await prisma.invoice.deleteMany();
  await prisma.quotationItem.deleteMany();
  await prisma.quotation.deleteMany();
  await prisma.expense.deleteMany();
  await prisma.outsourcedWork.deleteMany();
  await prisma.document.deleteMany();
  await prisma.task.deleteMany();
  await prisma.workOrderRevision.deleteMany();
  await prisma.translationDetail.deleteMany();
  await prisma.workOrder.deleteMany();
  await prisma.vendor.deleteMany();
  await prisma.service.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.user.deleteMany();
  await prisma.setting.deleteMany();
  await prisma.counter.deleteMany();
}

async function main() {
  console.log("Resetting data…");
  await reset();

  // ───────────── Settings ─────────────
  await prisma.setting.createMany({
    data: [
      { key: "vatRate", value: "0.05" },
      { key: "companyName", value: "TypeDesk Legal Translation & Typing Center" },
      { key: "companyTrn", value: "100385926400003" },
      { key: "companyAddress", value: "Office 1204, Al Attar Business Tower, Sheikh Zayed Road, Dubai, UAE" },
      { key: "companyPhone", value: "+971 4 332 1180" },
      { key: "companyEmail", value: "info@typedesk.ae" },
      { key: "invoiceTerms", value: "Payment due within 15 days. Government fees are non-refundable. Bank: Emirates NBD · IBAN AE07 0260 0010 1532 7818 901" },
    ],
  });

  // ───────────── Users ─────────────
  console.log("Seeding users…");
  const passwordHash = await bcrypt.hash("Password123!", 10);
  const userSeeds = [
    { name: "Saeed Al Falasi", email: "admin@typedesk.ae", role: "ADMIN", department: "MANAGEMENT", phone: "+971 50 410 2201" },
    { name: "Reem Haddad", email: "manager@typedesk.ae", role: "MANAGER", department: "MANAGEMENT", phone: "+971 55 318 7742" },
    { name: "Vikram Iyer", email: "finance@typedesk.ae", role: "FINANCE", department: "FINANCE", phone: "+971 52 609 1134" },
    { name: "Joanna Dela Cruz", email: "typist@typedesk.ae", role: "STAFF", department: "TYPING", phone: "+971 56 227 9083" },
    { name: "Karim Mansour", email: "translator@typedesk.ae", role: "STAFF", department: "TRANSLATION", phone: "+971 54 771 3350" },
  ] as const;
  const users = await Promise.all(
    userSeeds.map((u) => prisma.user.create({ data: { ...u, passwordHash, lastLoginAt: subDays(NOW, int(0, 3)) } })),
  );
  const [admin, manager, finance, typist, translator] = users;
  const operators = [manager, typist, translator, translator, typist];

  // ───────────── Services ─────────────
  console.log("Seeding services…");
  const services: Awaited<ReturnType<typeof prisma.service.create>>[] = [];
  for (const s of SERVICES) {
    services.push(
      await prisma.service.create({
        data: { title: s.title, category: s.category, unit: s.unit, defaultPrice: dec(s.price), description: s.description },
      }),
    );
  }

  // ───────────── Customers ─────────────
  console.log("Seeding customers…");
  const customers = [];
  for (let i = 0; i < 40; i++) {
    const type: CustomerType = i < 12 ? "COMPANY" : "INDIVIDUAL";
    const first = pick(FIRST_NAMES);
    const last = pick(LAST_NAMES);
    const name = `${first} ${last}`;
    const nationality = pick(NATIONALITIES);
    const birthYear = int(1965, 2001);
    const hasEid = chance(0.85);
    const hasPassport = nationality !== "Emirati" || chance(0.5);
    const createdAt = randomDateBetween(subMonths(SIX_MONTHS_AGO, 6), subDays(NOW, 10));
    customers.push(
      await prisma.customer.create({
        data: {
          type,
          name: type === "COMPANY" ? `${name}` : name,
          companyName: type === "COMPANY" ? COMPANIES[i] : null,
          email: type === "COMPANY" ? `${slug(first)}@${slug(COMPANIES[i]!).split(".")[0]}.ae` : chance(0.7) ? `${slug(name)}${int(1, 99)}@gmail.com` : null,
          phone: phone(),
          nationality,
          emiratesId: hasEid ? emiratesId(birthYear) : null,
          emiratesIdExpiry: hasEid ? expiryDate() : null,
          passportNo: hasPassport ? passportNo() : null,
          passportExpiry: hasPassport ? expiryDate() : null,
          trn: type === "COMPANY" ? `100${int(100000000, 999999999)}003` : null,
          notes: chance(0.2) ? pick(["Prefers WhatsApp updates", "VIP — corporate account", "Collects documents in person", "Requires soft copy by email"]) : null,
          createdAt,
        },
      }),
    );
  }

  // ───────────── Vendors ─────────────
  console.log("Seeding vendors…");
  const vendorSeeds = [
    { name: "Elena Sokolova", type: "FREELANCER", languages: ["Russian", "English"] },
    { name: "Wang Mei", type: "FREELANCER", languages: ["Chinese", "English"] },
    { name: "Pierre Laurent", type: "FREELANCER", languages: ["French", "Arabic", "English"] },
    { name: "Farid Rahimi", type: "FREELANCER", languages: ["Persian", "Arabic"] },
    { name: "Nimra Aslam", type: "FREELANCER", languages: ["Urdu", "Hindi", "English"] },
    { name: "Lingua Bridge Translations LLC", type: "AGENCY", languages: ["Spanish", "German", "Italian", "Portuguese"] },
    { name: "Al Bayan Legal Translation", type: "AGENCY", languages: ["Arabic", "English"] },
    { name: "Swift Attestation Services", type: "AGENCY", languages: ["Arabic", "English"] },
  ] as const;
  const vendors = await Promise.all(
    vendorSeeds.map((v) =>
      prisma.vendor.create({
        data: {
          name: v.name,
          type: v.type,
          languages: [...v.languages],
          phone: phone(),
          email: `${slug(v.name).split(".").slice(0, 2).join(".")}@${v.type === "AGENCY" ? "agency.ae" : "gmail.com"}`,
        },
      }),
    ),
  );

  // ───────────── Work orders ─────────────
  console.log("Seeding work orders…");
  type WO = Awaited<ReturnType<typeof prisma.workOrder.create>> & { service: (typeof services)[number] };
  const workOrders: WO[] = [];
  const activity: Prisma.ActivityLogCreateManyInput[] = [];
  const flow: WorkOrderStatus[] = ["RECEIVED", "IN_PROGRESS", "QUALITY_CHECK", "READY", "DELIVERED"];

  // create in chronological order so order numbers ascend with time
  const createdDates = Array.from({ length: 80 }, (_, i) =>
    i < 60 ? randomDateBetween(SIX_MONTHS_AGO, subDays(NOW, 10)) : randomDateBetween(subDays(NOW, 10), NOW),
  ).sort((a, b) => a.getTime() - b.getTime());

  for (let i = 0; i < 80; i++) {
    const createdAt = createdDates[i]!;
    const ageDays = differenceInCalendarDays(NOW, createdAt);
    const isTranslation = i % 2 === 0; // ~50% translations
    const service = isTranslation
      ? pick(services.filter((s) => s.category === "LEGAL_TRANSLATION" || s.category === "GENERAL_TRANSLATION"))
      : pick(services.filter((s) => s.category !== "LEGAL_TRANSLATION" && s.category !== "GENERAL_TRANSLATION"));

    // older orders are mostly delivered; recent ones spread across the pipeline
    let status: WorkOrderStatus;
    if (ageDays > 21) status = weighted([["DELIVERED", 92], ["READY", 5], ["QUALITY_CHECK", 3]]);
    else if (ageDays > 5) status = weighted([["DELIVERED", 40], ["READY", 20], ["QUALITY_CHECK", 15], ["IN_PROGRESS", 25]]);
    else status = weighted([["RECEIVED", 30], ["IN_PROGRESS", 35], ["QUALITY_CHECK", 15], ["READY", 12], ["DELIVERED", 8]]);

    const priority: Priority = weighted([["NORMAL", 65], ["HIGH", 25], ["URGENT", 10]]);
    const turnaround = priority === "URGENT" ? int(0, 1) : priority === "HIGH" ? int(1, 3) : int(2, 7);
    const deadline = addHours(startOfDay(addDays(createdAt, turnaround)), 17);

    // quantity per unit
    let quantity: number;
    let pageCount = 0;
    let wordCount = 0;
    if (service.unit === "PAGE") {
      pageCount = int(1, 18);
      wordCount = pageCount * int(230, 320);
      quantity = pageCount;
    } else if (service.unit === "WORD") {
      wordCount = int(800, 12000);
      pageCount = Math.max(1, Math.round(wordCount / 275));
      quantity = wordCount;
    } else if (service.unit === "HOUR") quantity = int(1, 3);
    else quantity = int(1, 4);

    const unitPrice = Number(service.defaultPrice);
    const total = round2(quantity * unitPrice);
    const deliveredAt =
      status === "DELIVERED"
        ? (() => {
            const late = chance(0.15);
            const d = late ? addHours(deadline, int(4, 40)) : addHours(createdAt, int(3, Math.max(4, turnaround * 24)));
            return d > NOW ? subDays(NOW, 0) : d;
          })()
        : null;

    const assignee = isTranslation ? pick([translator, translator, manager]) : pick([typist, typist, manager]);
    const docTitle = pick(DOC_TITLES[service.category]);
    const orderNo = nextNo("WO", createdAt);

    const [sourceLang, targetLang] = pick(LANG_PAIRS);
    const openRevision = status === "DELIVERED" && chance(0.08);
    const pastRevision = status === "DELIVERED" && !openRevision && chance(0.1);

    const wo = await prisma.workOrder.create({
      data: {
        orderNo,
        customerId: pick(customers).id,
        serviceId: service.id,
        status,
        priority,
        quantity: dec(quantity),
        unitPrice: dec(unitPrice),
        totalAmount: dec(total),
        assignedToId: status === "RECEIVED" && chance(0.4) ? null : assignee.id,
        deadline,
        deliveredAt,
        hasOpenRevision: openRevision,
        notes: `${docTitle}${chance(0.3) ? ` — ${pick(["client needs 2 hard copies", "soft copy by email", "names as per passport", "urgent for visa appointment", "include translator stamp on every page"])}` : ""}`,
        createdAt,
        translation: isTranslation
          ? {
              create: {
                sourceLang,
                targetLang,
                pageCount,
                wordCount,
                isCertified: service.category === "LEGAL_TRANSLATION",
              },
            }
          : undefined,
      },
    });
    workOrders.push({ ...wo, service });

    // activity trail
    activity.push({ entityType: "WorkOrder", entityId: wo.id, action: "created", message: `Work order ${orderNo} received`, userId: pick([manager, typist]).id, createdAt });
    const reached = flow.indexOf(status);
    const endTime = deliveredAt ?? (ageDays > 0 ? subDays(NOW, int(0, Math.min(ageDays, 3))) : NOW);
    for (let s = 1; s <= reached; s++) {
      const at = new Date(createdAt.getTime() + ((endTime.getTime() - createdAt.getTime()) * s) / Math.max(reached, 1));
      activity.push({
        entityType: "WorkOrder",
        entityId: wo.id,
        action: "status_changed",
        message: `Status changed from ${WORK_ORDER_STATUS_LABEL[flow[s - 1]!]} to ${WORK_ORDER_STATUS_LABEL[flow[s]!]}`,
        userId: assignee.id,
        createdAt: at,
      });
    }

    if (openRevision || pastRevision) {
      const requestedAt = addHours(deliveredAt!, int(12, 96));
      const reqAt = requestedAt > NOW ? NOW : requestedAt;
      const reason = pick([
        "Client reports spelling of name differs from passport",
        "Date of birth format needs to match Emirates ID",
        "Missing translator stamp on page 3",
        "Client requested change of beneficiary name",
        "Court asked for updated case number on cover page",
      ]);
      await prisma.workOrderRevision.create({
        data: {
          workOrderId: wo.id,
          reason,
          requestedAt: reqAt,
          requestedById: manager.id,
          resolvedAt: pastRevision ? addHours(reqAt, int(2, 30)) : null,
          resolvedById: pastRevision ? assignee.id : null,
          resolution: pastRevision ? "Corrected and re-delivered to client" : null,
        },
      });
      activity.push({ entityType: "WorkOrder", entityId: wo.id, action: "revision_requested", message: `Revision requested: ${reason}`, userId: manager.id, createdAt: reqAt });
      if (pastRevision) {
        activity.push({ entityType: "WorkOrder", entityId: wo.id, action: "revision_resolved", message: "Revision resolved — corrected copy delivered", userId: assignee.id, createdAt: addHours(reqAt, 6) });
      }
    }
  }

  // ───────────── Tasks ─────────────
  console.log("Seeding tasks…");
  const TASK_TEMPLATES: Record<string, string[]> = {
    translation: ["Translate {doc}", "Proofread {doc} translation", "Format & stamp {doc}", "Terminology check for {doc}"],
    typing: ["Type {doc}", "Verify applicant details for {doc}", "Submit {doc} on portal"],
    general: ["Call client re: {doc}", "Collect originals for {doc}", "Scan and upload {doc}", "Arrange courier for {doc}"],
  };
  const tasks: Prisma.TaskCreateManyInput[] = [];
  const recentWOs = [...workOrders].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  for (let i = 0; i < 60; i++) {
    const wo = i < 48 ? recentWOs[i % 40]! : null;
    const kind = wo ? (wo.service.category.includes("TRANSLATION") ? "translation" : "typing") : "general";
    const doc = wo ? wo.notes!.split(" — ")[0]! : pick(["trade license renewal file", "office supplies order", "MOFA batch", "monthly courier reconciliation"]);
    const title = pick(TASK_TEMPLATES[chance(0.25) ? "general" : kind]!).replace("{doc}", `${doc}${wo ? ` (${wo.orderNo})` : ""}`);
    let status: TaskStatus;
    if (wo?.status === "DELIVERED") status = "DONE";
    else if (wo?.status === "RECEIVED") status = "TODO";
    else status = weighted([["TODO", 35], ["IN_PROGRESS", 40], ["DONE", 25]]);
    const created = wo?.createdAt ?? randomDateBetween(subDays(NOW, 20), NOW);
    const deadline = wo?.deadline ?? addDays(TODAY, int(-3, 10));
    tasks.push({
      title,
      description: chance(0.5) ? pick(["Check against original before handing over.", "Client will collect after 4 PM.", "Use approved glossary for legal terms.", "Coordinate with finance before release."]) : null,
      status,
      priority: wo?.priority ?? weighted<Priority>([["NORMAL", 70], ["HIGH", 20], ["URGENT", 10]]),
      deadline,
      completedAt: status === "DONE" ? (wo?.deliveredAt ?? addHours(created, int(2, 48))) : null,
      assignedToId: kind === "translation" ? pick([translator, translator, manager]).id : kind === "typing" ? pick([typist, typist, manager]).id : pick(operators).id,
      workOrderId: wo?.id ?? null,
      createdAt: created,
    });
  }
  await prisma.task.createMany({ data: tasks });

  // ───────────── Outsourced work ─────────────
  console.log("Seeding outsourced work…");
  const rareLangWOs = workOrders.filter((w) => w.service.category.includes("TRANSLATION"));
  const outsourcedJobs = [];
  for (let i = 0; i < 15; i++) {
    const wo = rareLangWOs[(i * 3 + 5) % rareLangWOs.length]!;
    const vendor = i % 5 === 4 ? vendors[7]! : pick(vendors.slice(0, 7));
    const cost = round2(Number(wo.totalAmount) * (0.35 + rand() * 0.25));
    const received = wo.status === "DELIVERED" || wo.status === "READY" || wo.status === "QUALITY_CHECK";
    const qaStatus: QaStatus = !received ? "PENDING" : weighted([["APPROVED", 80], ["REJECTED", 8], ["PENDING", 12]]);
    const paid = qaStatus === "APPROVED" && wo.status === "DELIVERED" && chance(0.75);
    const sentAt = addHours(wo.createdAt, int(1, 6));
    const dueAt = wo.deadline ? subDays(wo.deadline, 0) : addDays(sentAt, 3);
    const receivedAt = received ? (chance(0.8) ? subDays(dueAt, 0) : addHours(dueAt, int(3, 30))) : null;
    const job = await prisma.outsourcedWork.create({
      data: {
        workOrderId: wo.id,
        vendorId: vendor.id,
        description: `${vendor.type === "AGENCY" && vendor.name.includes("Attestation") ? "Attestation run for" : "Translation of"} ${wo.notes!.split(" — ")[0]} (${wo.orderNo})`,
        agreementCost: dec(cost),
        qaStatus,
        paymentStatus: paid ? "PAID" : "UNPAID",
        sentAt,
        dueAt,
        receivedAt: receivedAt && receivedAt > NOW ? NOW : receivedAt,
        createdAt: sentAt,
      },
    });
    outsourcedJobs.push(job);
    if (paid) {
      await prisma.expense.create({
        data: {
          category: "FREELANCER",
          amount: dec(cost),
          vatAmount: dec(vendor.type === "AGENCY" ? cost * VAT_RATE : 0),
          description: `Freelancer payment — ${vendor.name} (${wo.orderNo})`,
          date: addDays(receivedAt ?? sentAt, int(1, 5)) > NOW ? NOW : addDays(receivedAt ?? sentAt, int(1, 5)),
          vendorId: vendor.id,
          outsourcedWorkId: job.id,
        },
      });
    }
  }

  // ───────────── Quotations ─────────────
  console.log("Seeding quotations…");
  for (let i = 0; i < 10; i++) {
    const customer = customers[i % 12]!; // mostly corporate
    const issueDate = randomDateBetween(SIX_MONTHS_AGO, NOW);
    const itemCount = int(1, 3);
    const items = Array.from({ length: itemCount }, (_, k) => {
      const s = pick(services);
      const qty = s.unit === "WORD" ? int(2000, 15000) : int(1, 20);
      const price = Number(s.defaultPrice);
      return { serviceId: s.id, description: s.title, quantity: dec(qty), unitPrice: dec(price), lineTotal: dec(qty * price), sortOrder: k };
    });
    const subtotal = round2(items.reduce((s, it) => s + Number(it.lineTotal), 0));
    const vat = round2(subtotal * VAT_RATE);
    await prisma.quotation.create({
      data: {
        quoteNo: nextNo("QT", issueDate),
        customerId: customer.id,
        status: weighted([["SENT", 30], ["ACCEPTED", 20], ["REJECTED", 15], ["DRAFT", 15], ["CONVERTED", 20]]),
        subtotal: dec(subtotal),
        vatRate: new Prisma.Decimal("0.05"),
        vatAmount: dec(vat),
        totalAmount: dec(subtotal + vat),
        issueDate,
        validUntil: addDays(issueDate, 30),
        createdAt: issueDate,
        items: { create: items },
      },
    });
  }

  // ───────────── Invoices & payments ─────────────
  console.log("Seeding invoices & payments…");
  // Invoice delivered/ready work orders; leave the most recent deliveries un-invoiced (pending invoicing).
  const invoiceable = workOrders
    .filter((w) => w.status === "DELIVERED" || w.status === "READY")
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  const pendingInvoicing = new Set(invoiceable.slice(-6).map((w) => w.id));
  const toInvoice = invoiceable.filter((w) => !pendingInvoicing.has(w.id));

  type ItemSpec = { description: string; serviceId: string; workOrderId: string | null; quantity: Prisma.Decimal; unitPrice: Prisma.Decimal; lineTotal: Prisma.Decimal; sortOrder: number };
  type InvoiceSpec = { customerId: string; issueDate: Date; items: ItemSpec[] };
  const specs: InvoiceSpec[] = toInvoice.slice(-50).map((wo) => ({
    customerId: wo.customerId,
    issueDate: wo.deliveredAt ?? wo.createdAt,
    items: [
      {
        description: `${wo.service.title} — ${wo.notes!.split(" — ")[0]} (${wo.orderNo})`,
        serviceId: wo.serviceId,
        workOrderId: wo.id,
        quantity: wo.quantity,
        unitPrice: wo.unitPrice,
        lineTotal: wo.totalAmount,
        sortOrder: 0,
      },
    ],
  }));
  // Top up with walk-in counter sales (typing / attestation without a work order) to reach 50 invoices.
  const counterServices = services.filter((s) => s.category === "TYPING" || s.category === "ATTESTATION");
  while (specs.length < 50) {
    const lines = int(1, 3);
    specs.push({
      customerId: pick(customers).id,
      issueDate: randomDateBetween(SIX_MONTHS_AGO, NOW),
      items: Array.from({ length: lines }, (_, k) => {
        const s = pick(counterServices);
        const qty = int(1, 3);
        const price = Number(s.defaultPrice);
        return { description: `${s.title} — walk-in`, serviceId: s.id, workOrderId: null, quantity: dec(qty), unitPrice: dec(price), lineTotal: dec(qty * price), sortOrder: k };
      }),
    });
  }
  specs.sort((a, b) => a.issueDate.getTime() - b.issueDate.getTime());

  const methods: [PaymentMethod, number][] = [["CASH", 35], ["CARD", 30], ["BANK_TRANSFER", 20], ["ONLINE", 15]];
  let invoiceCount = 0;
  for (const spec of specs) {
    const first = { customerId: spec.customerId };
    const issueDate = spec.issueDate;
    const items = spec.items;
    const subtotal = round2(items.reduce((s, it) => s + Number(it.lineTotal), 0));
    const vat = round2(subtotal * VAT_RATE);
    const total = round2(subtotal + vat);
    const age = differenceInCalendarDays(NOW, issueDate);

    // older invoices are mostly paid
    const outcome = weighted<"PAID" | "PARTIAL" | "UNPAID">(
      age > 45 ? [["PAID", 75], ["PARTIAL", 15], ["UNPAID", 10]] : age > 14 ? [["PAID", 45], ["PARTIAL", 25], ["UNPAID", 30]] : [["PAID", 40], ["PARTIAL", 25], ["UNPAID", 35]],
    );
    const payments: Prisma.PaymentCreateWithoutInvoiceInput[] = [];
    let paid = 0;
    if (outcome === "PAID") {
      if (chance(0.3) && total > 200) {
        const adv = round2(total * 0.5);
        payments.push(paymentInput(adv, issueDate, 0));
        payments.push(paymentInput(round2(total - adv), issueDate, int(1, 10)));
      } else payments.push(paymentInput(total, issueDate, int(0, 7)));
      paid = total;
    } else if (outcome === "PARTIAL") {
      const adv = round2(total * pick([0.3, 0.4, 0.5, 0.6]));
      payments.push(paymentInput(adv, issueDate, 0));
      paid = adv;
    }

    function paymentInput(amount: number, base: Date, afterDays: number): Prisma.PaymentCreateWithoutInvoiceInput {
      const method = weighted(methods);
      const d = addHours(addDays(base, afterDays), int(0, 3));
      return {
        amount: dec(amount),
        method,
        reference:
          method === "CARD" ? `POS-${int(100000, 999999)}` : method === "BANK_TRANSFER" ? `ENBD-FT${int(10000000, 99999999)}` : method === "ONLINE" ? `PAYBY-${int(1000000, 9999999)}` : null,
        date: d > NOW ? NOW : d,
        customer: { connect: { id: first.customerId } },
        receivedBy: { connect: { id: pick([finance, finance, manager, typist]).id } },
      };
    }

    await prisma.invoice.create({
      data: {
        invoiceNo: nextNo("INV", issueDate),
        customerId: first.customerId,
        status: outcome,
        subtotal: dec(subtotal),
        vatRate: new Prisma.Decimal("0.05"),
        vatAmount: dec(vat),
        totalAmount: dec(total),
        amountPaid: dec(paid),
        issueDate,
        dueDate: addDays(issueDate, 15),
        createdAt: issueDate,
        items: { create: items },
        payments: { create: payments },
      },
    });
    invoiceCount++;
  }

  // ───────────── Expenses (6 months) ─────────────
  console.log("Seeding expenses…");
  const expenses: Prisma.ExpenseCreateManyInput[] = [];
  for (let m = 0; m < 6; m++) {
    const monthStart = startOfMonth(subMonths(NOW, 5 - m));
    const inMonth = (day: number) => {
      const d = addHours(addDays(monthStart, day - 1), 6);
      return d > NOW ? null : d;
    };
    const push = (category: ExpenseCategory, amount: number, description: string, day: number, vatable = true, vendorId?: string) => {
      const date = inMonth(day);
      if (!date) return;
      expenses.push({ category, amount: dec(amount), vatAmount: dec(vatable ? amount * VAT_RATE : 0), description, date, vendorId: vendorId ?? null });
    };
    push("RENT", 14500, "Office rent — Al Attar Business Tower (monthly instalment)", 1, false);
    push("UTILITY", 850 + int(0, 450), "DEWA electricity & water", 8);
    push("UTILITY", 699, "du Business internet & landlines", 10);
    push("SOFTWARE", 420, "Microsoft 365 Business (8 seats)", 3);
    push("SOFTWARE", 310, "SDL Trados / CAT tool subscription", 5);
    push("SALARY", 38500, "Staff salaries (WPS)", 28, false);
    push("SUPPLIES", 180 + int(0, 520), pick(["Printer toner & A4 paper", "Stamps, seals & envelopes", "Courier packaging"]), int(4, 25));
    if (chance(0.7)) push("SUPPLIES", 90 + int(0, 250), "Pantry & cleaning supplies", int(4, 25));
    if (chance(0.6)) push("OTHER", 150 + int(0, 900), pick(["Aramex courier charges", "Parking & RTA fines", "Printer maintenance", "Marketing — Google Ads"]), int(4, 25));
  }
  await prisma.expense.createMany({ data: expenses });

  // ───────────── Follow-ups (25) ─────────────
  console.log("Seeding follow-ups…");
  const followUps: Prisma.FollowUpCreateManyInput[] = [];
  // ID/passport expiries within ±45 days drive real follow-ups
  const expiring = customers.filter(
    (c) =>
      (c.passportExpiry && Math.abs(differenceInCalendarDays(c.passportExpiry, TODAY)) <= 45) ||
      (c.emiratesIdExpiry && Math.abs(differenceInCalendarDays(c.emiratesIdExpiry, TODAY)) <= 45),
  );
  for (const c of expiring.slice(0, 6)) {
    const isPassport = !!c.passportExpiry && Math.abs(differenceInCalendarDays(c.passportExpiry, TODAY)) <= 45;
    const expiry = isPassport ? c.passportExpiry! : c.emiratesIdExpiry!;
    const label = isPassport ? "Passport" : "Emirates ID";
    // Same shape as server/services/expiry-follow-ups.ts, so editing the customer updates this row.
    followUps.push({
      title: `${label} renewal — ${c.name}`,
      type: isPassport ? "PASSPORT_EXPIRY" : "EMIRATES_ID_EXPIRY",
      autoKey: `customer:${c.id}:${isPassport ? "passport" : "emiratesId"}`,
      status: "PENDING",
      deadline: subDays(expiry, 30),
      customerId: c.id,
      notes: `${label} expires on ${format(expiry, "d MMM yyyy")}`,
      assignedToId: typist.id,
    });
  }
  const unpaidInvoices = await prisma.invoice.findMany({ where: { status: { in: ["UNPAID", "PARTIAL"] } }, orderBy: { issueDate: "asc" }, take: 5 });
  for (const inv of unpaidInvoices) {
    followUps.push({
      title: `Payment reminder — ${inv.invoiceNo}`,
      type: "PAYMENT_REMINDER",
      autoKey: `invoice:${inv.id}:payment`, // matches server/services/payment-reminders.ts
      status: "PENDING",
      deadline: addDays(inv.dueDate!, 7),
      customerId: inv.customerId,
      invoiceId: inv.id,
      notes: `Outstanding AED ${(Number(inv.totalAmount) - Number(inv.amountPaid)).toFixed(2)}`,
      assignedToId: finance.id,
    });
  }
  const genericTitles: [FollowUpType, string][] = [
    ["TRADE_LICENSE_RENEWAL", "Trade license renewal — {company}"],
    ["TRADE_LICENSE_RENEWAL", "DED license amendment docs — {company}"],
    ["VISA_DEADLINE", "Residence visa stamping deadline — {name}"],
    ["VISA_DEADLINE", "Family visa application follow-up — {name}"],
    ["GENERAL", "Collect original certificates — {name}"],
    ["GENERAL", "Confirm court hearing date — {name}"],
  ];
  // explicit spread so every bucket (overdue / today / this week / later / done / snoozed) has data
  const plan: [number, FollowUpStatus][] = [
    [0, "PENDING"], [0, "PENDING"], [1, "PENDING"], [2, "PENDING"], [3, "PENDING"], [5, "PENDING"], [6, "PENDING"],
    [10, "PENDING"], [16, "PENDING"], [24, "PENDING"], [38, "PENDING"], [-3, "PENDING"],
    [-6, "DONE"], [-9, "DONE"], [12, "SNOOZED"],
  ];
  let planIdx = 0;
  while (followUps.length < 25) {
    const [type, tmpl] = pick(genericTitles);
    const c = type === "TRADE_LICENSE_RENEWAL" ? pick(customers.slice(0, 12)) : pick(customers);
    const [offset, status] = plan[planIdx++ % plan.length]!;
    followUps.push({
      title: tmpl.replace("{company}", c.companyName ?? c.name).replace("{name}", c.name),
      type,
      status,
      deadline: addHours(addDays(TODAY, offset), 12),
      customerId: c.id,
      assignedToId: pick([manager, typist, finance]).id,
    });
  }
  await prisma.followUp.createMany({ data: followUps.slice(0, 25) });

  // ───────────── Documents (sample PDFs, in the same store the app reads: disk or S3/R2) ─────────────
  console.log("Seeding documents…");
  const seedDir = path.resolve(process.env.UPLOAD_DIR ?? "./uploads", "seed");
  if (!s3) mkdirSync(seedDir, { recursive: true });
  const uploads: Promise<void>[] = [];
  const documents: Prisma.DocumentCreateManyInput[] = [];
  const addDoc = (d: Omit<Prisma.DocumentCreateManyInput, "fileUrl" | "mimeType" | "size" | "uploadedById">, lines: string[]) => {
    const file = `doc-${String(documents.length + 1).padStart(3, "0")}.pdf`;
    const bytes = samplePdf(lines);
    if (s3) uploads.push(s3Put(`seed/${file}`, bytes));
    else writeFileSync(path.join(seedDir, file), bytes);
    documents.push({ ...d, fileUrl: `/api/files/seed/${file}`, mimeType: "application/pdf", size: bytes.length, uploadedById: pick([typist, manager, translator]).id });
  };
  for (const c of customers.slice(0, 18)) {
    const createdAt = addDays(c.createdAt, int(0, 3));
    if (c.passportNo) {
      addDoc({ name: `Passport - ${c.name}`, category: "PASSPORT", customerId: c.id, expiryDate: c.passportExpiry, createdAt }, [
        "PASSPORT (SAMPLE SCAN)",
        `Name: ${c.name}`,
        `Passport no: ${c.passportNo}`,
        `Nationality: ${c.nationality ?? "-"}`,
        `Expiry: ${c.passportExpiry ? format(c.passportExpiry, "dd MMM yyyy") : "-"}`,
      ]);
    }
    if (c.emiratesId) {
      addDoc({ name: `Emirates ID - ${c.name}`, category: "EMIRATES_ID", customerId: c.id, expiryDate: c.emiratesIdExpiry, createdAt }, [
        "EMIRATES ID (SAMPLE SCAN)",
        `Name: ${c.name}`,
        `ID number: ${c.emiratesId}`,
        `Expiry: ${c.emiratesIdExpiry ? format(c.emiratesIdExpiry, "dd MMM yyyy") : "-"}`,
      ]);
    }
    if (c.type === "COMPANY") {
      addDoc(
        { name: `Trade License - ${c.companyName}`, category: "TRADE_LICENSE", customerId: c.id, expiryDate: addDays(TODAY, int(-20, 300)), createdAt },
        ["TRADE LICENSE (SAMPLE)", `Company: ${c.companyName}`, `License no: ${int(100000, 999999)}`, "Issued by: Dubai DET"],
      );
    }
  }
  for (const wo of workOrders.filter((w) => w.service.category === "LEGAL_TRANSLATION").slice(-8)) {
    const docTitle = wo.notes!.split(" — ")[0]!;
    addDoc(
      { name: `${docTitle} (source)`, category: docTitle.includes("Judgment") || docTitle.includes("Decree") ? "LEGAL_JUDGMENT" : "CERTIFICATE", customerId: wo.customerId, workOrderId: wo.id, createdAt: wo.createdAt },
      [docTitle.toUpperCase(), `Work order: ${wo.orderNo}`, "Source document received at counter", "Sample file for demonstration"],
    );
  }
  await Promise.all(uploads);
  await prisma.document.createMany({ data: documents });

  // ───────────── Activity log & counters ─────────────
  await prisma.activityLog.createMany({ data: activity });
  await prisma.counter.createMany({
    data: [...counters.entries()].map(([key, value]) => ({ key, year: Number(key.split("-")[1]), value })),
  });

  const summary = {
    users: users.length,
    customers: customers.length,
    services: services.length,
    vendors: vendors.length,
    workOrders: workOrders.length,
    tasks: tasks.length,
    followUps: Math.min(followUps.length, 25),
    quotations: 10,
    invoices: invoiceCount,
    payments: await prisma.payment.count(),
    expenses: await prisma.expense.count(),
    outsourced: outsourcedJobs.length,
    pendingInvoicing: pendingInvoicing.size,
    openRevisions: await prisma.workOrder.count({ where: { hasOpenRevision: true } }),
  };
  console.table(summary);
  console.log(`Logins: ${userSeeds.map((u) => `${u.email} (${u.role})`).join(", ")} — password: Password123!`);
  void admin;
}

/** Minimal one-page PDF with a few lines of Helvetica text (ASCII only). */
function samplePdf(lines: string[]) {
  const esc = (s: string) => s.replace(/[^\x20-\x7e]/g, "-").replace(/[\\()]/g, (m) => `\\${m}`);
  const content = [
    "BT",
    "/F1 18 Tf",
    "60 770 Td",
    `(${esc(lines[0]!)}) Tj`,
    "/F1 12 Tf",
    ...lines.slice(1).flatMap((l) => ["0 -26 Td", `(${esc(l)}) Tj`]),
    "ET",
  ].join("\n");
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = objects.map((o, i) => {
    const at = pdf.length;
    pdf += `${i + 1} 0 obj\n${o}\nendobj\n`;
    return at;
  });
  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("")}`;
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(pdf, "latin1");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
