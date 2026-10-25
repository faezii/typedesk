import type {
  CustomerType,
  DocumentCategory,
  ExpenseCategory,
  FollowUpStatus,
  FollowUpType,
  InvoiceStatus,
  PaymentMethod,
  Priority,
  ServiceCategory,
  ServiceUnit,
  WorkOrderStatus,
} from "@prisma/client";

export const WORK_ORDER_STATUS_LABEL: Record<WorkOrderStatus, string> = {
  RECEIVED: "Received",
  IN_PROGRESS: "In Progress",
  QUALITY_CHECK: "Quality Check",
  READY: "Ready for Delivery",
  DELIVERED: "Delivered",
};

export const PRIORITY_LABEL: Record<Priority, string> = { NORMAL: "Normal", HIGH: "High", URGENT: "Urgent" };

export const FOLLOW_UP_TYPE_LABEL: Record<FollowUpType, string> = {
  PASSPORT_EXPIRY: "Passport expiry",
  NATIONAL_ID_EXPIRY: "QID expiry",
  VISA_DEADLINE: "Visa deadline",
  TRADE_LICENSE_RENEWAL: "Trade license renewal",
  PAYMENT_REMINDER: "Payment reminder",
  GENERAL: "General",
};

export const FOLLOW_UP_STATUS_LABEL: Record<FollowUpStatus, string> = { PENDING: "Pending", DONE: "Done", SNOOZED: "Snoozed" };

export const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = {
  CASH: "Cash",
  CARD: "Card",
  BANK_TRANSFER: "Bank transfer",
  ONLINE: "Online",
};

export const INVOICE_STATUS_LABEL: Record<InvoiceStatus, string> = {
  UNPAID: "Unpaid",
  PARTIAL: "Partial",
  PAID: "Paid",
  CANCELLED: "Cancelled",
};

export const EXPENSE_CATEGORY_LABEL: Record<ExpenseCategory, string> = {
  RENT: "Rent",
  UTILITY: "Utilities",
  SUPPLIES: "Supplies",
  SOFTWARE: "Software",
  FREELANCER: "Freelancer payments",
  SALARY: "Salaries",
  OTHER: "Other",
};

export const CUSTOMER_TYPE_LABEL: Record<CustomerType, string> = { INDIVIDUAL: "Individual", COMPANY: "Company" };

export const DOCUMENT_CATEGORY_LABEL: Record<DocumentCategory, string> = {
  PASSPORT: "Passport",
  NATIONAL_ID: "Qatar ID (QID)",
  TRADE_LICENSE: "Trade License",
  LEGAL_JUDGMENT: "Legal Judgment",
  CATALOGUE: "Catalogue",
  CERTIFICATE: "Certificate",
  OTHER: "Other",
};

export const SERVICE_CATEGORY_LABEL: Record<ServiceCategory, string> = {
  LEGAL_TRANSLATION: "Legal translation",
  GENERAL_TRANSLATION: "General translation",
  TYPING: "Typing",
  ATTESTATION: "Attestation",
  COURT_SUBMISSION: "Court submission",
  OTHER: "Other",
};

export const SERVICE_UNIT_LABEL: Record<ServiceUnit, string> = { PAGE: "page", WORD: "word", DOCUMENT: "document", HOUR: "hour" };

export const LANGUAGES = [
  "Arabic",
  "English",
  "French",
  "Russian",
  "Chinese",
  "Hindi",
  "Urdu",
  "Persian",
  "Spanish",
  "German",
  "Italian",
  "Portuguese",
  "Turkish",
  "Tagalog",
  "Bengali",
] as const;

/** Categories whose documents carry an expiry date. */
export const EXPIRING_CATEGORIES: DocumentCategory[] = ["PASSPORT", "NATIONAL_ID", "TRADE_LICENSE"];
