import type { Customer, Product, ServiceOrder, Vehicle } from "./office-types";

export const SUMMARY_EXPENSE_PER_SERVICE = 390;
const valid = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v) && v >= 0;
const round = (v: number) => Math.round((v + Number.EPSILON) * 100) / 100;
const amount = (v: unknown) => valid(v) ? v : 0;
export const stockUnitCost = (p: Product) => [p.avgUnitCost, p.lastEffectiveUnitCost, p.lastUnitCost].find(valid) ?? null;
export interface ReportMaterial {
  id: string;
  name: string;
  unit: string;
  quantity: number;
  unitCost: number | null;
  source: "stock" | "manual" | "recorded";
}
export type ServiceMaterialSelections = Record<string, ReportMaterial[]>;

export function summaryReceived(order: ServiceOrder) {
  const total = amount(order.materialCost) + amount(order.laborCost);
  return round(order.paymentStatus === "Pago" ? total : order.paymentStatus === "Pago parcial" ? Math.min(total, amount(order.paidAmount)) : 0);
}
export function reportMaterialsFor(order: ServiceOrder, products: Product[], selections: ServiceMaterialSelections = {}): ReportMaterial[] | null {
  if (Object.prototype.hasOwnProperty.call(selections, order.id)) return selections[order.id];
  if (order.materialItems?.length) return order.materialItems.map((item, index) => {
    const product = products.find(p => p.id === item.productId);
    const historicalUnit = valid(item.costSubtotal) && item.quantity > 0 ? item.costSubtotal / item.quantity : valid(item.unitCost) ? item.unitCost : null;
    return { id: "recorded-" + index, name: item.productName, unit: product?.unit || "un",
      quantity: item.quantity, unitCost: historicalUnit ?? (product ? stockUnitCost(product) : null), source: "recorded" };
  });
  if (valid(order.materialRealCost) && order.materialRealCost > 0) return [{
    id: "recorded-total", name: "Materiais registrados na ordem (total)", unit: "total",
    quantity: 1, unitCost: order.materialRealCost, source: "recorded",
  }];
  return null;
}
export function reportMaterialTotal(items: ReportMaterial[] | null): number | null {
  if (items === null) return null;
  let total = 0;
  for (const item of items) {
    if (!item.name.trim() || !valid(item.quantity) || item.quantity <= 0 || !valid(item.unitCost)) return null;
    const subtotal = round(item.quantity * item.unitCost);
    if (!Number.isFinite(subtotal)) return null;
    total += subtotal;
  }
  return Number.isFinite(total) ? round(total) : null;
}
function paymentMonth(value?: string) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(value + "T12:00:00Z");
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0,10) === value ? value.slice(0,7) : null;
}
export function getWorkshopSummary(orders: ServiceOrder[], products: Product[], selections: ServiceMaterialSelections = {}, referenceMonth?: string) {
  const receivedOrders = orders.filter(o => summaryReceived(o) > 0);
  const missingPaymentDateCount = receivedOrders.filter(o => !paymentMonth(o.paidAt)).length;
  const rows = receivedOrders.filter(o => referenceMonth === undefined || paymentMonth(o.paidAt) === referenceMonth).map(order => {
    const received = summaryReceived(order);
    const quoted = round(amount(order.materialCost) + amount(order.laborCost));
    const items = reportMaterialsFor(order, products, selections);
    const material = reportMaterialTotal(items);
    return { order, received, quoted, remaining: round(Math.max(0, quoted - received)), items,
      expense: SUMMARY_EXPENSE_PER_SERVICE, material,
      result: material === null ? null : round(received - SUMMARY_EXPENSE_PER_SERVICE - material) };
  });
  const received = round(rows.reduce((s, r) => s + r.received, 0));
  const remaining = round(rows.reduce((s, r) => s + r.remaining, 0));
  const expenses = round(rows.length * SUMMARY_EXPENSE_PER_SERVICE);
  const knownMaterials = round(rows.reduce((s, r) => s + (r.material ?? 0), 0));
  const pendingMaterialCount = rows.filter(r => r.material === null).length;
  const materials = pendingMaterialCount ? null : knownMaterials;
  return { rows, received, remaining, expenses, materials, knownMaterials, pendingMaterialCount, missingPaymentDateCount,
    result: materials === null ? null : round(received - expenses - materials),
    partialCount: rows.filter(r => r.order.paymentStatus === "Pago parcial").length };
}
const escapeHtml = (v: unknown) => String(v ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
const money = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const date = (v?: string) => /^\d{4}-\d{2}-\d{2}$/.test(v || "") ? v!.split("-").reverse().join("/") : "Não informada";
const valueOrPending = (v: number | null) => v === null ? "Pendente" : money(v);

export function buildWorkshopSummaryHtml(orders: ServiceOrder[], products: Product[], customers: Customer[], vehicles: Vehicle[], selections: ServiceMaterialSelections = {}, referenceMonth?: string) {
  const report = getWorkshopSummary(orders, products, selections, referenceMonth);
  if (!report.rows.length) throw new Error("Não há serviços com valor recebido.");
  const rows = report.rows.map(row => {
    const customer = customers.find(c => c.id === row.order.customerId);
    const vehicle = vehicles.find(v => v.id === row.order.vehicleId);
    const details = row.items === null ? "Materiais não informados" : row.items.length === 0 ? "Sem materiais — confirmado para este relatório" : row.items.map(item => {
      const subtotal = reportMaterialTotal([item]);
      return `<div class="material">${escapeHtml(item.name)} ${item.source === "manual" ? "(avulso)" : ""}<small>${escapeHtml(item.quantity)} ${escapeHtml(item.unit)} × ${valueOrPending(item.unitCost)} = ${valueOrPending(subtotal)}</small></div>`;
    }).join("");
    return `<tr><td><b>${escapeHtml(customer?.name || "Cliente")}</b><small>${escapeHtml(vehicle ? vehicle.brand + " " + vehicle.model + " • " + vehicle.plate : "Veículo")}</small><small>${escapeHtml(row.order.serviceDescription)}</small></td><td>${escapeHtml(row.order.paymentStatus)}<small>${date(row.order.paidAt)}</small></td><td>${money(row.received)}</td><td>${money(row.expense)}</td><td class="materials">${details}<b>Total: ${valueOrPending(row.material)}</b></td><td class="${row.result !== null && row.result < 0 ? "negative" : ""}">${valueOrPending(row.result)}</td></tr>`;
  }).join("");
  const totalMaterials = money(report.knownMaterials) + (report.pendingMaterialCount ? " (parcial)" : "");
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Relatório interno da oficina</title><style>
*{box-sizing:border-box}body{font:12px Arial,sans-serif;color:#202020;margin:0;background:#eee}.page{max-width:1100px;margin:auto;background:white;padding:28px}header{border-bottom:3px solid #bb8a20;padding-bottom:16px;display:flex;justify-content:space-between;gap:20px}h1{margin:8px 0;font-size:23px}.badge{color:#806018;font-weight:bold;letter-spacing:1px}p{line-height:1.5}.cards{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin:20px 0}.card{padding:12px;border:1px solid #ccc;border-radius:6px;break-inside:avoid}.card span{display:block;color:#555}.card strong{display:block;font-size:19px;margin-top:8px}table{border-collapse:collapse;width:100%;margin-top:18px;font-size:11px}th,td{text-align:left;border-bottom:1px solid #ddd;padding:9px 7px;vertical-align:top}th{background:#eee}td{overflow-wrap:anywhere}td:not(:first-child):not(.materials){white-space:nowrap}.materials{min-width:180px;max-width:270px}.material{margin-bottom:8px}small{display:block;margin-top:4px;color:#666;white-space:normal}thead{display:table-header-group}.negative{color:#a32323}.note{border-left:3px solid #bb8a20;background:#faf7ec;padding:12px;margin:16px 0}footer{margin-top:20px;color:#666;font-size:10px}.actions{text-align:right;margin-bottom:14px}button{padding:10px 16px;cursor:pointer}@page{size:A4 landscape;margin:12mm}@media print{body{background:white}.page{max-width:none;padding:0}.actions{display:none}header{break-inside:avoid}}
</style></head><body><div class="page"><div class="actions"><button onclick="window.print()">Imprimir / Salvar PDF</button></div><header><div><span class="badge">FELIPE AUTO DESIGN • USO INTERNO</span><h1>Visão financeira da oficina</h1><div>Materiais individualizados por veículo / atendimento</div><div>${referenceMonth ? "Mês de referência: " + escapeHtml(referenceMonth.split("-").reverse().join("/")) : "Todo o histórico"}</div></div><div>Emitido em ${new Date().toLocaleDateString("pt-BR", {timeZone:"America/Sao_Paulo"})}<br>${report.rows.length} atendimento(s), incluindo ${report.partialCount} parcialmente pago(s)</div></header>
<div class="cards"><div class="card"><span>Total recebido</span><strong>${money(report.received)}</strong></div><div class="card"><span>Despesas • R$ 390 por atendimento</span><strong>${money(report.expenses)}</strong></div><div class="card"><span>Materiais informados</span><strong>${totalMaterials}</strong></div><div class="card"><span>Resultado estimado após custos</span><strong>${report.result === null ? "Incompleto" : money(report.result)}</strong></div><div class="card"><span>Saldo a receber destes serviços</span><strong>${money(report.remaining)}</strong></div><div class="card"><span>Atendimentos com materiais pendentes</span><strong>${report.pendingMaterialCount}</strong></div></div>
<div class="note"><b>Base dos cálculos</b><p>Cada veículo utiliza somente seus próprios materiais: quantidade × custo unitário. Materiais registrados na ordem são carregados como ponto de partida; produtos do estoque e materiais avulsos podem ser incluídos ou ajustados para esta impressão. Não há média multiplicada pelo número de carros.</p><p>Resultado = recebido − R$ 390 por atendimento − materiais daquele atendimento. Despesas integrais também se aplicam aos pagamentos parciais; saldo a receber não é receita recebida. Os custos deste relatório são estimativas gerenciais e não somam novamente despesas ou compras do fechamento.</p>${report.pendingMaterialCount ? `<p><b>Relatório incompleto:</b> ${report.pendingMaterialCount} atendimento(s) sem materiais informados ou com valores inválidos. O subtotal informado não representa todos os materiais; o resultado geral permanece incompleto.</p>` : ""}</div>
<table><thead><tr><th>Cliente / veículo / serviço</th><th>Pagamento / último registro</th><th>Recebido</th><th>Despesas</th><th>Materiais deste veículo</th><th>Resultado estimado</th></tr></thead><tbody>${rows}</tbody><tfoot><tr><th colspan="2">Total</th><th>${money(report.received)}</th><th>${money(report.expenses)}</th><th>${totalMaterials}</th><th>${report.result === null ? "Incompleto" : money(report.result)}</th></tr></tfoot></table><footer>${referenceMonth ? "Serviços com recebimento pela data do pagamento no mês selecionado. " + report.missingPaymentDateCount + " atendimento(s) sem data de pagamento válida excluído(s)." : "Todo o histórico dos serviços com recebimento."} Sem filtro de entrega e sem vendas da loja. Valores parciais acumulados por ordem; data do último registro. Rascunho local desta impressão, sem cadastrar produtos, alterar ordens ou movimentar estoque.</footer></div><script>window.onload=()=>setTimeout(()=>window.print(),300);</script></body></html>`;
}

