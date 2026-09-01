"use client";

import { FormEvent, useEffect, useState } from "react";
import { signInWithEmailAndPassword, onAuthStateChanged } from "firebase/auth";
import { useRouter } from "next/navigation";
import { LockKeyhole, Mail } from "lucide-react";
import { auth } from "@/lib/firebase";

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => onAuthStateChanged(auth, (user) => user && router.replace("/admin")), [router]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      await signInWithEmailAndPassword(auth, email, password);
      router.replace("/admin");
    } catch {
      setError("E-mail ou senha inválidos.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="admin-login-page">
      <section className="admin-login-card">
        <div className="admin-badge"><LockKeyhole size={22} /> Área da Oficina</div>
        <h1>Gestão Felipe Auto Design</h1>
        <p>Entre para cadastrar clientes, veículos, serviços e acompanhar a agenda da oficina.</p>
        <form onSubmit={handleSubmit} className="admin-form">
          <label><span>E-mail</span><div className="admin-input-icon"><Mail size={17}/><input type="email" value={email} onChange={(e)=>setEmail(e.target.value)} required /></div></label>
          <label><span>Senha</span><div className="admin-input-icon"><LockKeyhole size={17}/><input type="password" value={password} onChange={(e)=>setPassword(e.target.value)} required /></div></label>
          {error && <div className="admin-error">{error}</div>}
          <button className="admin-primary" disabled={loading}>{loading ? "Entrando..." : "Entrar"}</button>
        </form>
      </section>
    </main>
  );
}
