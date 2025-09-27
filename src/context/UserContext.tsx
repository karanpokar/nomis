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

  useEffect(() => {
    const fetchTokens = async () => {
      //if (!primaryWallet?.address || !selectedChain) return;
        let demo='0xBC98fa6f8501aC06BfB839459Ee2E6c76a0cF8de'
      try {
        const res = await fetch(
          `https://public-backend.bungee.exchange/api/v1/tokens/list?userAddress=${demo}&chainIds=137`,
          {
            headers: {
              "Accept": "application/json",
            },
          }
        );

        if (!res.ok) {
          console.error("Error fetching tokens:", res.statusText);
          return;
        }

        const data = await res.json();
        // Bungee returns tokens in data.supportedTokens or data.tokens depending on the chain
        setTokens(data?.result?.[`${selectedChain?.chainId}`] || []);
        
      } catch (err) {
        console.error("Failed to fetch tokens:", err);
      }
    };

    fetchTokens();
  }, [primaryWallet, selectedChain]);

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
