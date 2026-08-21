import { Instagram, MapPin, MessageCircle } from "lucide-react";

export default function Footer() {
  return (
    <footer className="footer">
      <div className="container footer-grid">
        <div>
          <div className="footer-brand">FELIPE <span>AUTO DESIGN</span></div>
          <p>Funilaria, pintura e estética automotiva com cuidado em cada detalhe.</p>
        </div>
        <div className="footer-contact">
          <a href="https://wa.me/5534991543776" target="_blank" rel="noreferrer"><MessageCircle size={18}/> (34) 99154-3776</a>
          <a href="https://instagram.com/felipeautodesign" target="_blank" rel="noreferrer"><Instagram size={18}/> @felipeautodesign</a>
          <span><MapPin size={18}/> Avenida Alfredo de Faria, 87 - Tutunas - Uberaba/MG</span>
        </div>
      </div>
      <div className="container footer-bottom">© {new Date().getFullYear()} Felipe Auto Design. Todos os direitos reservados.</div>
    </footer>
  );
}
