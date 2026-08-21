import type { Metadata } from "next";
import "./globals.css";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

export const metadata: Metadata = {
  title: "Felipe Auto Design | Funilaria, Pintura e Estética Automotiva",
  description:
    "Funilaria, pintura e estética automotiva em Uberaba. Solicite seu orçamento pelo WhatsApp e conheça nosso programa para parceiros lojistas.",
  keywords: [
    "funilaria",
    "pintura automotiva",
    "estética automotiva",
    "oficina",
    "Uberaba",
    "Felipe Auto Design"
  ],
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>
        <Header />
        {children}
        <Footer />
      </body>
    </html>
  );
}
