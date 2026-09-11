import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = { title: "Nexora — Turn Free Time Into Income", description: "Find flexible local work, connect with businesses, and make your free time work for you.", icons: { icon: "/favicon.svg" } };
export default function RootLayout({children}: Readonly<{children: React.ReactNode}>) {return <html lang="en"><body>{children}</body></html>}
