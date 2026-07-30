import type { Metadata } from "next";
import { Archivo, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";

// Modernist sets everything in Archivo; IBM Plex Mono carries the numerics.
const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "Runway",
  description: "Personal finance dashboard — balance runway, caps, and milestones.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      // dark-mode only: the `dark` class is always on, there is no toggle
      className={`dark ${archivo.variable} ${plexMono.variable} h-full antialiased`}
      // A browser extension injects inline styles onto <html> before React
      // hydrates (transition-property/margin-right), which React reports as a
      // mismatch. Nothing in this app writes those, and the warning is scoped
      // to this element's attributes — children still hydrate normally.
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
