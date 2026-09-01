import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = { title: "Skintech Clinic", description: "Secure clinic management platform" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en-IN"><body>{children}</body></html>;
}

