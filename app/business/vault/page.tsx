"use client";

import dynamic from "next/dynamic";
import { VaultPoliciesList } from "../../../components/VaultPoliciesList";

const VaultManagerForm = dynamic(
  () => import("../../../components/VaultManagerForm").then((m) => m.VaultManagerForm),
  { ssr: false, loading: () => <p className="text-white/50">Loading form...</p> },
);

export default function VaultManagePage() {
  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <p className="text-[11px] font-medium uppercase tracking-wider text-white/40">Spend Vault</p>
        <h1 className="mt-1 font-display text-2xl font-semibold text-white">Manage spend policies</h1>
        <p className="mt-2 text-sm text-white/50">
          Only the vault's owner wallet (the address that deployed
          SpendVault) can top up or grant policies here — any other wallet's
          transaction will revert.
        </p>
      </div>

      <VaultManagerForm />

      <div>
        <h2 className="font-display font-semibold text-white">Granted policies</h2>
        <div className="mt-3">
          <VaultPoliciesList />
        </div>
      </div>
    </div>
  );
}
