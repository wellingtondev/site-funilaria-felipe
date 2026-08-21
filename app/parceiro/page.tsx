import PartnerForm from "@/components/PartnerForm";
import { BadgeDollarSign, Handshake, Repeat2, ShieldCheck } from "lucide-react";

export default function ParceiroPage() {
  return <main className="inner-page">
    <section className="page-hero partner-hero"><div className="container narrow"><div className="eyebrow">PROGRAMA DE PARCEIROS</div><h1>Uma oficina parceira para apoiar o giro do seu negócio.</h1><p>Canal dedicado para lojistas, locadoras, frotas e empresas que buscam agilidade, previsibilidade e padrão de acabamento.</p></div></section>
    <section className="section"><div className="container cards four"><article className="mini-card"><Repeat2/><h3>Demanda recorrente</h3><p>Fluxo organizado para serviços em múltiplos veículos.</p></article><article className="mini-card"><Handshake/><h3>Relacionamento direto</h3><p>Contato simples e acompanhamento próximo.</p></article><article className="mini-card"><BadgeDollarSign/><h3>Condição comercial</h3><p>Possibilidade de negociação conforme perfil e volume.</p></article><article className="mini-card"><ShieldCheck/><h3>Padrão de entrega</h3><p>Foco em acabamento e valorização do veículo.</p></article></div></section>
    <section className="section dark-band"><div className="container form-layout"><div><div className="section-heading left"><span>QUERO SER PARCEIRO</span><h2>Apresente sua operação.</h2></div><p className="muted">Preencha os dados principais e abriremos uma conversa no WhatsApp para entender volume, perfil dos veículos e formato de atendimento.</p></div><PartnerForm/></div></section>
  </main>;
}
