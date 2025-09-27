"use client";

import {
  DynamicContextProvider,
} from "@dynamic-labs/sdk-react-core";
import { ZeroDevSmartWalletConnectors } from "@dynamic-labs/ethereum-aa";
import { EthereumWalletConnectors } from "@dynamic-labs/ethereum";
import React from "react";
import { TokenProvider } from "@/context/TokenContext";
import { UserProvider } from "@/context/UserContext";
import { SwapProvider } from "@/context/SwapContext";
import { ThemeProvider } from "@mui/material";
import {theme}from '@/utils/theme'
import { VerificationProvider } from "@/context/VerificationContext";

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
      <TokenProvider>
      <UserProvider>
        <SwapProvider>
          <VerificationProvider>
          <ThemeProvider theme={theme}>
           
      {children}
      </ThemeProvider>
       </VerificationProvider>
      </SwapProvider>
       </UserProvider>
      </TokenProvider>
     
    </DynamicContextProvider>
  );
}
