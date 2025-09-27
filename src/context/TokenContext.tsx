'use client'

import React, { createContext, useContext, useEffect, useState } from "react";
import { useDynamicContext } from "@dynamic-labs/sdk-react-core";
import { getNetworkById } from "@/constants/network";
import {getCoinBundles,getStockBundlesByTag} from '@/utils/tokenUtils'
import {stockList} from "@/constants/stock"; // adjust path if needed

function getAddressForChain(
  contractAddresses: string[],
  chain: string
): string | null {
  if (!contractAddresses || contractAddresses.length === 0) return null;
  const match = contractAddresses.find((c) =>
    c.toLowerCase().startsWith(chain.toLowerCase() + "/")
  );
  return match ? match.split("/")[1] : null;
}


interface TokenContextType {
  chain: string | null;
  marketTokens: any[];
  bundles: Record<string, any[]>;
  setChain: (chain: string) => void;
  stockBundles:any[];
  stockTokens:any[];
}

const TokenContext = createContext<TokenContextType | undefined>(undefined);

export const useTokenContext = () => {
  const ctx = useContext(TokenContext);
  if (!ctx) throw new Error("useTokenContext must be used within TokenProvider");
  return ctx;
};

export const TokenProvider = ({ children }: { children: React.ReactNode }) => {
  const { network }:any = useDynamicContext();
  const [chain, setChain] = useState<string | null>('');
  const [marketTokens, setMarketTokens] = useState<any[]>([]);
  const [bundles, setBundles]:any = useState({});
  const [stockBundles, setStockBundles]:any = useState({});
  const [stockTokens,setStockTokens] = useState<any[]>([]);

  const stockTagMap = new Map(
    stockList.map((s: any) => [s.address.toLowerCase(), s.tag])
  );

  useEffect(() => {
    const networkObj=getNetworkById(network)
    setChain(networkObj?.value || '');
  }, [network]);

  //console.log("Current chain:", chain,network);

  useEffect(() => {
    const fetchMarketTokens = async () => {
      if (!chain) return;

      try {
        const res = await fetch(
          `https://api.coinranking.com/v2/coins?blockchains[]=${chain}&limit=100`,
          {
            headers: {
              Accept: "application/json",
            },
          }
        );

        if (!res.ok) {
          console.error("Error fetching market tokens:", res.statusText);
          return;
        }

        const data = await res.json();
        const uniqueTokens = Array.from(
          new Map(
            (data?.data?.coins || []).map((t: any) => {
              const address = getAddressForChain(
                t.contractAddresses,
                chain
              )?.toLowerCase() || "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee";
              // Try to get tag from stock.ts, fallback to t.tag
              const tag = stockTagMap.get(address) || t.tag;
              return [
                t.uuid,
                {
                  ...t,
                  address,
                  tag,
                },
              ];
            })
          ).values()
        );

        setMarketTokens(uniqueTokens || []);
        console.log("Fetched market tokens:", uniqueTokens);
        let bundles = getCoinBundles(uniqueTokens || []);
        setBundles(bundles);
      } catch (err) {
        console.error("Failed to fetch market tokens:", err);
      }
    };

    fetchMarketTokens();
  }, [chain]);

  useEffect(() => {
    const fetchStockMarketTokens = async () => {
      if (chain!=='ethereum') return;

      try {
        const res = await fetch(
          `https://api.coinranking.com/v2/coins?blockchains[]=${chain}&tags[]=stocks&limit=100`,
          {
            headers: {
              Accept: "application/json",
            },
          }
        );

        if (!res.ok) {
          console.error("Error fetching market tokens:", res.statusText);
          return;
        }

        const data = await res.json();
        const uniqueTokens = Array.from(
          new Map(
            (data?.data?.coins || []).map((t: any) => {
              const address = getAddressForChain(
                t.contractAddresses,
                chain
              )?.toLowerCase() || "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee";
              // Try to get tag from stock.ts, fallback to t.tag
              const tag = stockTagMap.get(address) || t.tag;
              return [
                t.uuid,
                {
                  ...t,
                  address,
                  tag,
                },
              ];
            })
          ).values()
        );

        setStockTokens(uniqueTokens?.filter((item:any)=>{
            return item?.price!=null
        }) || []);
        let bundles = getCoinBundles(uniqueTokens || []);
        let tagBundles = getStockBundlesByTag(uniqueTokens || []);
        //console.log("Fetched stock bundles:", [...bundles, ...tagBundles]);
        setStockBundles([...bundles, ...tagBundles]);
      } catch (err) {
        console.error("Failed to fetch market tokens:", err);
      }
    };

    fetchStockMarketTokens();
  }, [chain]);

  return (
    <TokenContext.Provider value={{ chain, marketTokens, bundles, setChain,stockBundles,stockTokens }}>
      {children}
    </TokenContext.Provider>
  );
};