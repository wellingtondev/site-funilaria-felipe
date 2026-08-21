"use client";

import { FormEvent } from "react";
import { ArrowRight } from "lucide-react";

export default function PartnerForm() {
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const text = [
      "Olá, Felipe Auto Design! Tenho interesse em ser parceiro lojista.",
      `Empresa: ${form.get("empresa")}`,
      `Responsável: ${form.get("responsavel")}`,
      `Cidade: ${form.get("cidade")}`,
      `Telefone: ${form.get("telefone")}`,
      `Tipo de operação: ${form.get("operacao")}`,
      `Volume estimado: ${form.get("volume")}`,
    ].join("\n");
    window.open(`https://wa.me/5534991543776?text=${encodeURIComponent(text)}`, "_blank");
  }
  return (
    <form className="form-card" onSubmit={submit}>
      <div className="form-grid">
        <label>Empresa<input name="empresa" required placeholder="Nome da loja ou empresa" /></label>
        <label>Responsável<input name="responsavel" required placeholder="Seu nome" /></label>
        <label>Cidade<input name="cidade" required placeholder="Cidade / UF" /></label>
        <label>Telefone<input name="telefone" required placeholder="(34) 99999-9999" /></label>
        <label>Tipo de operação<select name="operacao" required defaultValue=""><option value="" disabled>Selecione</option><option>Loja de veículos</option><option>Locadora</option><option>Seguradora</option><option>Frota empresarial</option><option>Outro</option></select></label>
        <label>Volume estimado<input name="volume" placeholder="Ex.: 10 veículos/mês" /></label>
      </div>
      <button className="btn primary full" type="submit">Quero conversar sobre parceria <ArrowRight size={18}/></button>
    </form>
  );
}
