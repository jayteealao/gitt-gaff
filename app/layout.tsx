import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Gitt-Gaff - Interactive Git Graph Viewer",
  description: "View interactive git commit graphs for any GitHub repository",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
