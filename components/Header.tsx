"use client";

import Link from "next/link";
import { Menu, X } from "lucide-react";
import { useState } from "react";

export default function Header() {
  const [open, setOpen] = useState(false);
  return (
    <header className="site-header">
      <div className="container nav-shell">
        <Link href="/" className="brand" onClick={() => setOpen(false)}>
          <span className="brand-mark">F</span>
          <span><strong>FELIPE</strong><small>AUTO DESIGN</small></span>
        </Link>
        <button className="menu-button" onClick={() => setOpen(!open)} aria-label="Abrir menu">
          {open ? <X size={22} /> : <Menu size={22} />}
        </button>
        <nav className={open ? "nav-links open" : "nav-links"}>
          <Link href="/" onClick={() => setOpen(false)}>Início</Link>
          <a href="/#servicos" onClick={() => setOpen(false)}>Serviços</a>
          <Link href="/orcamento" onClick={() => setOpen(false)}>Faça seu orçamento</Link>
          <Link href="/parceiro" onClick={() => setOpen(false)}>Seja um parceiro</Link>
          <a className="nav-cta" href="https://wa.me/5534991543776" target="_blank" rel="noreferrer">WhatsApp</a>
        </nav>
      </div>
    </header>
  );
}
