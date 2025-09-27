#!/usr/bin/env bash
# ------------------------------------------------------------
# Deploy ProofOfHuman contract to Celo Sepolia using Foundry
# ------------------------------------------------------------

set -e   # exit on first error

if [ -f .env ]; then
  echo "Loading environment variables from .env..."
  source .env
else
  echo "❌ .env file not found! Please create one with:"
  echo "PRIVATE_KEY=0x..."
  echo "CELO_SEPOLIA_RPC_URL=https://..."
  exit 1
fi

if [ -z "$PRIVATE_KEY" ]; then
  echo "❌ PRIVATE_KEY is not set."
  exit 1
fi

if [ -z "$CELO_SEPOLIA_RPC_URL" ]; then
  echo "❌ CELO_SEPOLIA_RPC_URL is not set."
  exit 1
fi

echo "🔧 Cleaning and compiling..."
forge clean
forge build

echo "🚀 Deploying contract to Celo Sepolia..."
forge script script/Deploy.s.sol:Deploy \
  --rpc-url "$CELO_SEPOLIA_RPC_URL" \
  --broadcast \
  --private-key "$PRIVATE_KEY"

echo "✅ Deployment complete."
