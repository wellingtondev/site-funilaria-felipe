import QuoteForm from "@/components/QuoteForm";
import { Camera, MessageCircle, Sparkles } from "lucide-react";

export default function OrcamentoPage() {
  return <main className="inner-page">
    <section className="page-hero"><div className="container narrow"><div className="eyebrow">ORÇAMENTO</div><h1>Conte o que seu carro precisa.</h1><p>Preencha os dados abaixo. Ao finalizar, sua solicitação será aberta no WhatsApp já organizada para agilizar o atendimento.</p></div></section>
    <section className="section"><div className="container form-layout"><QuoteForm/><aside className="side-info"><h3>Como funciona?</h3><div><MessageCircle/><span><strong>1. Envie a solicitação</strong><small>Conte o serviço e o veículo.</small></span></div><div><Camera/><span><strong>2. Separe fotos</strong><small>No WhatsApp, envie imagens do dano para facilitar a avaliação.</small></span></div><div><Sparkles/><span><strong>3. Receba a orientação</strong><small>Alinhamos avaliação, prazo e próximos passos.</small></span></div></aside></div></section>
  </main>;
}
