import type { Metadata } from "next";
import "./globals.css";
import "leaflet/dist/leaflet.css";
import { Providers } from "./providers";
import { NavBar } from "../components/NavBar";

export const metadata: Metadata = {
  title: "BountyDrop — Location-based micro-bounties on Monad",
  description:
    "Discover, complete, and pay out location-based micro-bounties on Monad Testnet.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <Providers>
          <NavBar />
          <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
        </Providers>
      </body>
    </html>
  );
}
