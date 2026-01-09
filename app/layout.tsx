import "./globals.css";
import type { Metadata } from "next";
import { Press_Start_2P } from "next/font/google";

const pressStart = Press_Start_2P({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-pixel",
});

export const metadata: Metadata = {
  title: "Tyre Wise — Safe Size Alternatives",
  description: "Pixel-styled tyre size alternatives and suitability scoring.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={pressStart.variable}>
      <body>{children}</body>
    </html>
  );
}

