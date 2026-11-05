import type { ServiceOrder } from "./office-types";

/** Planning reference supplied for 2026; not a ledger entry or profit margin. */
export const COST_REFERENCE = Object.freeze({
  year: 2026,
  minimumWage: 1621,
  rent: 3242,
  electricity: 450,
  employeeSalary: 2500,
  water: 200,
  expectedVehicles: 17,
  stayPerVehicle: 20,
  fixedMonthly: 6392,
  forecastMonthly: 6732,
  suggestedLabor: 396,
} as const);

type MaterialCostSource = Pick<ServiceOrder, "materialRealCost" | "materialItems" | "materialCost">;

const nonNegative = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value) && value >= 0;
const cents = (value: number) => Math.round((value + Number.EPSILON) * 100);
const money = (value: number) => cents(value) / 100;

/** Null means unknown: a sale price is never evidence of the workshop's cost. */
export function getMaterialRealCost(order: MaterialCostSource): number | null {
  if (nonNegative(order.materialRealCost)) return money(order.materialRealCost);

  const items = order.materialItems;
  if (!Array.isArray(items)) return null;
  if (items.length === 0) return order.materialCost === 0 ? 0 : null;

  let total = 0;
  for (const item of items) {
    if (!item) return null;
    if (nonNegative(item.costSubtotal)) {
      total += item.costSubtotal;
    } else if (nonNegative(item.quantity) && item.quantity > 0 && nonNegative(item.unitCost)) {
      total += item.quantity * item.unitCost;
    } else {
      return null;
    }
    if (!Number.isFinite(total)) return null;
  }
  return money(total);
}

export interface CostReportRow {
  order: ServiceOrder;
  materialCost: number | null;
  fixedShare: number;
  stayCost: number;
  totalCost: number | null;
  revenue: number;
  result: number | null;
}

export interface PaidServiceCostReport {
  rows: CostReportRow[];
  missingPaymentDate: ServiceOrder[];
  partialPaymentsCount: number;
  fixedMonthly: number;
  stayTotal: number;
  knownMaterialCost: number;
  unknownMaterialCount: number;
  revenue: number;
  totalCost: number | null;
  result: number | null;
  unallocatedFixed: number;
}

function validPaymentDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(value + "T00:00:00Z");
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

/**
 * Read-only simulation: paid-at month, irrespective of delivery.
 * Fixed costs are split in whole cents, with the remainder assigned by stable id.
 * No purchases or ledger expenses are subtracted again.
 */
export function getPaidServiceCostReport(
  orders: readonly ServiceOrder[],
  month: string,
): PaidServiceCostReport {
  const validMonth = /^\d{4}-(0[1-9]|1[0-2])$/.test(month);
  const belongsToMonth = (order: ServiceOrder) =>
    validMonth && validPaymentDate(order.paidAt) && order.paidAt.slice(0, 7) === month;
  const missingPaymentDate = orders.filter(
    (order) => order.paymentStatus === "Pago" && !validPaymentDate(order.paidAt),
  );
  const eligible = orders
    .filter((order) => order.paymentStatus === "Pago" && belongsToMonth(order))
    .sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  const partialPaymentsCount = orders.filter(
    (order) => order.paymentStatus === "Pago parcial" && belongsToMonth(order),
  ).length;
  const fixedCents = cents(COST_REFERENCE.fixedMonthly);
  const baseShare = eligible.length ? Math.floor(fixedCents / eligible.length) : 0;
  const remainder = eligible.length ? fixedCents % eligible.length : 0;
  const stayCents = cents(COST_REFERENCE.stayPerVehicle);

  const rows: CostReportRow[] = eligible.map((order, index) => {
    const materialCost = getMaterialRealCost(order);
    const shareCents = baseShare + (index < remainder ? 1 : 0);
    const revenueCents = cents(
      (nonNegative(order.materialCost) ? order.materialCost : 0)
      + (nonNegative(order.laborCost) ? order.laborCost : 0),
    );
    const totalCents = materialCost === null ? null : cents(materialCost) + shareCents + stayCents;
    return {
      order,
      materialCost,
      fixedShare: shareCents / 100,
      stayCost: stayCents / 100,
      totalCost: totalCents === null ? null : totalCents / 100,
      revenue: revenueCents / 100,
      result: totalCents === null ? null : (revenueCents - totalCents) / 100,
    };
  });

  const knownMaterialCents = rows.reduce((sum, row) => sum + cents(row.materialCost ?? 0), 0);
  const revenueCents = rows.reduce((sum, row) => sum + cents(row.revenue), 0);
  const unknownMaterialCount = rows.filter((row) => row.materialCost === null).length;
  const stayTotalCents = stayCents * rows.length;
  const totalCents = rows.length && unknownMaterialCount === 0
    ? knownMaterialCents + fixedCents + stayTotalCents
    : null;

  return {
    rows,
    missingPaymentDate,
    partialPaymentsCount,
    fixedMonthly: COST_REFERENCE.fixedMonthly,
    stayTotal: stayTotalCents / 100,
    knownMaterialCost: knownMaterialCents / 100,
    unknownMaterialCount,
    revenue: revenueCents / 100,
    totalCost: totalCents === null ? null : totalCents / 100,
    result: totalCents === null ? null : (revenueCents - totalCents) / 100,
    unallocatedFixed: rows.length ? 0 : COST_REFERENCE.fixedMonthly,
  };
}

