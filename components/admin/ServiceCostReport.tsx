"use client";

import { AdminInput } from "@/components/admin/ui/AdminFields";
import { Paper, TableContainer, Table, TableHead, TableRow, TableCell, TableBody, TableFooter } from "@mui/material";
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
      <Paper component="div" elevation={0} className="admin-card cost-report-header">
        <div><span className="internal-cost-badge">SOMENTE OFICINA</span><h2>Custos dos serviços pagos</h2><p>Serviços totalmente pagos pela data do pagamento, mesmo sem entrega. Cada ordem conta como um atendimento.</p></div>
        <div className="admin-field-group"><AdminInput label={<>Mês do pagamento</>} type="month" value={month} onChange={(event) => setMonth(event.target.value)} /></div>
      </Paper>
      <div className="cost-reference-layout">
        <Paper component="div" elevation={0} className="admin-card">
          <h3>Custos de referência · {COST_REFERENCE.year}</h3>
          <dl className="cost-reference-list">{fixedCosts.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{money(value)}</dd></div>)}<div className="cost-reference-total"><dt>Fixos mensais</dt><dd>{money(report.fixedMonthly)}</dd></div></dl>
          <p className="admin-muted">Aluguel calculado com salário mínimo de {money(COST_REFERENCE.minimumWage)}. Valores informados para planejamento, sem reajuste automático.</p>
        </Paper>
        <Paper component="div" elevation={0} className="admin-card cost-forecast">
          <span>BASE DE {COST_REFERENCE.expectedVehicles} ATENDIMENTOS / MÊS</span><strong>{money(COST_REFERENCE.suggestedLabor)}</strong><p>Referência de mão de obra por veículo, antes dos materiais e sem margem de lucro embutida.</p>
          <dl className="cost-reference-list"><div><dt>Permanência por veículo</dt><dd>{money(COST_REFERENCE.stayPerVehicle)}</dd></div><div><dt>Projeção mensal com 17 veículos</dt><dd>{money(COST_REFERENCE.forecastMonthly)}</dd></div></dl>
          <small>Inclui apenas os gastos informados. Não inclui encargos, tributos ou outras despesas não fornecidas.</small>
        </Paper>
      </div>
      <div className="admin-kpis cost-report-kpis">
        <Paper component="article" elevation={0}><span>Atendimentos totalmente pagos</span><strong>{report.rows.length}</strong><small>{report.partialPaymentsCount} pagamento(s) parcial(is) do mês excluído(s)</small></Paper>
        <Paper component="article" elevation={0}><span>Receita dos serviços selecionados</span><strong>{money(report.revenue)}</strong></Paper>
        <Paper component="article" elevation={0}><span>Materiais · custos conhecidos</span><strong>{money(report.knownMaterialCost)}</strong><small>{report.unknownMaterialCount} serviço(s) com custo ausente</small></Paper>
        <Paper component="article" elevation={0}><span>Permanência dos selecionados</span><strong>{money(report.stayTotal)}</strong></Paper>
        <Paper component="article" elevation={0}><span>Custo total estimado</span><strong>{report.totalCost === null ? "Indisponível" : money(report.totalCost)}</strong></Paper>
        <Paper component="article" elevation={0}><span>Resultado estimado</span><strong className={report.result !== null && report.result < 0 ? "negative-value" : "positive-value"}>{report.result === null ? "Incompleto" : money(report.result)}</strong></Paper>
      </div>
      <p className="cost-report-explanation">Simulação separada do fechamento: fixos ÷ atendimentos pagos + permanência + materiais consumidos. Não cria despesas nem desconta compras novamente. O rateio em centavos pode variar R$ 0,01 entre ordens para fechar o total.</p>
      {report.unknownMaterialCount > 0 && <p className="cost-warning" role="status">Custo histórico ausente em {report.unknownMaterialCount} serviço(s). Os materiais conhecidos continuam visíveis, mas o custo total e o resultado mensal ficam incompletos.</p>}
      {report.rows.length === 0 ? (
        <Paper component="div" elevation={0} className="admin-card cost-empty"><h3>Nenhum serviço totalmente pago neste mês</h3><p>Os {money(report.unallocatedFixed)} de custos fixos ficam sem rateio. Selecione outro mês ou confira os registros de pagamento.</p></Paper>
      ) : (
        <TableContainer className="admin-table-wrap"><Table className="admin-table cost-report-table"><caption>Rateio dos serviços totalmente pagos em {month.split("-").reverse().join("/")}</caption><TableHead><TableRow><TableCell component="th">Cliente / veículo</TableCell><TableCell component="th">Pagamento</TableCell><TableCell component="th">Receita</TableCell><TableCell component="th">Materiais reais</TableCell><TableCell component="th">Rateio fixo</TableCell><TableCell component="th">Permanência</TableCell><TableCell component="th">Custo estimado</TableCell><TableCell component="th">Resultado estimado</TableCell></TableRow></TableHead><TableBody>{report.rows.map((row) => <TableRow key={row.order.id}><TableCell><b>{customerName(row.order.customerId)}</b><small>{vehicleName(row.order.vehicleId)}</small><small>{row.order.serviceDescription}</small></TableCell><TableCell>{dateBR(row.order.paidAt)}</TableCell><TableCell>{money(row.revenue)}</TableCell><TableCell>{row.materialCost === null ? "Não informado" : money(row.materialCost)}</TableCell><TableCell>{money(row.fixedShare)}</TableCell><TableCell>{money(row.stayCost)}</TableCell><TableCell>{row.totalCost === null ? "Indisponível" : money(row.totalCost)}</TableCell><TableCell className={row.result !== null && row.result < 0 ? "negative-value" : "positive-value"}>{row.result === null ? "Incompleto" : money(row.result)}</TableCell></TableRow>)}</TableBody><TableFooter><TableRow><TableCell component="th" colSpan={2}>Total</TableCell><TableCell>{money(report.revenue)}</TableCell><TableCell>{money(report.knownMaterialCost)}{report.unknownMaterialCount > 0 && <small>Parcial: custos ausentes</small>}</TableCell><TableCell>{money(report.fixedMonthly)}</TableCell><TableCell>{money(report.stayTotal)}</TableCell><TableCell>{report.totalCost === null ? "Indisponível" : money(report.totalCost)}</TableCell><TableCell>{report.result === null ? "Incompleto" : money(report.result)}</TableCell></TableRow></TableFooter></Table></TableContainer>
      )}
      {report.missingPaymentDate.length > 0 && <aside className="admin-card cost-warning"><h3>Pagos sem data de pagamento válida</h3><p>{report.missingPaymentDate.length} ordem(ns) de qualquer período fora do rateio. A data de entrega não foi usada para presumir o mês.</p><ul>{report.missingPaymentDate.map((order) => <li key={order.id}><b>{customerName(order.customerId)}</b> — {vehicleName(order.vehicleId)} — {order.serviceDescription}</li>)}</ul></aside>}
    </section>
  );
}

