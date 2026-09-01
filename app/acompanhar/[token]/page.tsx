"use client";

import { use, useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { CalendarCheck, Car, CheckCircle2, Clock3, Wrench } from "lucide-react";
import { db } from "@/lib/firebase";
import { SERVICE_STATUSES, ServiceStatus } from "@/lib/office-types";

interface Tracking { customerName:string; vehicle:string; plate:string; serviceDescription:string; scheduledDate:string; estimatedDelivery:string; status:ServiceStatus; notes?:string; total:number; }

export default function TrackingPage({ params }:{ params:Promise<{token:string}> }) {
  const { token } = use(params);
  const [data,setData]=useState<Tracking|null>(null);
  const [loading,setLoading]=useState(true);
  useEffect(()=>{ getDoc(doc(db,"publicTracking",token)).then(s=>{ if(s.exists()) setData(s.data() as Tracking); }).finally(()=>setLoading(false)); },[token]);
  if(loading) return <main className="tracking-page"><div className="tracking-card">Carregando acompanhamento...</div></main>;
  if(!data) return <main className="tracking-page"><div className="tracking-card"><h1>Serviço não encontrado</h1><p>Confira se o link recebido está completo ou fale com a Felipe Auto Design.</p></div></main>;
  const current=SERVICE_STATUSES.indexOf(data.status);
  const date=(v:string)=>v? v.split("-").reverse().join("/") : "-";
  return <main className="tracking-page"><section className="tracking-card">
    <div className="tracking-logo"><span>F</span><div><strong>FELIPE</strong><small>AUTO DESIGN</small></div></div>
    <span className="tracking-eyebrow">ACOMPANHAMENTO DO SERVIÇO</span><h1>Olá, {data.customerName.split(" ")[0]}!</h1><p className="tracking-lead">Aqui você acompanha a evolução do seu veículo em tempo real.</p>
    <div className="tracking-summary"><article><Car/><span>Veículo</span><b>{data.vehicle}</b><small>{data.plate}</small></article><article><Wrench/><span>Serviço</span><b>{data.serviceDescription}</b></article><article><CalendarCheck/><span>Previsão de entrega</span><b>{date(data.estimatedDelivery)}</b></article></div>
    <div className="tracking-status"><div><Clock3/><span>Status atual</span></div><strong>{data.status}</strong></div>
    <div className="tracking-timeline">{SERVICE_STATUSES.map((status,index)=><div key={status} className={index<=current?"done":""}><span>{index<=current?<CheckCircle2 size={20}/>:index+1}</span><p>{status}</p></div>)}</div>
    {data.notes && <div className="tracking-note"><b>Observação da oficina</b><p>{data.notes}</p></div>}
    <div className="tracking-footer"><p>Alguma dúvida? Fale conosco pelo WhatsApp.</p><a href="https://wa.me/5534991543776?text=Ol%C3%A1%2C%20gostaria%20de%20informa%C3%A7%C3%B5es%20sobre%20o%20meu%20servi%C3%A7o" target="_blank" rel="noreferrer">Falar com a oficina</a></div>
  </section></main>;
}
