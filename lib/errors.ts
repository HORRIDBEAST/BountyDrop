// lib/errors.ts
//
// Reusable revert-decoding pattern, carried over wholesale from SattelR's
// AgentPayVault settlement flow (see BOUNTYDROP_MASTER_SPEC.md Section 3):
// simulateContract() BEFORE writeContract() to dry-run a spend/submission
// and surface the exact revert reason before spending real gas, then decode
// custom Solidity errors from revert data into stable string codes the UI
// can switch on. Used by CheckInButton, ProofUploader, and
// SpendTerminalKeypad for every guarded on-chain call (quest payout claims,
// photo-task resolution, terminal redemption).

import { BaseError, ContractFunctionRevertedError, type Abi } from "viem";

/**
 * Stable error codes the UI can key off of, independent of exact Solidity
 * error message text (which can change across contract versions).
 */
export type ContractErrorCode =
  | "FRAME_ALREADY_CLAIMED"
  | "TASK_CLOSED"
  | "FRAME_OUT_OF_RANGE"
  | "NO_ANSWER_KEY"
  | "NOT_AUTHORIZED"
  | "NOT_A_PHOTO_TASK"
  | "NO_SUBMISSION_FOR_FRAME"
  | "BAD_FRAME_COUNT"
  | "ANSWER_KEY_MISMATCH"
  | "BAD_KIND"
  | "BAD_OPTION_COUNT"
  | "ESCROW_TOO_SMALL"
  | "REWARD_MUST_BE_POSITIVE"
  | "BAD_RADIUS"
  | "POLICY_NOT_FOUND"
  | "POLICY_INACTIVE"
  | "POLICY_EXPIRED"
  | "POLICY_ALREADY_USED"
  | "AMOUNT_LIMIT_EXCEEDED"
  | "CATEGORY_NOT_ALLOWED"
  | "MERCHANT_NOT_ALLOWED"
  | "OUTSIDE_MERCHANT_GEOFENCE"
  | "INSUFFICIENT_VAULT_BALANCE"
  | "TRANSFER_FAILED"
  | "NOT_AGENT"
  | "NOT_OWNER"
  | "ZERO_ADDRESS"
  | "ZERO_AMOUNT"
  | "EMPTY_CATEGORY"
  | "EMPTY_ALLOWLIST"
  | "REENTRANCY"
  | "UNKNOWN";

const ERROR_NAME_TO_CODE: Record<string, ContractErrorCode> = {
  FrameAlreadyClaimed: "FRAME_ALREADY_CLAIMED",
  TaskClosed: "TASK_CLOSED",
  FrameOutOfRange: "FRAME_OUT_OF_RANGE",
  NoAnswerKey: "NO_ANSWER_KEY",
  NotAuthorized: "NOT_AUTHORIZED",
  NotAPhotoTask: "NOT_A_PHOTO_TASK",
  NoSubmissionForFrame: "NO_SUBMISSION_FOR_FRAME",
  BadFrameCount: "BAD_FRAME_COUNT",
  AnswerKeyMismatch: "ANSWER_KEY_MISMATCH",
  BadKind: "BAD_KIND",
  BadOptionCount: "BAD_OPTION_COUNT",
  EscrowTooSmall: "ESCROW_TOO_SMALL",
  RewardMustBePositive: "REWARD_MUST_BE_POSITIVE",
  BadRadius: "BAD_RADIUS",
  PolicyNotFound: "POLICY_NOT_FOUND",
  PolicyInactive: "POLICY_INACTIVE",
  PolicyExpired: "POLICY_EXPIRED",
  PolicyAlreadyUsed: "POLICY_ALREADY_USED",
  AmountLimitExceeded: "AMOUNT_LIMIT_EXCEEDED",
  CategoryNotAllowed: "CATEGORY_NOT_ALLOWED",
  MerchantNotAllowed: "MERCHANT_NOT_ALLOWED",
  OutsideMerchantGeofence: "OUTSIDE_MERCHANT_GEOFENCE",
  InsufficientVaultBalance: "INSUFFICIENT_VAULT_BALANCE",
  TransferFailed: "TRANSFER_FAILED",
  NotAgent: "NOT_AGENT",
  NotOwner: "NOT_OWNER",
  ZeroAddress: "ZERO_ADDRESS",
  ZeroAmount: "ZERO_AMOUNT",
  EmptyCategory: "EMPTY_CATEGORY",
  EmptyAllowlist: "EMPTY_ALLOWLIST",
  Reentrancy: "REENTRANCY",
};

export const CONTRACT_ERROR_MESSAGES: Record<ContractErrorCode, string> = {
  FRAME_ALREADY_CLAIMED: "This bounty frame has already been paid out.",
  TASK_CLOSED: "This quest is no longer accepting submissions.",
  FRAME_OUT_OF_RANGE: "That frame doesn't exist on this quest.",
  NO_ANSWER_KEY: "This quest has no answer key for that frame.",
  NOT_AUTHORIZED: "You're not authorized to perform this action.",
  NOT_A_PHOTO_TASK: "This quest isn't a photo-proof quest.",
  NO_SUBMISSION_FOR_FRAME: "No photo submission found for this frame yet.",
  BAD_FRAME_COUNT: "Frame count must be between 1 and 500.",
  ANSWER_KEY_MISMATCH: "The number of golden answers must match the frame count (or be empty for photo quests).",
  BAD_KIND: "That's not a valid quest verification type.",
  BAD_OPTION_COUNT: "Multiple-choice quests need at least 2 matching options.",
  ESCROW_TOO_SMALL: "The MON sent doesn't cover reward × frame count.",
  REWARD_MUST_BE_POSITIVE: "Reward per frame must be greater than zero.",
  BAD_RADIUS: "Geofence radius must be greater than zero.",
  POLICY_NOT_FOUND: "That spend policy doesn't exist.",
  POLICY_INACTIVE: "That spend policy is no longer active.",
  POLICY_EXPIRED: "That spend policy has expired.",
  POLICY_ALREADY_USED: "That single-use spend policy has already been redeemed.",
  AMOUNT_LIMIT_EXCEEDED: "This spend would exceed the policy's remaining budget.",
  CATEGORY_NOT_ALLOWED: "This category isn't allowed under that policy.",
  MERCHANT_NOT_ALLOWED: "This merchant isn't on the policy's allowlist.",
  OUTSIDE_MERCHANT_GEOFENCE: "You're outside the merchant's allowed redemption radius.",
  INSUFFICIENT_VAULT_BALANCE: "The vault doesn't have enough balance for this spend.",
  TRANSFER_FAILED: "The MON transfer failed. Please try again.",
  NOT_AGENT: "This wallet isn't the agent authorized on that spend policy.",
  NOT_OWNER: "Only the vault owner can do that.",
  ZERO_ADDRESS: "A required address is missing.",
  ZERO_AMOUNT: "Amount must be greater than zero.",
  EMPTY_CATEGORY: "Category can't be empty.",
  EMPTY_ALLOWLIST: "You must allow at least one merchant.",
  REENTRANCY: "That request is still processing — please wait and try again.",
  UNKNOWN: "Something went wrong with that transaction.",
};

/**
 * Decode a thrown viem/wagmi error (from simulateContract or a reverted
 * writeContract) into a stable ContractErrorCode + human-readable message.
 */
export function decodeContractError(err: unknown, abi: Abi): {
  code: ContractErrorCode;
  message: string;
} {
  if (err instanceof BaseError) {
    const revertError = err.walk(
      (e) => e instanceof ContractFunctionRevertedError,
    ) as ContractFunctionRevertedError | undefined;

    if (revertError?.data?.errorName) {
      const code = ERROR_NAME_TO_CODE[revertError.data.errorName] ?? "UNKNOWN";
      return { code, message: CONTRACT_ERROR_MESSAGES[code] };
    }

    // require()-string reverts don't carry a custom error name — fall back
    // to whatever short message viem surfaced.
    return { code: "UNKNOWN", message: err.shortMessage ?? CONTRACT_ERROR_MESSAGES.UNKNOWN };
  }

  return { code: "UNKNOWN", message: CONTRACT_ERROR_MESSAGES.UNKNOWN };
}
