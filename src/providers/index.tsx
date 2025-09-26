"use client";

import {
  DynamicContextProvider,
  DynamicWidget,
} from "@dynamic-labs/sdk-react-core";
import { ZeroDevSmartWalletConnectors } from "@dynamic-labs/ethereum-aa"; // <-- Add this import
import { ThemeProvider, CssBaseline } from "@mui/material";
import { DynamicWagmiConnector } from "@dynamic-labs/wagmi-connector";
import { createConfig, WagmiProvider } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { http } from "viem";
import {
  arbitrum,
  arbitrumSepolia,
  base,
  mainnet,
  polygon,
  polygonAmoy,
} from "viem/chains";
import { EthereumWalletConnectors } from "@dynamic-labs/ethereum";
import React from "react";

const config = createConfig({
  chains: [mainnet, arbitrum, polygon, polygonAmoy, base, arbitrumSepolia],
  multiInjectedProviderDiscovery: false,
  transports: {
    [mainnet.id]: http(),
    [arbitrum.id]: http(),
    [polygon.id]: http(),
    [polygonAmoy.id]: http(),
    [base.id]: http(),
    [arbitrumSepolia.id]: http(),
  },
});
{
  /* <DynamicWidget /> */
}
const queryClient = new QueryClient();

export default function WalletProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <DynamicContextProvider
      settings={{
        environmentId: process.env.NEXT_PUBLIC_DYNAMIC_ID || "",
        walletConnectors: [
          EthereumWalletConnectors,
          ZeroDevSmartWalletConnectors,
        ],
      }}
    >
      {children}
    </DynamicContextProvider>
  );
}
