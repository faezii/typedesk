import type {
  CustomerType,
  DocumentCategory,
  FollowUpStatus,
  FollowUpType,
  InvoiceStatus,
  PaymentMethod,
  Priority,
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
  EMIRATES_ID_EXPIRY: "Emirates ID expiry",
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

export const CUSTOMER_TYPE_LABEL: Record<CustomerType, string> = { INDIVIDUAL: "Individual", COMPANY: "Company" };

export const DOCUMENT_CATEGORY_LABEL: Record<DocumentCategory, string> = {
  PASSPORT: "Passport",
  EMIRATES_ID: "Emirates ID",
  TRADE_LICENSE: "Trade License",
  LEGAL_JUDGMENT: "Legal Judgment",
  CATALOGUE: "Catalogue",
  CERTIFICATE: "Certificate",
  OTHER: "Other",
};

/** Categories whose documents carry an expiry date. */
export const EXPIRING_CATEGORIES: DocumentCategory[] = ["PASSPORT", "EMIRATES_ID", "TRADE_LICENSE"];
