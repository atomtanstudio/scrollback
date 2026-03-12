import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "FeedSilo",
  description: "Personal content intelligence — capture, search, and organize your digital knowledge.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
