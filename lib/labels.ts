import type { FollowUpType, PaymentMethod, Priority, WorkOrderStatus } from "@prisma/client";

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
  VISA_DEADLINE: "Visa deadline",
  TRADE_LICENSE_RENEWAL: "Trade license renewal",
  PAYMENT_REMINDER: "Payment reminder",
  GENERAL: "General",
};

export const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = {
  CASH: "Cash",
  CARD: "Card",
  BANK_TRANSFER: "Bank transfer",
  ONLINE: "Online",
};
