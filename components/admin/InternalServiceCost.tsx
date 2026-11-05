import type { ServiceOrder } from "@/lib/office-types";
import { COST_REFERENCE, getMaterialRealCost } from "@/lib/service-costs";

type CostOrder = Pick<ServiceOrder, "materialRealCost" | "materialItems" | "materialCost" | "laborCost">;
const money = (value: number) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const round = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

export default function InternalServiceCost({ order }: { order: CostOrder }) {
  const materials = getMaterialRealCost(order);
  const operational = COST_REFERENCE.suggestedLabor;
  const total = materials === null ? null : round(materials + operational);
  const revenue = Number(order.materialCost || 0) + Number(order.laborCost || 0);
  const result = total === null ? null : round(revenue - total);
  return (
    <section className="internal-cost-panel" aria-label="Custos internos da oficina">
      <div className="internal-cost-heading"><div><span className="internal-cost-badge">SOMENTE OFICINA</span><h3>Custo deste serviço</h3></div><small>Não aparece no orçamento do cliente</small></div>
      <dl className="internal-cost-grid">
        <div><dt>Custo real dos materiais</dt><dd>{materials === null ? "Não informado" : money(materials)}</dd></div>
        <div><dt>Parcela operacional estimada</dt><dd>{money(operational)}</dd></div>
        <div><dt>Custo total estimado</dt><dd>{total === null ? "Indisponível" : money(total)}</dd></div>
        <div><dt>Resultado estimado</dt><dd className={result !== null && result < 0 ? "negative-value" : "positive-value"}>{result === null ? "Incompleto" : money(result)}</dd></div>
      </dl>
      <p>Base de {COST_REFERENCE.year}: {money(COST_REFERENCE.fixedMonthly)} fixos ÷ {COST_REFERENCE.expectedVehicles} atendimentos + {money(COST_REFERENCE.stayPerVehicle)} de permanência por veículo. Resultado = preço cobrado − custo estimado.</p>
      {materials === null && <p className="cost-warning">Custo histórico dos materiais não informado. O custo total e o resultado ficam indisponíveis até haver dados de custo.</p>}
    </section>
  );
}

