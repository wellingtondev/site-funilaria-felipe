import type { Metadata } from "next";
import type { ReactNode } from "react";

import "./globals.css";

import Header from "@/components/Header";
import Footer from "@/components/Footer";

export const metadata: Metadata = {
  metadataBase: new URL("https://www.felipeautodesign.com.br"),

  title: "Felipe Auto Design | Funilaria, Pintura e Estética Automotiva",

  description:
    "Funilaria, pintura e estética automotiva em Uberaba. Solicite seu orçamento pelo WhatsApp e conheça nosso programa para parceiros lojistas.",

  keywords: [
    "funilaria",
    "pintura automotiva",
    "estética automotiva",
    "oficina",
    "Uberaba",
    "Felipe Auto Design",
  ],

  openGraph: {
    title: "Felipe Auto Design | Funilaria e Pintura",

    description:
      "Funilaria, pintura e estética automotiva. Cuidamos do seu carro com excelência.",

    url: "https://www.felipeautodesign.com.br",

    siteName: "Felipe Auto Design",

    images: [
      {
        url: "/link-site.png",
        width: 1200,
        height: 630,
        alt: "Felipe Auto Design - Funilaria, Pintura e Estética Automotiva",
      },
    ],

    locale: "pt_BR",
    type: "website",
  },

  twitter: {
    card: "summary_large_image",

    title: "Felipe Auto Design | Funilaria e Pintura",

    description:
      "Funilaria, pintura e estética automotiva. Solicite seu orçamento.",

    images: ["/link-site.png"],
  },

  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
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