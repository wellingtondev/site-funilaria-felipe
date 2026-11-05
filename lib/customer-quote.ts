import type { Customer, ServiceOrder, Vehicle } from "./office-types";

const safe = (value: unknown) => String(value ?? "").replace(/[&<>"']/g, (character) => (
  { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[character] || character
));

const validAmount = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value) && value >= 0;

const money = (value: number) => (validAmount(value) ? value : 0)
  .toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const dateBR = (value?: string) => safe(value ? value.split("-").reverse().join("/") : "-");

/** Only customer-facing sale values are selected; never serialize the internal order. */
export function buildCustomerQuoteHtml(
  order: ServiceOrder,
  customer?: Customer,
  vehicle?: Vehicle,
): string {
  const materialAmount = validAmount(order.materialCost) ? order.materialCost : 0;
  const laborAmount = validAmount(order.laborCost) ? order.laborCost : 0;
  const total = materialAmount + laborAmount;
  const materialRows = (order.materialItems || []).map((item) => {
    const quantity = validAmount(item.quantity) ? item.quantity : 0;
    const subtotal = validAmount(item.subtotal) ? item.subtotal : 0;
    const unitSalePrice = validAmount(item.unitSalePrice)
      ? item.unitSalePrice
      : quantity > 0 ? subtotal / quantity : null;
    const unitPriceText = unitSalePrice !== null && Number.isFinite(unitSalePrice)
      ? money(unitSalePrice) : "Preço unitário não informado";
    return `<div class="material-line"><span>${safe(item.productName)} • ${quantity.toLocaleString("pt-BR")} × ${unitPriceText}</span><b>${money(subtotal)}</b></div>`;
  }).join("");

  return `
<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<title>Orçamento - ${safe(customer?.name || "Cliente")}</title>
<style>
  *{box-sizing:border-box}body{font-family:Arial,Helvetica,sans-serif;margin:0;background:#efefef;color:#151515}.page{width:210mm;min-height:297mm;margin:0 auto;background:white;padding:10mm 12mm;overflow-wrap:anywhere}.header{background:#090909;color:#fff;padding:12px 18px;border-bottom:4px solid #c99523}.brand{font-size:27px;font-weight:900;letter-spacing:7px}.brand-sub{color:#d7a52d;letter-spacing:6px;font-size:12px;margin-top:2px}.brand-service{font-size:10px;letter-spacing:3px;margin-top:4px}.title{display:flex;justify-content:space-between;align-items:end;margin:14px 0 10px;border-bottom:1px solid #ddd;padding-bottom:8px}.title h1{margin:0;font-size:24px}.grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:9px 0}.box{border:1px solid #ddd;border-radius:7px;padding:8px 10px}.box span{display:block;font-size:9px;color:#777;text-transform:uppercase;margin-bottom:3px}.box b{font-size:12px}.service{margin:10px 0;border:1px solid #ddd;border-radius:7px;padding:10px 12px}.service h3{margin:0 0 5px;color:#9b6c0d;font-size:14px}.service p{margin:4px 0;font-size:12px;white-space:pre-wrap}.material-line{display:flex;justify-content:space-between;gap:12px;font-size:12px;padding:4px 0;break-inside:avoid}.material-line b{white-space:nowrap}.values{width:100%;border-collapse:collapse;margin:8px 0;break-inside:avoid}.values td{padding:8px 10px;border-bottom:1px solid #ddd;font-size:12px}.values td:last-child{text-align:right;font-weight:700}.values .total td{font-size:16px;background:#f4e4bd;border:0}.payment{background:#111;color:#fff;border-left:4px solid #c99523;padding:8px 10px;margin:9px 0;font-size:10px;line-height:1.35;break-inside:avoid}.notes{border:1px solid #ddd;border-radius:7px;padding:9px 10px;min-height:48px;font-size:11px;white-space:pre-wrap}.footer{margin-top:12px;border-top:1px solid #ddd;padding-top:8px;text-align:center;font-size:9px;color:#555;line-height:1.35;break-inside:avoid}.signature{display:grid;grid-template-columns:1fr 1fr;gap:34px;margin-top:22px;text-align:center;font-size:10px;break-inside:avoid}.signature div{border-top:1px solid #333;padding-top:5px}@page{size:A4 portrait;margin:10mm}@media print{html,body{width:auto;height:auto;background:#fff}.page{margin:0;width:auto;min-height:0;height:auto;padding:0;overflow:visible}.header{padding:10px 16px}.title{margin:10px 0 8px}.grid{margin:7px 0;break-inside:avoid}.service{margin:7px 0;padding:8px 10px}.values{margin:6px 0}.values td{padding:6px 9px}.payment{margin:7px 0;padding:7px 9px}.notes{min-height:38px;padding:7px 9px}.signature{margin-top:22px}.footer{margin-top:8px;padding-top:6px}button{display:none}}
</style>
</head>
<body>
<div class="page">
  <header class="header"><div class="brand">FELIPE</div><div class="brand-sub">AUTO DESIGN</div><div class="brand-service">FUNILARIA • PINTURA • ESTÉTICA AUTOMOTIVA</div></header>
  <div class="title"><h1>ORÇAMENTO</h1><div><b>Data:</b> ${new Date().toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}</div></div>
  <div class="grid">
    <div class="box"><span>Cliente</span><b>${safe(customer?.name || "Cliente")}</b></div>
    <div class="box"><span>WhatsApp</span><b>${safe(customer?.phone || "-")}</b></div>
    <div class="box"><span>Veículo</span><b>${safe(vehicle ? `${vehicle.brand} ${vehicle.model}` : "-")}</b></div>
    <div class="box"><span>Placa</span><b>${safe(vehicle?.plate || "-")}</b></div>
  </div>
  <div class="service"><h3>Serviço proposto</h3><p>${safe(order.serviceDescription)}</p>${materialRows ? `<hr style="border:0;border-top:1px solid #ddd;margin:14px 0"/><h4 style="margin:0 0 8px">Materiais previstos</h4>${materialRows}` : ""}</div>
  <table class="values">
    <tr><td>Material</td><td>${money(materialAmount)}</td></tr>
    <tr><td>Mão de obra</td><td>${money(laborAmount)}</td></tr>
    <tr class="total"><td><b>VALOR TOTAL</b></td><td><b>${money(total)}</b></td></tr>
  </table>
  <div class="grid">
    <div class="box"><span>Data agendada</span><b>${dateBR(order.scheduledDate)}</b></div>
    <div class="box"><span>Estimativa de entrega</span><b>${dateBR(order.estimatedDelivery)}</b></div>
  </div>
  <div class="payment"><b>Condições de pagamento:</b><br/>Valores à vista via Pix ou dinheiro. Para pagamento parcelado, serão acrescentadas as taxas da maquininha.</div>
  <div class="notes"><b>Observações</b><br/><br/>${safe(order.notes || "Sem observações adicionais.")}</div>
  <div class="signature"><div>Assinatura do cliente</div><div>Felipe Auto Design</div></div>
  <footer class="footer"><b>Felipe Auto Design</b><br/>Avenida Alfredo de Faria, 87 - Tutunas - Uberaba/MG<br/>(34) 99154-3776 • @felipeautodesign • www.felipeautodesign.com.br</footer>
</div>
<script>window.onload=()=>setTimeout(()=>window.print(),300);</script>
</body>
</html>`;
}

