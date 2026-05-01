import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

const geistHeading = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-heading",
  display: "swap",
  weight: "100 900",
});

const geistBody = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-body",
  display: "swap",
  weight: "100 900",
});

export const metadata: Metadata = {
  title: "FeedSilo",
  description: "Your digital knowledge, searchable.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className={`${geistHeading.variable} ${geistBody.variable} font-sans bg-glow`}>
        {children}
      </body>
    </html>
  );
}
