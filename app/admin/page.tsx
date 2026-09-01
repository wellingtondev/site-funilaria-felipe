"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { addDoc, collection, deleteDoc, doc, getDocs, orderBy, query, setDoc, updateDoc } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { CalendarDays, Car, ClipboardList, Copy, LogOut, Plus, RefreshCw, Users } from "lucide-react";
import { auth, db } from "@/lib/firebase";
import { Customer, SERVICE_STATUSES, ServiceOrder, ServiceStatus, Vehicle } from "@/lib/office-types";
import OfficeCalendar from "@/components/admin/OfficeCalendar";

type Tab = "resumo" | "clientes" | "veiculos" | "servicos" | "agenda";

const money = (value: number) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function AdminPage() {
  const router = useRouter();
  const [authorized, setAuthorized] = useState(false);
  const [tab, setTab] = useState<Tab>("resumo");
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [orders, setOrders] = useState<ServiceOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");

  const [clientForm, setClientForm] = useState({ name:"", phone:"", email:"", cpfCnpj:"" });
  const [vehicleForm, setVehicleForm] = useState({ customerId:"", plate:"", brand:"", model:"", year:"", color:"" });
  const [orderForm, setOrderForm] = useState({ customerId:"", vehicleId:"", serviceDescription:"", materialCost:"", laborCost:"", scheduledDate:"", estimatedDelivery:"", notes:"" });

  async function loadAll() {
    setLoading(true);
    try {
      const [cSnap, vSnap, oSnap] = await Promise.all([
        getDocs(query(collection(db,"customers"), orderBy("name"))),
        getDocs(query(collection(db,"vehicles"), orderBy("plate"))),
        getDocs(query(collection(db,"serviceOrders"), orderBy("scheduledDate","desc"))),
      ]);
      setCustomers(cSnap.docs.map(d => ({ id:d.id, ...d.data() } as Customer)));
      setVehicles(vSnap.docs.map(d => ({ id:d.id, ...d.data() } as Vehicle)));
      setOrders(oSnap.docs.map(d => ({ id:d.id, ...d.data() } as ServiceOrder)));
    } finally { setLoading(false); }
  }

  useEffect(() => onAuthStateChanged(auth, user => {
    if (!user) router.replace("/admin/login");
    else { setAuthorized(true); loadAll(); }
  }), [router]);

  const customerName = (id:string) => customers.find(c=>c.id===id)?.name || "Cliente";
  const vehicleName = (id:string) => { const v=vehicles.find(x=>x.id===id); return v ? `${v.brand} ${v.model} • ${v.plate}` : "Veículo"; };
  const filteredVehicles = useMemo(()=>vehicles.filter(v=>!orderForm.customerId || v.customerId===orderForm.customerId),[vehicles,orderForm.customerId]);
  const openOrders = orders.filter(o=>o.status!=="Entregue");
  const revenue = orders.reduce((sum,o)=>sum+Number(o.materialCost||0)+Number(o.laborCost||0),0);

  async function addCustomer(e:FormEvent){ e.preventDefault(); await addDoc(collection(db,"customers"), clientForm); setClientForm({name:"",phone:"",email:"",cpfCnpj:""}); setNotice("Cliente cadastrado com sucesso."); await loadAll(); }
  async function addVehicle(e:FormEvent){ e.preventDefault(); await addDoc(collection(db,"vehicles"), vehicleForm); setVehicleForm({customerId:"",plate:"",brand:"",model:"",year:"",color:""}); setNotice("Veículo cadastrado com sucesso."); await loadAll(); }
  async function addOrder(e:FormEvent){
    e.preventDefault();
    const token = crypto.randomUUID().replaceAll("-","");
    const payload = { ...orderForm, materialCost:Number(orderForm.materialCost||0), laborCost:Number(orderForm.laborCost||0), status:"Agendado" as ServiceStatus, publicToken:token };
    const ref = await addDoc(collection(db,"serviceOrders"), payload);
    const customer = customers.find(c=>c.id===payload.customerId);
    const vehicle = vehicles.find(v=>v.id===payload.vehicleId);
    await setDoc(doc(db,"publicTracking",token), { orderId:ref.id, customerName:customer?.name||"Cliente", vehicle:vehicle ? `${vehicle.brand} ${vehicle.model}` : "Veículo", plate:vehicle?.plate||"", serviceDescription:payload.serviceDescription, scheduledDate:payload.scheduledDate, estimatedDelivery:payload.estimatedDelivery, status:payload.status, notes:payload.notes||"", total:payload.materialCost+payload.laborCost });
    setOrderForm({customerId:"",vehicleId:"",serviceDescription:"",materialCost:"",laborCost:"",scheduledDate:"",estimatedDelivery:"",notes:""});
    setNotice("Serviço agendado e link de acompanhamento criado."); await loadAll();
  }

  async function updateStatus(order:ServiceOrder,status:ServiceStatus){
    await updateDoc(doc(db,"serviceOrders",order.id),{status});
    await updateDoc(doc(db,"publicTracking",order.publicToken),{status});
    setOrders(prev=>prev.map(o=>o.id===order.id?{...o,status}:o));
  }

  function copyLink(token:string){ const url=`${window.location.origin}/acompanhar/${token}`; navigator.clipboard.writeText(url); setNotice("Link copiado. Envie para o cliente pelo WhatsApp."); }

  if (!authorized) return <main className="admin-loading">Carregando área da oficina...</main>;

  return <main className="admin-page">
    <section className="admin-hero container">
      <div><span className="eyebrow">GESTÃO DA OFICINA</span><h1>Painel Felipe Auto Design</h1><p>Clientes, veículos, ordem de serviço, custos, agenda e acompanhamento do cliente em um só lugar.</p></div>
      <div className="admin-actions"><button onClick={loadAll}><RefreshCw size={17}/> Atualizar</button><button onClick={()=>signOut(auth)}><LogOut size={17}/> Sair</button></div>
    </section>
    <section className="container admin-shell">
      {notice && <div className="admin-notice" onClick={()=>setNotice("")}>{notice}</div>}
      <nav className="admin-tabs">
        <button className={tab==="resumo"?"active":""} onClick={()=>setTab("resumo")}><ClipboardList size={17}/>Resumo</button>
        <button className={tab==="clientes"?"active":""} onClick={()=>setTab("clientes")}><Users size={17}/>Clientes</button>
        <button className={tab==="veiculos"?"active":""} onClick={()=>setTab("veiculos")}><Car size={17}/>Veículos</button>
        <button className={tab==="servicos"?"active":""} onClick={()=>setTab("servicos")}><Plus size={17}/>Serviços</button>
        <button className={tab==="agenda"?"active":""} onClick={()=>setTab("agenda")}><CalendarDays size={17}/>Agenda</button>
      </nav>
      {loading ? <div className="admin-loading">Carregando dados...</div> : <>
        {tab==="resumo" && <div>
          <div className="admin-kpis"><article><span>Clientes</span><strong>{customers.length}</strong></article><article><span>Veículos</span><strong>{vehicles.length}</strong></article><article><span>Serviços em andamento</span><strong>{openOrders.length}</strong></article><article><span>Valor dos serviços</span><strong>{money(revenue)}</strong></article></div>
          <h2 className="admin-section-title">Serviços recentes</h2><OrderTable orders={orders.slice(0,8)} customerName={customerName} vehicleName={vehicleName} onStatus={updateStatus} onCopy={copyLink}/>
        </div>}
        {tab==="clientes" && <div className="admin-two-cols"><form className="admin-card admin-form" onSubmit={addCustomer}><h2>Novo cliente</h2><label><span>Nome *</span><input value={clientForm.name} onChange={e=>setClientForm({...clientForm,name:e.target.value})} required/></label><label><span>WhatsApp *</span><input value={clientForm.phone} onChange={e=>setClientForm({...clientForm,phone:e.target.value})} required/></label><label><span>E-mail</span><input type="email" value={clientForm.email} onChange={e=>setClientForm({...clientForm,email:e.target.value})}/></label><label><span>CPF/CNPJ</span><input value={clientForm.cpfCnpj} onChange={e=>setClientForm({...clientForm,cpfCnpj:e.target.value})}/></label><button className="admin-primary">Cadastrar cliente</button></form><div className="admin-card"><h2>Clientes cadastrados</h2><div className="admin-list">{customers.map(c=><article key={c.id}><b>{c.name}</b><span>{c.phone}</span><small>{c.email||c.cpfCnpj||"Sem dados adicionais"}</small></article>)}</div></div></div>}
        {tab==="veiculos" && <div className="admin-two-cols"><form className="admin-card admin-form" onSubmit={addVehicle}><h2>Novo veículo</h2><label><span>Cliente *</span><select value={vehicleForm.customerId} onChange={e=>setVehicleForm({...vehicleForm,customerId:e.target.value})} required><option value="">Selecione</option>{customers.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label><div className="admin-form-row"><label><span>Placa *</span><input value={vehicleForm.plate} onChange={e=>setVehicleForm({...vehicleForm,plate:e.target.value.toUpperCase()})} required/></label><label><span>Ano</span><input value={vehicleForm.year} onChange={e=>setVehicleForm({...vehicleForm,year:e.target.value})}/></label></div><div className="admin-form-row"><label><span>Marca *</span><input value={vehicleForm.brand} onChange={e=>setVehicleForm({...vehicleForm,brand:e.target.value})} required/></label><label><span>Modelo *</span><input value={vehicleForm.model} onChange={e=>setVehicleForm({...vehicleForm,model:e.target.value})} required/></label></div><label><span>Cor</span><input value={vehicleForm.color} onChange={e=>setVehicleForm({...vehicleForm,color:e.target.value})}/></label><button className="admin-primary">Cadastrar veículo</button></form><div className="admin-card"><h2>Veículos</h2><div className="admin-list">{vehicles.map(v=><article key={v.id}><b>{v.brand} {v.model}</b><span>{v.plate} • {v.color||"Cor não informada"}</span><small>{customerName(v.customerId)}</small></article>)}</div></div></div>}
        {tab==="servicos" && <div><form className="admin-card admin-form order-form" onSubmit={addOrder}><h2>Novo serviço / agendamento</h2><div className="admin-form-row"><label><span>Cliente *</span><select value={orderForm.customerId} onChange={e=>setOrderForm({...orderForm,customerId:e.target.value,vehicleId:""})} required><option value="">Selecione</option>{customers.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label><label><span>Veículo *</span><select value={orderForm.vehicleId} onChange={e=>setOrderForm({...orderForm,vehicleId:e.target.value})} required><option value="">Selecione</option>{filteredVehicles.map(v=><option key={v.id} value={v.id}>{v.brand} {v.model} • {v.plate}</option>)}</select></label></div><label><span>Serviço a ser realizado *</span><textarea rows={3} value={orderForm.serviceDescription} onChange={e=>setOrderForm({...orderForm,serviceDescription:e.target.value})} required placeholder="Ex.: Recuperação do para-choque dianteiro + pintura"/></label><div className="admin-form-row"><label><span>Valor material (R$)</span><input type="number" min="0" step="0.01" value={orderForm.materialCost} onChange={e=>setOrderForm({...orderForm,materialCost:e.target.value})}/></label><label><span>Valor mão de obra (R$)</span><input type="number" min="0" step="0.01" value={orderForm.laborCost} onChange={e=>setOrderForm({...orderForm,laborCost:e.target.value})}/></label></div><div className="admin-form-row"><label><span>Data agendada *</span><input type="date" value={orderForm.scheduledDate} onChange={e=>setOrderForm({...orderForm,scheduledDate:e.target.value})} required/></label><label><span>Estimativa de entrega *</span><input type="date" value={orderForm.estimatedDelivery} onChange={e=>setOrderForm({...orderForm,estimatedDelivery:e.target.value})} required/></label></div><label><span>Observações para o cliente</span><textarea rows={2} value={orderForm.notes} onChange={e=>setOrderForm({...orderForm,notes:e.target.value})}/></label><button className="admin-primary">Agendar serviço e gerar acompanhamento</button></form><h2 className="admin-section-title">Ordens de serviço</h2><OrderTable orders={orders} customerName={customerName} vehicleName={vehicleName} onStatus={updateStatus} onCopy={copyLink}/></div>}
        {tab==="agenda" && <OfficeCalendar orders={orders} customers={customers} vehicles={vehicles}/>} 
      </>}
    </section>
  </main>;
}

function OrderTable({orders,customerName,vehicleName,onStatus,onCopy}:{orders:ServiceOrder[];customerName:(id:string)=>string;vehicleName:(id:string)=>string;onStatus:(order:ServiceOrder,status:ServiceStatus)=>void;onCopy:(token:string)=>void}){
  return <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Cliente / veículo</th><th>Serviço</th><th>Agenda</th><th>Valores</th><th>Status</th><th>Cliente</th></tr></thead><tbody>{orders.length===0?<tr><td colSpan={6}>Nenhum serviço cadastrado.</td></tr>:orders.map(o=><tr key={o.id}><td><b>{customerName(o.customerId)}</b><small>{vehicleName(o.vehicleId)}</small></td><td>{o.serviceDescription}</td><td><b>{o.scheduledDate?.split("-").reverse().join("/")}</b><small>Entrega: {o.estimatedDelivery?.split("-").reverse().join("/")}</small></td><td><b>{money(Number(o.materialCost)+Number(o.laborCost))}</b><small>Material {money(Number(o.materialCost))} • M.O. {money(Number(o.laborCost))}</small></td><td><select value={o.status} onChange={e=>onStatus(o,e.target.value as ServiceStatus)}>{SERVICE_STATUSES.map(s=><option key={s}>{s}</option>)}</select></td><td><button className="copy-link" onClick={()=>onCopy(o.publicToken)}><Copy size={15}/> Copiar link</button></td></tr>)}</tbody></table></div>;
}
