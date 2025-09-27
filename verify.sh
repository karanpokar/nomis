#!/usr/bin/env bash
# ---------------------------------------------------------
# Verify ProofOfHuman contract on Celo Sepolia Blockscout
# ---------------------------------------------------------

set -e

# Contract details
CONTRACT_ADDR=0x714Cd2AebE3023E18413072e51D7c6307A4B95f7
CONTRACT_PATH=src/contracts/ProofOfHuman.sol:ProofOfHuman

# RPC & Blockscout API
RPC_URL=https://forno.celo-sepolia.celo-testnet.org
VERIFIER_URL=https://celo-sepolia.blockscout.com/api/

# Optional: pin compiler settings if needed
SOLC_VERSION=0.8.28

echo "🔎 Verifying contract at $CONTRACT_ADDR ..."

forge verify-contract \
  --rpc-url "$RPC_URL" \
  --verifier blockscout \
  --verifier-url "$VERIFIER_URL" \
  --compiler-version v$SOLC_VERSION \
  --num-of-optimizations 200 \
  $CONTRACT_ADDR \
  $CONTRACT_PATH

echo "✅ Verification submitted. Check Blockscout UI for status."
