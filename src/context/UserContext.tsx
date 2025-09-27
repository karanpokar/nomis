"use client";
import { getNetworkById, networks } from "@/constants/network";
import { useDynamicContext } from "@dynamic-labs/sdk-react-core";
import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";

type UserContextType = {
  selectedChain: any | null;
  setSelectedChain: (chain: string | null) => void;
  primaryWallet: any;
  tokens: any[];
  switchChain: (label: string) => void;
};

const UserContext = createContext<UserContextType | undefined>(undefined);

export const UserProvider = ({ children }: { children: ReactNode }) => {
  const [selectedChain, setSelectedChain] = useState<any | null>(networks?.[0]);
  const [tokens, setTokens] = useState<any[]>([]);
  
  const { primaryWallet,network } = useDynamicContext();

//   const switchChain = (label: string) => {
//     const network = networks.find((net) => net.label === label) || null;
//     setSelectedChain(network);
//   }

useEffect(() => {
    if (network) {
        /*@ts-ignore*/
      setSelectedChain(getNetworkById(parseFloat(network || '8453')));
        //switchChain(selectedChain.label);
    }
  }, [network]);

 

  return (
    /*@ts-ignore*/
    <UserContext.Provider value={{ tokens, selectedChain, setSelectedChain, primaryWallet }}>
      {children}
    </UserContext.Provider>
  );
};

// custom hook
export const useUser = () => {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error("useUser must be used within a UserProvider");
  }
  return context;
};
