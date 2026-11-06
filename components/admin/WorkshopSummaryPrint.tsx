"use client";
import { useMemo, useState } from "react";
import { FileDown, Plus, Trash2 } from "lucide-react";
import type { Customer, Product, ServiceOrder, Vehicle } from "@/lib/office-types";
import { buildWorkshopSummaryHtml, getWorkshopSummary, reportMaterialTotal, stockUnitCost } from "@/lib/workshop-summary";
import type { ReportMaterial, ServiceMaterialSelections } from "@/lib/workshop-summary";
type Props = { orders: ServiceOrder[]; products: Product[]; customers: Customer[]; vehicles: Vehicle[]; initialMonth?: string };
const money = (v: number) => v.toLocaleString("pt-BR", {style:"currency",currency:"BRL"});
const emptyForm = { productId: "", name: "", unit: "un", quantity: "1", unitCost: "" };
export default function WorkshopSummaryPrint({orders, products, customers, vehicles, initialMonth}: Props) {
  const [month,setMonth] = useState(initialMonth ?? new Date().toLocaleDateString("sv-SE").slice(0,7));
  const [costDrafts,setCostDrafts] = useState<Record<string,string>>({});
  const [open,setOpen] = useState(false);
  const [selections,setSelections] = useState<ServiceMaterialSelections>({});
  const [selectedId,setSelectedId] = useState("");
  const [form,setForm] = useState(emptyForm);
  const [error,setError] = useState("");
  const report = useMemo(()=>getWorkshopSummary(orders,products,selections,month),[orders,products,selections,month]);
  const selected = report.rows.find(row=>row.order.id===selectedId) || report.rows[0];
  const customerName = (id:string) => customers.find(c=>c.id===id)?.name || "Cliente";
  const vehicleName = (id:string) => { const v=vehicles.find(v=>v.id===id); return v ? v.brand+" "+v.model+" • "+v.plate : "Veículo"; };
  function changeVehicle(id:string) { setSelectedId(id); setForm(emptyForm); setError(""); }
  function selectProduct(productId:string) {
    const p=products.find(p=>p.id===productId);
    setForm({...emptyForm,productId,name:p?.name || "",unit:p?.unit || "un",unitCost:p && stockUnitCost(p)!==null ? stockUnitCost(p)!.toFixed(2) : ""});
    setError("");
  }
  function setItems(items:ReportMaterial[]) {
    if(selected) setSelections(current=>({...current,[selected.order.id]:items}));
  }
  function add() {
    if(!selected) return;
    const quantity=Number(form.quantity.replace(",","."));
    const unitCost=form.unitCost.trim() ? Number(form.unitCost.replace(",",".")) : null;
    if(!form.name.trim() || !Number.isFinite(quantity) || quantity<=0 || unitCost===null || !Number.isFinite(unitCost) || unitCost<0 || !Number.isFinite(quantity*unitCost)) {
      setError("Informe o material, uma quantidade maior que zero e um custo unitário válido."); return;
    }
    const item:ReportMaterial={id:crypto.randomUUID(),name:form.name.trim(),unit:form.unit.trim() || "un",quantity,unitCost:Number(unitCost.toFixed(2)),source:form.productId ? "stock" : "manual"};
    setItems([...(selected.items || []),item]);setForm(emptyForm);setError("");
  }
  function updateItem(id:string,patch:Partial<ReportMaterial>) {
    if(selected) setItems((selected.items || []).map(item=>item.id===id ? {...item,...patch} : item));
  }
  function print() {
    setError("");
    try {
      const html=buildWorkshopSummaryHtml(orders,products,customers,vehicles,selections,month);
      const popup=window.open("","_blank","width=1200,height=850");
      if(!popup){setError("Libere os pop-ups do navegador para abrir a impressão.");return;}
      popup.document.open();popup.document.write(html);popup.document.close();
    }catch(e){setError(e instanceof Error ? e.message : "Não foi possível preparar o relatório.");}
  }
  return <div className="workshop-summary-print">
    <div className="summary-report-toolbar"><div><b>Visão financeira da oficina</b><p>Valores recebidos, despesas e materiais de cada veículo.</p></div><button type="button" className="admin-primary" onClick={()=>{setOpen(!open);setError("");}} aria-expanded={open}><FileDown size={17}/> Imprimir relatório</button></div>
    {open && <section className="admin-card summary-print-settings" aria-label="Preparar relatório da oficina">
      <h2>Materiais por veículo</h2>
      <label className="report-reference-month"><span>Mês de referência (data do pagamento)</span><input type="month" required value={month} onChange={e=>{setMonth(e.target.value);changeVehicle("");}}/></label>
      {report.missingPaymentDateCount>0 && <p className="cost-warning">{report.missingPaymentDateCount} atendimento(s) com recebimento sem data de pagamento válida foram excluídos do filtro mensal.</p>}
      <p className="admin-muted">Valores recebidos acumulados por ordem, agrupados pela data do último pagamento registrado.</p>
      <p className="admin-muted">{report.rows.length} atendimento(s) com recebimento, incluindo {report.partialCount} parcialmente pago(s). Despesas de <b>R$ 390,00 por atendimento</b>. Cada carro recebe somente os materiais que você informar para ele.</p>
      {selected ? <>
        <label><span>Selecione o veículo / serviço</span><select value={selected.order.id} onChange={e=>changeVehicle(e.target.value)}>{report.rows.map(row=><option key={row.order.id} value={row.order.id}>{vehicleName(row.order.vehicleId)} • {customerName(row.order.customerId)} • {row.order.serviceDescription.slice(0,45)} • {row.material===null ? "Materiais pendentes" : money(row.material)}</option>)}</select></label>
        <div className="report-vehicle-heading"><div><h3>{vehicleName(selected.order.vehicleId)}</h3><p>{customerName(selected.order.customerId)} — {selected.order.serviceDescription}</p></div><div><span>Recebido</span><b>{money(selected.received)}</b><span>Materiais deste veículo</span><b>{selected.material===null ? "Pendente" : money(selected.material)}</b></div></div>
        <div className="report-material-add">
          <h3>Adicionar material a este veículo</h3>
          <label><span>Material do estoque ou avulso</span><select value={form.productId} onChange={e=>selectProduct(e.target.value)}><option value="">Material avulso (não cadastrado)</option>{products.map(p=><option key={p.id} value={p.id}>{p.name} • {p.unit || "un"} • {stockUnitCost(p)===null ? "Custo não informado" : money(stockUnitCost(p)!)}</option>)}</select></label>
          <div className="report-material-fields"><label><span>Nome do material</span><input value={form.name} onChange={e=>setForm({...form,name:e.target.value})} placeholder="Ex.: fita, lixa, tinta"/></label><label><span>Unidade</span><input value={form.unit} onChange={e=>setForm({...form,unit:e.target.value})} placeholder="un, L, kg"/></label><label><span>Quantidade usada</span><input type="number" min="0.001" step="any" value={form.quantity} onChange={e=>setForm({...form,quantity:e.target.value})}/></label><label><span>Custo unitário (R$)</span><input type="number" min="0" step="0.01" value={form.unitCost} onBlur={()=>{if(form.unitCost.trim() && Number.isFinite(Number(form.unitCost)))setForm({...form,unitCost:Number(form.unitCost).toFixed(2)});}} onChange={e=>setForm({...form,unitCost:e.target.value})} placeholder="Custo da unidade"/></label></div>
          <button type="button" className="admin-secondary" onClick={add}><Plus size={16}/> Adicionar ao carro</button>
          <small>Produtos do estoque preenchem o custo de referência. Ajuste o consumo e o custo se necessário. Materiais avulsos ficam apenas neste relatório.</small>
        </div>
        {selected.items?.length ? <div className="admin-table-wrap"><table className="admin-table report-material-table"><thead><tr><th>Material</th><th>Quantidade</th><th>Custo unitário</th><th>Subtotal</th><th>Ação</th></tr></thead><tbody>{selected.items.map(item=><tr key={item.id}><td>{item.name}<small>{item.unit} • {item.source==="manual" ? "Avulso" : item.source==="stock" ? "Estoque" : "Registrado na ordem"}</small></td><td><input aria-label={"Quantidade de "+item.name} type="number" min="0.001" step="any" value={Number.isFinite(item.quantity) ? item.quantity : ""} onChange={e=>updateItem(item.id,{quantity:e.target.value==="" ? 0 : Number(e.target.value)})}/></td><td><input aria-label={"Custo de "+item.name} type="number" min="0" step="0.01" value={costDrafts[selected.order.id+":"+item.id] ?? (item.unitCost?.toFixed(2) ?? "")} onChange={e=>{setCostDrafts(current=>({...current,[selected.order.id+":"+item.id]:e.target.value}));updateItem(item.id,{unitCost:e.target.value==="" ? null : Number(Number(e.target.value).toFixed(2))});}} onBlur={()=>setCostDrafts(current=>{const copy={...current};delete copy[selected.order.id+":"+item.id];return copy;})}/></td><td>{reportMaterialTotal([item])===null ? "Valor inválido" : money(reportMaterialTotal([item])!)}</td><td><button type="button" className="danger-icon" aria-label={"Remover "+item.name} onClick={()=>setItems(selected.items!.filter(line=>line.id!==item.id))}><Trash2 size={16}/></button></td></tr>)}</tbody></table></div> : <p className={selected.items===null ? "cost-warning" : "admin-muted"}>{selected.items===null ? "Materiais ainda não informados para este atendimento. Adicione os itens ou confirme que não houve material." : "Sem materiais para este atendimento — confirmado neste relatório."}</p>}
        <div className="summary-print-actions report-material-actions"><button type="button" className="admin-secondary" onClick={()=>{if(!selected.items?.length || window.confirm("Remover os materiais deste atendimento do rascunho e confirmar custo zero?"))setItems([]);}}>Confirmar sem materiais</button><button type="button" className="admin-secondary" onClick={()=>{setSelections(current=>{const copy={...current};delete copy[selected.order.id];return copy;});setError("");}}>Recarregar materiais da ordem</button></div>
      </> : <p className="admin-muted">Nenhum serviço com valor recebido.</p>}
      <div className="admin-kpis summary-print-kpis"><article><span>Total recebido</span><strong>{money(report.received)}</strong></article><article><span>Despesas • R$ 390 por atendimento</span><strong>{money(report.expenses)}</strong></article><article><span>Materiais informados</span><strong>{money(report.knownMaterials)}</strong><small>{report.pendingMaterialCount ? "Subtotal parcial: "+report.pendingMaterialCount+" atendimento(s) pendente(s)" : "Soma dos materiais de cada carro"}</small></article><article><span>Resultado estimado</span><strong>{report.result===null ? "Incompleto" : money(report.result)}</strong></article></div>
      {report.pendingMaterialCount>0 && <p className="cost-warning">{report.pendingMaterialCount} atendimento(s) com materiais pendentes ou valores inválidos. Você pode imprimir, mas o relatório indicará o subtotal parcial e não apresentará um resultado geral como completo.</p>}
      <p className="admin-muted">Rascunho desta impressão: mantenha esta tela aberta enquanto preenche. Fechar e reabrir este bloco preserva os itens; recarregar a página ou sair da aba Resumo descarta os ajustes. Nenhum lançamento, cadastro ou saldo de estoque é alterado.</p>
      {error && <p className="admin-error" role="alert">{error}</p>}
      <div className="summary-print-actions"><button type="button" className="admin-primary" onClick={print} disabled={!report.rows.length}>Imprimir / Salvar PDF</button><button type="button" className="admin-secondary" onClick={()=>setOpen(false)}>Fechar</button></div>
    </section>}
  </div>;
}

