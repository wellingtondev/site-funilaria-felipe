"use client";

import { useMemo, useState } from "react";
import type { Customer, ServiceOrder, Vehicle } from "@/lib/office-types";
import { COST_REFERENCE, getPaidServiceCostReport } from "@/lib/service-costs";

interface Props { orders: ServiceOrder[]; customers: Customer[]; vehicles: Vehicle[]; initialMonth?: string; }
const money = (value: number) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const currentMonth = () => { const now = new Date(); return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`; };
const dateBR = (value?: string) => value ? value.split("-").reverse().join("/") : "Sem data";

export default function ServiceCostReport({ orders, customers, vehicles, initialMonth }: Props) {
  const [month, setMonth] = useState(initialMonth || currentMonth);
  const report = useMemo(() => getPaidServiceCostReport(orders, month), [orders, month]);
  const customerName = (id: string) => customers.find((customer) => customer.id === id)?.name || "Cliente não localizado";
  const vehicleName = (id: string) => { const vehicle = vehicles.find((item) => item.id === id); return vehicle ? `${vehicle.brand} ${vehicle.model} • ${vehicle.plate}` : "Veículo não localizado"; };
  const fixedCosts = [
    ["Aluguel · 2 salários mínimos", COST_REFERENCE.rent],
    ["Energia", COST_REFERENCE.electricity],
    ["Funcionário", COST_REFERENCE.employeeSalary],
    ["Água", COST_REFERENCE.water],
  ] as const;
  return (
    <section className="service-cost-report internal-only" aria-label="Relatório interno de custos">
      <div className="admin-card cost-report-header">
        <div><span className="internal-cost-badge">SOMENTE OFICINA</span><h2>Custos dos serviços pagos</h2><p>Serviços totalmente pagos pela data do pagamento, mesmo sem entrega. Cada ordem conta como um atendimento.</p></div>
        <label><span>Mês do pagamento</span><input type="month" value={month} onChange={(event) => setMonth(event.target.value)} /></label>
      </div>
      <div className="cost-reference-layout">
        <div className="admin-card">
          <h3>Custos de referência · {COST_REFERENCE.year}</h3>
          <dl className="cost-reference-list">{fixedCosts.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{money(value)}</dd></div>)}<div className="cost-reference-total"><dt>Fixos mensais</dt><dd>{money(report.fixedMonthly)}</dd></div></dl>
          <p className="admin-muted">Aluguel calculado com salário mínimo de {money(COST_REFERENCE.minimumWage)}. Valores informados para planejamento, sem reajuste automático.</p>
        </div>
        <div className="admin-card cost-forecast">
          <span>BASE DE {COST_REFERENCE.expectedVehicles} ATENDIMENTOS / MÊS</span><strong>{money(COST_REFERENCE.suggestedLabor)}</strong><p>Referência de mão de obra por veículo, antes dos materiais e sem margem de lucro embutida.</p>
          <dl className="cost-reference-list"><div><dt>Permanência por veículo</dt><dd>{money(COST_REFERENCE.stayPerVehicle)}</dd></div><div><dt>Projeção mensal com 17 veículos</dt><dd>{money(COST_REFERENCE.forecastMonthly)}</dd></div></dl>
          <small>Inclui apenas os gastos informados. Não inclui encargos, tributos ou outras despesas não fornecidas.</small>
        </div>
      </div>
      <div className="admin-kpis cost-report-kpis">
        <article><span>Atendimentos totalmente pagos</span><strong>{report.rows.length}</strong><small>{report.partialPaymentsCount} pagamento(s) parcial(is) do mês excluído(s)</small></article>
        <article><span>Receita dos serviços selecionados</span><strong>{money(report.revenue)}</strong></article>
        <article><span>Materiais · custos conhecidos</span><strong>{money(report.knownMaterialCost)}</strong><small>{report.unknownMaterialCount} serviço(s) com custo ausente</small></article>
        <article><span>Permanência dos selecionados</span><strong>{money(report.stayTotal)}</strong></article>
        <article><span>Custo total estimado</span><strong>{report.totalCost === null ? "Indisponível" : money(report.totalCost)}</strong></article>
        <article><span>Resultado estimado</span><strong className={report.result !== null && report.result < 0 ? "negative-value" : "positive-value"}>{report.result === null ? "Incompleto" : money(report.result)}</strong></article>
      </div>
      <p className="cost-report-explanation">Simulação separada do fechamento: fixos ÷ atendimentos pagos + permanência + materiais consumidos. Não cria despesas nem desconta compras novamente. O rateio em centavos pode variar R$ 0,01 entre ordens para fechar o total.</p>
      {report.unknownMaterialCount > 0 && <p className="cost-warning" role="status">Custo histórico ausente em {report.unknownMaterialCount} serviço(s). Os materiais conhecidos continuam visíveis, mas o custo total e o resultado mensal ficam incompletos.</p>}
      {report.rows.length === 0 ? (
        <div className="admin-card cost-empty"><h3>Nenhum serviço totalmente pago neste mês</h3><p>Os {money(report.unallocatedFixed)} de custos fixos ficam sem rateio. Selecione outro mês ou confira os registros de pagamento.</p></div>
      ) : (
        <div className="admin-table-wrap"><table className="admin-table cost-report-table"><caption>Rateio dos serviços totalmente pagos em {month.split("-").reverse().join("/")}</caption><thead><tr><th>Cliente / veículo</th><th>Pagamento</th><th>Receita</th><th>Materiais reais</th><th>Rateio fixo</th><th>Permanência</th><th>Custo estimado</th><th>Resultado estimado</th></tr></thead><tbody>{report.rows.map((row) => <tr key={row.order.id}><td><b>{customerName(row.order.customerId)}</b><small>{vehicleName(row.order.vehicleId)}</small><small>{row.order.serviceDescription}</small></td><td>{dateBR(row.order.paidAt)}</td><td>{money(row.revenue)}</td><td>{row.materialCost === null ? "Não informado" : money(row.materialCost)}</td><td>{money(row.fixedShare)}</td><td>{money(row.stayCost)}</td><td>{row.totalCost === null ? "Indisponível" : money(row.totalCost)}</td><td className={row.result !== null && row.result < 0 ? "negative-value" : "positive-value"}>{row.result === null ? "Incompleto" : money(row.result)}</td></tr>)}</tbody><tfoot><tr><th colSpan={2}>Total</th><td>{money(report.revenue)}</td><td>{money(report.knownMaterialCost)}{report.unknownMaterialCount > 0 && <small>Parcial: custos ausentes</small>}</td><td>{money(report.fixedMonthly)}</td><td>{money(report.stayTotal)}</td><td>{report.totalCost === null ? "Indisponível" : money(report.totalCost)}</td><td>{report.result === null ? "Incompleto" : money(report.result)}</td></tr></tfoot></table></div>
      )}
      {report.missingPaymentDate.length > 0 && <aside className="admin-card cost-warning"><h3>Pagos sem data de pagamento válida</h3><p>{report.missingPaymentDate.length} ordem(ns) de qualquer período fora do rateio. A data de entrega não foi usada para presumir o mês.</p><ul>{report.missingPaymentDate.map((order) => <li key={order.id}><b>{customerName(order.customerId)}</b> — {vehicleName(order.vehicleId)} — {order.serviceDescription}</li>)}</ul></aside>}
    </section>
  );
}

