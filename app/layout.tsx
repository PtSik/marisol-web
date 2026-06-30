import type { ReactNode } from "react";
import "./globals.css";

export const metadata = {
  title: "Kaijiro — AI Receptionist",
  description:
    "An AI receptionist for your business that answers every call and books appointments 24/7.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href="/logo.png" type="image/png" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,300;9..144,400;9..144,500&family=Inter:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="font-sans bg-cream text-ink">{children}</body>
    </html>
  );
}
