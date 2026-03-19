import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Navbar from "@/components/Navbar";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Noites 🌃 — Jovens de Negocios",
  description: "Jovens de Negocios - Edicao de Videos",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body
        className={`${inter.variable} min-h-screen bg-slate-950 font-sans text-white antialiased`}
      >
        <div className="pointer-events-none fixed inset-0 -z-10" aria-hidden="true">
          <div className="absolute inset-0" style={{
            backgroundImage: `radial-gradient(1px 1px at 10% 20%, rgba(255,255,255,0.15), transparent),
              radial-gradient(1px 1px at 30% 50%, rgba(255,255,255,0.12), transparent),
              radial-gradient(1px 1px at 50% 10%, rgba(255,255,255,0.1), transparent),
              radial-gradient(1px 1px at 70% 80%, rgba(255,255,255,0.13), transparent),
              radial-gradient(1px 1px at 90% 40%, rgba(255,255,255,0.11), transparent),
              radial-gradient(1.5px 1.5px at 15% 75%, rgba(255,255,255,0.18), transparent),
              radial-gradient(1px 1px at 45% 90%, rgba(255,255,255,0.1), transparent),
              radial-gradient(1.5px 1.5px at 85% 15%, rgba(255,255,255,0.16), transparent),
              radial-gradient(1px 1px at 5% 55%, rgba(255,255,255,0.09), transparent),
              radial-gradient(1px 1px at 60% 35%, rgba(255,255,255,0.12), transparent),
              radial-gradient(1px 1px at 25% 85%, rgba(255,255,255,0.1), transparent),
              radial-gradient(1.5px 1.5px at 75% 60%, rgba(255,255,255,0.14), transparent),
              radial-gradient(1px 1px at 40% 5%, rgba(255,255,255,0.11), transparent),
              radial-gradient(1px 1px at 95% 70%, rgba(255,255,255,0.1), transparent),
              radial-gradient(1px 1px at 55% 55%, rgba(255,255,255,0.08), transparent),
              radial-gradient(1.5px 1.5px at 20% 40%, rgba(255,255,255,0.15), transparent),
              radial-gradient(1px 1px at 80% 25%, rgba(255,255,255,0.1), transparent),
              radial-gradient(1px 1px at 35% 70%, rgba(255,255,255,0.12), transparent),
              radial-gradient(1px 1px at 65% 95%, rgba(255,255,255,0.09), transparent),
              radial-gradient(1.5px 1.5px at 50% 50%, rgba(255,255,255,0.06), transparent)`,
            backgroundSize: '100% 100%',
          }} />
        </div>
        <Navbar />
        <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          {children}
        </main>
      </body>
    </html>
  );
}
