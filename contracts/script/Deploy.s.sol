// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/QuestEscrow.sol";
import "../src/SpendVault.sol";

/// @notice Deploys QuestEscrow + SpendVault to Monad Testnet.
///
/// Usage:
///   cp .env.example .env   # fill in PRIVATE_KEY and PHOTO_ORACLE_ADDRESS
///   source .env
///   forge script script/Deploy.s.sol \
///     --rpc-url monad_testnet \
///     --broadcast \
///     --private-key $PRIVATE_KEY
///
/// After deploy, copy the two logged addresses into ../.env.local as
/// NEXT_PUBLIC_QUEST_ESCROW_ADDRESS and NEXT_PUBLIC_SPEND_VAULT_ADDRESS,
/// then run `npm run gen-abi` from the repo root to refresh lib/abi.ts.
contract Deploy is Script {
    function run() external {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        address photoOracle = vm.envOr("PHOTO_ORACLE_ADDRESS", vm.addr(deployerKey));

        vm.startBroadcast(deployerKey);

        QuestEscrow questEscrow = new QuestEscrow(photoOracle);
        SpendVault spendVault = new SpendVault();

        vm.stopBroadcast();

        console.log("QuestEscrow deployed at:", address(questEscrow));
        console.log("SpendVault deployed at:", address(spendVault));
        console.log("Photo oracle set to:", photoOracle);
    }
}
