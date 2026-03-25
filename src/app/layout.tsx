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
        {/* Starry sky background */}
        <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden" aria-hidden="true">
          {/* Layer 1: Dense small stars */}
          <div className="absolute inset-0" style={{
            backgroundImage: `
              radial-gradient(1.5px 1.5px at 3% 8%, rgba(255,255,255,0.48), transparent),
              radial-gradient(1.5px 1.5px at 7% 45%, rgba(255,255,255,0.39), transparent),
              radial-gradient(1.5px 1.5px at 12% 22%, rgba(255,255,255,0.42), transparent),
              radial-gradient(1.5px 1.5px at 16% 67%, rgba(255,255,255,0.36), transparent),
              radial-gradient(1.5px 1.5px at 21% 12%, rgba(255,255,255,0.45), transparent),
              radial-gradient(1.5px 1.5px at 27% 88%, rgba(255,255,255,0.39), transparent),
              radial-gradient(1.5px 1.5px at 33% 35%, rgba(255,255,255,0.42), transparent),
              radial-gradient(1.5px 1.5px at 38% 72%, rgba(255,255,255,0.36), transparent),
              radial-gradient(1.5px 1.5px at 44% 5%, rgba(255,255,255,0.45), transparent),
              radial-gradient(1.5px 1.5px at 48% 52%, rgba(255,255,255,0.39), transparent),
              radial-gradient(1.5px 1.5px at 54% 18%, rgba(255,255,255,0.42), transparent),
              radial-gradient(1.5px 1.5px at 59% 78%, rgba(255,255,255,0.36), transparent),
              radial-gradient(1.5px 1.5px at 64% 42%, rgba(255,255,255,0.39), transparent),
              radial-gradient(1.5px 1.5px at 71% 8%, rgba(255,255,255,0.45), transparent),
              radial-gradient(1.5px 1.5px at 76% 62%, rgba(255,255,255,0.36), transparent),
              radial-gradient(1.5px 1.5px at 82% 28%, rgba(255,255,255,0.42), transparent),
              radial-gradient(1.5px 1.5px at 87% 85%, rgba(255,255,255,0.39), transparent),
              radial-gradient(1.5px 1.5px at 93% 15%, rgba(255,255,255,0.42), transparent),
              radial-gradient(1.5px 1.5px at 97% 55%, rgba(255,255,255,0.36), transparent),
              radial-gradient(1.5px 1.5px at 5% 95%, rgba(255,255,255,0.39), transparent)`,
            backgroundSize: '100% 100%',
          }} />
          {/* Layer 2: Brighter accent stars */}
          <div className="absolute inset-0" style={{
            backgroundImage: `
              radial-gradient(2.5px 2.5px at 8% 30%, rgba(255,255,255,0.57), transparent),
              radial-gradient(3px 3px at 22% 55%, rgba(200,180,255,0.48), transparent),
              radial-gradient(2.5px 2.5px at 35% 15%, rgba(255,255,255,0.54), transparent),
              radial-gradient(3px 3px at 52% 82%, rgba(180,200,255,0.45), transparent),
              radial-gradient(2.5px 2.5px at 67% 25%, rgba(255,255,255,0.51), transparent),
              radial-gradient(3px 3px at 78% 48%, rgba(200,180,255,0.48), transparent),
              radial-gradient(2.5px 2.5px at 88% 72%, rgba(255,255,255,0.54), transparent),
              radial-gradient(3px 3px at 42% 38%, rgba(180,200,255,0.42), transparent),
              radial-gradient(2.5px 2.5px at 15% 92%, rgba(255,255,255,0.51), transparent),
              radial-gradient(3px 3px at 95% 10%, rgba(200,180,255,0.48), transparent)`,
            backgroundSize: '100% 100%',
          }} />
          {/* Layer 3: Repeating star field for density */}
          <div className="absolute inset-0 opacity-40" style={{
            backgroundImage: `
              radial-gradient(1.5px 1.5px at 18px 32px, rgba(255,255,255,0.48), transparent),
              radial-gradient(1.5px 1.5px at 67px 11px, rgba(255,255,255,0.42), transparent),
              radial-gradient(1.5px 1.5px at 112px 58px, rgba(255,255,255,0.36), transparent),
              radial-gradient(1.5px 1.5px at 43px 89px, rgba(255,255,255,0.45), transparent),
              radial-gradient(1.5px 1.5px at 156px 23px, rgba(255,255,255,0.39), transparent),
              radial-gradient(1.5px 1.5px at 89px 72px, rgba(255,255,255,0.42), transparent),
              radial-gradient(1.5px 1.5px at 134px 45px, rgba(255,255,255,0.36), transparent),
              radial-gradient(1.5px 1.5px at 23px 67px, rgba(255,255,255,0.45), transparent),
              radial-gradient(1.5px 1.5px at 178px 88px, rgba(255,255,255,0.39), transparent),
              radial-gradient(1.5px 1.5px at 56px 34px, rgba(255,255,255,0.42), transparent)`,
            backgroundSize: '200px 100px',
          }} />
          {/* Layer 4: Extra-bright feature stars (few, large) */}
          <div className="absolute inset-0" style={{
            backgroundImage: `
              radial-gradient(4px 4px at 10% 20%, rgba(255,255,255,0.6), transparent),
              radial-gradient(3.5px 3.5px at 45% 10%, rgba(220,200,255,0.57), transparent),
              radial-gradient(4px 4px at 75% 35%, rgba(255,255,255,0.6), transparent),
              radial-gradient(3.5px 3.5px at 30% 70%, rgba(200,220,255,0.54), transparent),
              radial-gradient(4px 4px at 85% 80%, rgba(255,255,255,0.57), transparent),
              radial-gradient(3.5px 3.5px at 60% 55%, rgba(220,200,255,0.54), transparent)`,
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
