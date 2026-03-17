import type { OrderKind } from "@prisma/client";

export const ORDER_KIND = {
  ONLINE: "ONLINE" as OrderKind,
  MANUAL: "MANUAL" as OrderKind,
  INVITATION: "INVITATION" as OrderKind
} as const;

export function getOrderKindLabel(kind: OrderKind) {
  switch (kind) {
    case ORDER_KIND.INVITATION:
      return "Invitacion";
    case ORDER_KIND.MANUAL:
      return "Venta manual";
    case ORDER_KIND.ONLINE:
    default:
      return "Online";
  }
}

export function getOrderKindBadgeClass(kind: OrderKind) {
  switch (kind) {
    case ORDER_KIND.INVITATION:
      return "border-fuchsia-200 bg-fuchsia-50 text-fuchsia-700";
    case ORDER_KIND.MANUAL:
      return "border-cyan-200 bg-cyan-50 text-cyan-700";
    case ORDER_KIND.ONLINE:
    default:
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }
}

export function isCommercialOrderKind(kind: OrderKind) {
  return kind !== ORDER_KIND.INVITATION;
}
