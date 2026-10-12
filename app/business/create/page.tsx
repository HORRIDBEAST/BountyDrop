"use client";

import dynamic from "next/dynamic";

const BusinessQuestCreatorForm = dynamic(
  () => import("../../../components/BusinessQuestCreatorForm").then((m) => m.BusinessQuestCreatorForm),
  { ssr: false, loading: () => <p className="text-white/50">Loading form...</p> },
);

export default function CreateQuestPage() {
  return (
    <div className="mx-auto max-w-2xl">
      <p className="text-[11px] font-medium uppercase tracking-wider text-white/40">New quest</p>
      <h1 className="mb-6 mt-1 font-display text-2xl font-semibold text-white">Post a bounty</h1>
      <BusinessQuestCreatorForm />
    </div>
  );
}
