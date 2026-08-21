"use client";

import { FormEvent, useState } from "react";
import { ArrowRight, CheckCircle2 } from "lucide-react";

export default function QuoteForm() {
  const [sent, setSent] = useState(false);
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const text = [
      "Olá, Felipe Auto Design! Gostaria de solicitar um orçamento.",
      `Nome: ${form.get("nome")}`,
      `Veículo: ${form.get("veiculo")}`,
      `Ano: ${form.get("ano")}`,
      `Serviço: ${form.get("servico")}`,
      `Descrição: ${form.get("descricao")}`,
    ].join("\n");
    window.open(`https://wa.me/5534991543776?text=${encodeURIComponent(text)}`, "_blank");
    setSent(true);
  }
  return (
    <form className="form-card" onSubmit={submit}>
      <div className="form-grid">
        <label>Seu nome<input name="nome" required placeholder="Como podemos te chamar?" /></label>
        <label>Veículo<input name="veiculo" required placeholder="Ex.: Honda Civic" /></label>
        <label>Ano<input name="ano" inputMode="numeric" placeholder="Ex.: 2022" /></label>
        <label>Serviço<select name="servico" required defaultValue=""><option value="" disabled>Selecione</option><option>Funilaria</option><option>Pintura</option><option>Estética Automotiva</option><option>Funilaria + Pintura</option><option>Outro</option></select></label>
      </div>
      <label>Conte rapidamente o que aconteceu<textarea name="descricao" required rows={6} placeholder="Descreva o dano, a peça ou o serviço que deseja realizar." /></label>
      <button className="btn primary full" type="submit">Enviar pelo WhatsApp <ArrowRight size={18}/></button>
      {sent && <p className="success"><CheckCircle2 size={18}/> Abrimos seu WhatsApp com a solicitação preenchida.</p>}
    </form>
  );
}
