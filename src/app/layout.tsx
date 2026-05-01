import type { Metadata } from "next";
import "./globals.css";
import ServiceWorkerInit from "@/components/ui/ServiceWorkerInit";

export const metadata: Metadata = {
  title: "Budget App",
  description: "Personal budget tracker for variable income",
  manifest: "/manifest.json",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <ServiceWorkerInit />
        {children}
      </body>
    </html>
  );
}
