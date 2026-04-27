import { DM_Sans, Syne } from "next/font/google";
import "./globals.css";

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  weight: ["300", "400", "500"],
});

const syne = Syne({
  variable: "--font-syne",
  subsets: ["latin"],
  weight: ["400", "600", "700", "800"],
});

export const metadata = {
  title: "Mi Tienda",
  description: "Kiosco tracker para ventas",
};

export default function RootLayout({ children }) {
  return (
    <html lang="es" className={`${dmSans.variable} ${syne.variable}`}>
      <body>{children}</body>
    </html>
  );
}
