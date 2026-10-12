"use client";

// components/SpendTerminalKeypad.tsx
//
// Adapted from TapPay's keypad component pattern (see
// BOUNTYDROP_MASTER_SPEC.md Section 2), repurposed for a merchant-initiated
// redemption screen instead of P2P NFC tap: the terminal operator keys in
// an amount, then confirms a single spend() call against a policy granted
// by SpendVault.sol, rather than tapping two phones together.

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "0", "⌫"];

interface SpendTerminalKeypadProps {
  value: string;
  onChange: (next: string) => void;
  maxDecimals?: number;
}

export function SpendTerminalKeypad({ value, onChange, maxDecimals = 6 }: SpendTerminalKeypadProps) {
  function press(key: string) {
    if (key === "⌫") {
      onChange(value.slice(0, -1));
      return;
    }
    if (key === "." && value.includes(".")) return;

    const decimals = value.split(".")[1];
    if (decimals && decimals.length >= maxDecimals && key !== "⌫") return;

    // Avoid leading zeros like "00.5" while still allowing "0.5".
    if (value === "0" && key !== ".") {
      onChange(key);
      return;
    }

    onChange(value + key);
  }

  return (
    <div>
      <div className="mb-4 rounded-2xl border border-white/10 bg-ink px-4 py-6 text-center">
        <span className="text-4xl font-semibold text-white">{value || "0"}</span>
        <span className="ml-2 text-lg text-white/40">MON</span>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {KEYS.map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => press(key)}
            className="rounded-xl border border-white/10 bg-panel py-4 text-xl font-medium text-white hover:border-white/25 active:bg-white/10"
          >
            {key}
          </button>
        ))}
      </div>
    </div>
  );
}
