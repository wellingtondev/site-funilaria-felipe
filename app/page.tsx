import Link from "next/link";
import { ArrowRight, BadgeCheck, CarFront, Paintbrush, ShieldCheck, ShoppingBag, Sparkles, TimerReset, WandSparkles } from "lucide-react";
import HeroInteractiveVisual from "../components/HeroInteractiveVisual";

const services = [
  { icon: CarFront, title: "Funilaria", text: "Reparos de amassados, para-choques, peças e recuperação da carroceria com acabamento preciso." },
  { icon: Paintbrush, title: "Pintura", text: "Pintura automotiva com preparação cuidadosa, correção de cor e acabamento de alto padrão." },
  { icon: Sparkles, title: "Estética Automotiva", text: "Revitalização visual para devolver brilho, presença e valorização ao seu veículo." },
];

export default function Home() {
  return (
    <main>
      <section className="hero">
        <div className="paint paint-one"/><div className="paint paint-two"/>
        <div className="container hero-grid">
          <div className="hero-copy">
            <div className="eyebrow">FUNILARIA • PINTURA • ESTÉTICA AUTOMOTIVA</div>
            <h1>Seu carro volta a chamar atenção <span>pelos motivos certos.</span></h1>
            <p>Reparos de funilaria, pintura e estética automotiva com cuidado técnico, acabamento profissional e atendimento direto.</p>
            <div className="hero-actions">
              <Link className="btn primary" href="/orcamento">Fazer orçamento <ArrowRight size={18}/></Link>
              <Link className="btn ghost" href="/parceiro">Sou lojista</Link>
            </div>
            <div className="hero-points"><span><BadgeCheck size={18}/> Atendimento direto</span><span><TimerReset size={18}/> Agilidade</span><span><ShieldCheck size={18}/> Cuidado em cada detalhe</span></div>
          </div>
          <HeroInteractiveVisual />
        </div>
      </section>

      <section className="section" id="servicos">
        <div className="container">
          <div className="section-heading"><span>O QUE FAZEMOS</span><h2>Serviços para recuperar aparência, acabamento e valor.</h2></div>
          <div className="cards three">{services.map(({icon: Icon,title,text}) => <article className="service-card" key={title}><div className="icon-box"><Icon/></div><h3>{title}</h3><p>{text}</p></article>)}</div>
        </div>
      </section>

      <section className="section dark-band">
        <div className="container split">
          <div><div className="section-heading left"><span>PROCESSO</span><h2>Do primeiro contato ao acabamento final.</h2></div><p className="muted">Você explica o que precisa, avaliamos o serviço, alinhamos a melhor solução e executamos com foco no resultado final.</p></div>
          <div className="steps"><div><b>01</b><span><strong>Avaliação</strong><small>Entendemos o dano e o objetivo.</small></span></div><div><b>02</b><span><strong>Orçamento</strong><small>Alinhamento claro antes do serviço.</small></span></div><div><b>03</b><span><strong>Execução</strong><small>Funilaria, preparação e acabamento.</small></span></div><div><b>04</b><span><strong>Entrega</strong><small>Seu veículo pronto para voltar à rua.</small></span></div></div>
        </div>
      </section>

      <section className="section">
        <div className="container store-home-banner">
          <div><span className="eyebrow">LOJA FELIPE AUTO DESIGN</span><h2>Produtos automotivos disponíveis em estoque.</h2><p>Escolha seus produtos, monte o pedido e fale com a gente direto pelo WhatsApp.</p></div>
          <Link className="btn primary" href="/loja">Ir para a loja <ShoppingBag size={18}/></Link>
        </div>
      </section>

      <section className="section">
        <div className="container partner-banner"><div><span className="eyebrow">PARA LOJISTAS E EMPRESAS</span><h2>Precisa de uma funilaria parceira para o seu giro de veículos?</h2><p>Converse conosco sobre atendimento recorrente para lojas, frotas e parceiros comerciais.</p></div><Link className="btn primary" href="/parceiro">Conhecer parceria <ArrowRight size={18}/></Link><WandSparkles className="banner-icon"/></div>
      </section>

      <section className="section contact-strip"><div className="container contact-content"><div><span>FELIPE AUTO DESIGN</span><h2>Vamos cuidar do seu carro?</h2><p>Avenida Alfredo de Faria, 87 - Tutunas</p></div><Link href="/orcamento" className="btn light">Solicitar orçamento <ArrowRight size={18}/></Link></div></section>
    </main>
  );
}
