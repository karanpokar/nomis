"use client";
import React, { createContext, useContext, useState, ReactNode, useEffect, useRef, useCallback, useMemo } from "react";
import { ethers } from "ethers";
import { isZeroDevConnector } from "@dynamic-labs/ethereum-aa";
import { parseUnits } from "viem";
import { useTokenContext } from "./TokenContext";

// Minimal ERC20 ABI (allowance, approve, decimals, balanceOf)
const ERC20_ABI = [
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function allowance(address owner, address spender) external view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function balanceOf(address owner) view returns (uint256)",
];

export type Token = {
  address: string;
  symbol: string;
  name?: string;
  decimals?: number;
  price?: number;
  iconUrl?: string;
  amount?: string;
};

export type QuoteResponse = any | null;
export type AssembleResponse = any | null;

export type ExecuteOptions = {
  approveBefore?: boolean;
  quoteType?: "buy" | "sell" | "perToken";
  tokenAddress?: string;
  assembled?: any; // optional assembled transaction override
};

export type StableSymbol = "USDC" | "USDT" | "PYUSD";

export type SwapContextType = {
  buyTokens: Token[];
  sellTokens: Token[];
  amounts: Record<string, string>;
  buyQuote: QuoteResponse;
  sellQuote: QuoteResponse;
  perTokenQuotes: Record<string, QuoteResponse>;
  assembledTx: AssembleResponse;
  loading: boolean;
  error: string | null;
  defaultBuyToken: Token | null;
  defaultSellToken: Token | null;

  // new multi-stable state
  buyInputStable: StableSymbol;
  sellOutputStable: StableSymbol;
  setBuyInputStable: (s: StableSymbol) => void;
  setSellOutputStable: (s: StableSymbol) => void;
  stableOptions: Array<{ symbol: StableSymbol; address: string }>;

  addBuyToken: (token: Token) => void;
  addSellToken: (token: Token) => void;
  removeBuyToken: (address: string) => void;
  removeSellToken: (address: string) => void;
  updateAmount: (address: string, amount: string) => void;
  clearCart: () => void;

  getQuote: (mode?: "buy" | "sell" | "perToken", options?: { slippage?: number; tokenAddress?: string }) => Promise<void>;
  assembleTransaction: (options?: { simulate?: boolean; quoteType?: "buy" | "sell" | "perToken"; tokenAddress?: string }) => Promise<any | null>;
  executeSwap: (options?: ExecuteOptions) => Promise<string | null>;
};

const SwapContext = createContext<SwapContextType | undefined>(undefined);

const ODOS_BASE = "https://api.odos.xyz";

export const SwapProvider = ({ children }: { children: ReactNode }) => {
  // adapt this to your project: useUser should return selectedChain, primaryWallet { address }, tokens[], provider (ethers provider)
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const UserContext = require("./UserContext");
  const { useUser } = UserContext;
  const { selectedChain, primaryWallet, tokens, provider } = useUser();

  // state
  const [buyTokens, setBuyTokens] = useState<Token[]>([]);
  const { marketTokens } = useTokenContext();
  const [sellTokens, setSellTokens] = useState<Token[]>([]);
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [buyQuote, setBuyQuote] = useState<QuoteResponse>(null);
  const [sellQuote, setSellQuote] = useState<QuoteResponse>(null);
  const [perTokenQuotes, setPerTokenQuotes] = useState<Record<string, QuoteResponse>>({});
  const [assembledTx, setAssembledTx] = useState<AssembleResponse>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // defaults
  const [defaultBuyToken, setDefaultBuyToken] = useState<Token | null>(null);
  const [defaultSellToken, setDefaultSellToken] = useState<Token | null>(null);

  // multi-stable selectors (defaults)
  const [buyInputStable, setBuyInputStable] = useState<StableSymbol>("USDC");
  const [sellOutputStable, setSellOutputStable] = useState<StableSymbol>("USDC");

  // refs
  const quoteAbortRef = useRef<AbortController | null>(null);
  const debounceRef = useRef<number | null>(null);
  const MAX_CART = 5;

  // ---------------- utilities ----------------
  function toUnits(amount: string | number, decimals = 18): bigint {
    try {
      return ethers.parseUnits(String(amount || "0"), decimals);
    } catch (e) {
      return 0n;
    }
  }

  function fromUnits(value: bigint, decimals = 18): string {
    try {
      return ethers.formatUnits(value, decimals);
    } catch (e) {
      return "0";
    }
  }

  function getTokenObj(address: string) {
    return marketTokens?.find((t: any) => t.address?.toLowerCase() === address?.toLowerCase());
  }

  // ---------- Multi-stable helpers ----------
  function findTokenBySymbol(symbol: StableSymbol, searchList?: Array<any>) {
    const list = searchList ?? marketTokens;
    if (!list || !Array.isArray(list)) return null;
    return (
      list.find((t: any) => (t?.symbol || "").toUpperCase() === symbol) || null
    );
  }

  const STABLE_FALLBACKS: Record<number, Partial<Record<StableSymbol, string>>> = {
    1: { // Ethereum
      USDC: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
      USDT: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
      PYUSD: "0x6c3ea9036406852006290770BEdFcAbA0e23A0e8",
    },
    10: { // Optimism
      USDC: "0x7F5c764cBc14f9669B88837ca1490cCa17c31607",
      USDT: "0x94b008aA00579c1307B0EF2c499aD98a8ce58e58",
    },
    42161: { // Arbitrum
      USDC: "0xaf88d065e77c8cc2239327c5edb3a432268e5831",
      USDT: "0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9",
    },
    8453: { // Base
      USDC: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
      USDT: "0x2f0C1cE59F0bA5C67C5C7f3a52f1dC1D9B9aCe04", // verify for your setup
    },
    137: { // Polygon
      USDC: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359",
      USDT: "0xc2132D05D31c914a87C6611C10748AEb04B58e8F",
    },
    56: { // BSC
      USDC: "0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d",
      USDT: "0x55d398326f99059ff775485246999027b3197955",
    },
    43114: { // Avalanche
      USDC: "0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E",
      USDT: "0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7",
    },
    250: { // Fantom
      USDC: "0x04068DA6C83AFCFA0e13ba15A6696662335D5B75",
      USDT: "0x049d68029688eAbF473097a2fC38ef61633A3C7A",
    },
    42220: { // Celo
      USDC: "0xcebA9300f2b948710d2653dD7B07f33A8B32118C",
      USDT: "0x617f3112bf5397D0467D315cC709EF968D9ba546", // example/placeholder
    },
    324: { // zkSync
      USDC: "0x1d17CBcF0D6D143135aE902365D2E5e2A16538D4",
      // USDT may differ / be unsupported — add if applicable
    },
  };

  function getStableAddressForChain(chainId: number | string, symbol: StableSymbol, marketTokensParam?: Array<any>) {
    const inList = findTokenBySymbol(symbol, marketTokensParam);
    if (inList?.address) return inList.address;
    const id = Number(chainId);
    return STABLE_FALLBACKS[id]?.[symbol] || "";
  }

  function getStableOptionsForChain(chainId: number | string) {
    const symbols: StableSymbol[] = ["USDC", "USDT", "PYUSD"];
    const id = Number(chainId);
    return symbols
      .map((sym) => {
        const addr = getStableAddressForChain(id, sym);
        return addr ? { symbol: sym, address: addr } : null;
      })
      .filter(Boolean) as Array<{ symbol: StableSymbol; address: string }>;
  }

  // set defaults when tokens update
  useEffect(() => {
    if (marketTokens && marketTokens.length > 0) {
      const usdcToken = marketTokens.find((t: any) => t.symbol?.toUpperCase() === "USDC") || marketTokens[0];
      setDefaultBuyToken(usdcToken ?? null);
      setDefaultSellToken(usdcToken ?? null);
    }
  }, [marketTokens]);

  // ---------------- quote normalization helper ----------------
  const normalizeOdosQuote = (data: any, chainId: number | string, preferredOutputAddr?: string) => {
    const normalized: any = { raw: data };

    try {
      // gasEstimateValue
      if (data?.gasEstimateValue !== undefined && data?.gasEstimateValue !== null) {
        normalized.gasEstimateValue = Number(data.gasEstimateValue);
      } else if (data?.gasEstimate !== undefined && data?.gasEstimate !== null) {
        normalized.gasEstimateValue = Number(data.gasEstimateValue ?? 0);
      } else {
        normalized.gasEstimateValue = 0;
      }

      // decimals for preferred output token
      const outAddr = (preferredOutputAddr || "").toLowerCase();
      let outDecimals = 18;
      if (outAddr) {
        const tok = getTokenObj(preferredOutputAddr!);
        outDecimals = Number(tok?.decimals ?? 6);
      }

      // netOutValue
      if (Array.isArray(data?.outputTokens) && data.outputTokens.length > 0) {
        const chosen = data.outputTokens.find((o: any) => (o?.tokenAddress || "").toLowerCase() === outAddr) || data.outputTokens[0];
        if (chosen && chosen.amount !== undefined && chosen.amount !== null) {
          try {
            const outBig = BigInt(String(chosen.amount));
            normalized.netOutValue = Number(ethers.formatUnits(outBig, outDecimals));
          } catch {
            normalized.netOutValue = Number(chosen.amount) / Math.pow(10, outDecimals);
          }
        } else {
          normalized.netOutValue = Number(data?.netOutValue ?? 0);
        }
      } else if (data?.netOutValue !== undefined && data?.netOutValue !== null) {
        normalized.netOutValue = Number(data.netOutValue);
      } else {
        normalized.netOutValue = 0;
      }

      // outValues
      if (Array.isArray(data?.outValues)) {
        normalized.outValues = data.outValues.map((v: any) => {
          const n = Number(v);
          return Number.isFinite(n) ? n : parseFloat(String(v)) || 0;
        });
      } else {
        normalized.outValues = [];
      }

      // inputTokens (human)
      normalized.inputTokens = (data.inputTokens || data.inputs || []).map((it: any) => {
        const tokenAddr = it.tokenAddress || it.token || it.token_addr;
        const tokenObj = tokenAddr ? getTokenObj(tokenAddr) : undefined;
        const dec = Number(tokenObj?.decimals ?? it.decimals ?? 18);
        let human = 0;
        try {
          if (it.amount !== undefined && it.amount !== null) {
            human = Number(ethers.formatUnits(BigInt(String(it.amount)), dec));
          }
        } catch {
          human = Number(it.amount) / Math.pow(10, dec);
        }
        return { ...it, humanAmount: human };
      });

      normalized.pathId = data.pathId ?? data.id ?? data.quoteId ?? data.path?.id;
    } catch (err) {
      console.warn("normalizeOdosQuote failed", err);
      normalized.gasEstimateValue = Number(data?.gasEstimateValue ?? data?.gasEstimate ?? 0);
      normalized.netOutValue = Number(data?.netOutValue ?? 0);
      normalized.outValues = data?.outValues || [];
      normalized.inputTokens = data?.inputTokens || [];
    }

    return normalized;
  };

  // ---------------- cart ops ----------------
  const addBuyToken = (token: Token) => {
    setBuyTokens((prev) => {
      if (prev.find((t) => t.address.toLowerCase() === token.address.toLowerCase())) return prev;
      if (prev.length >= MAX_CART) return prev;
      return [...prev, { ...token, amount: token.amount ?? "" }];
    });
  };

  const addSellToken = (token: Token) => {
    setSellTokens((prev) => {
      if (prev.find((t) => t.address.toLowerCase() === token.address.toLowerCase())) return prev;
      if (prev.length >= MAX_CART) return prev;
      return [...prev, { ...token, amount: token.amount ?? "" }];
    });
  };

  const removeBuyToken = (address: string) => {
    setBuyTokens((prev) => prev.filter((t) => t.address.toLowerCase() !== address.toLowerCase()));
    setAmounts((prev) => {
      const copy = { ...prev };
      delete copy[address];
      return copy;
    });
  };

  const removeSellToken = (address: string) => {
    setSellTokens((prev) => prev.filter((t) => t.address.toLowerCase() !== address.toLowerCase()));
  };

  const updateAmount = (address: string, amount: string) => {
    setAmounts((prev) => ({ ...prev, [address]: amount }));
  };

  const clearCart = () => {
    setBuyTokens([]);
    setSellTokens([]);
    setAmounts({});
    setBuyQuote(null);
    setSellQuote(null);
    setPerTokenQuotes({});
    setAssembledTx(null);
    setError(null);
  };

  // ---------------- quoting ----------------
  const getQuote = useCallback(
    async (mode: "buy" | "sell" | "perToken" = "buy", options?: { slippage?: number; tokenAddress?: string }) => {
      setLoading(true);
      setError(null);
      if (quoteAbortRef.current) quoteAbortRef.current.abort();
      quoteAbortRef.current = new AbortController();
      const signal = quoteAbortRef.current.signal;

      try {
        if (!selectedChain || !primaryWallet?.address) throw new Error("chain or wallet missing");

        if (mode === "buy") {
  // --- config: flip to true to force equal-weight always ---
  const forceEqualWeight = false;

  // helpers (unchanged)
  const parseDecimal = (s: string) => {
    if (s === undefined || s === null) return { int: 0n, scale: 1n };
    const str = String(s).trim();
    if (str === "") return { int: 0n, scale: 1n };
    if (!str.includes(".")) return { int: BigInt(str), scale: 1n };
    const [whole, frac] = str.split(".");
    const combined = (whole || "0") + (frac || "");
    const int = BigInt(combined.replace(/^0+/, "") || "0");
    const scale = BigInt(10) ** BigInt(frac.length);
    return { int, scale };
  };

  const mulDecimalToBigInt = (aStr: string, bStr: string, targetScale: bigint) => {
    const a = parseDecimal(aStr);
    const b = parseDecimal(bStr);
    const productInt = a.int * b.int;
    const productScale = a.scale * b.scale;
    // banker-ish rounding to nearest
    const numerator = productInt * targetScale + productScale / 2n;
    return numerator / productScale;
  };

  const updated = buyTokens.map((t) => ({
    ...t,
    amount: String(amounts[t.address] ?? t.amount ?? "0"),
  }));
  if (updated.length === 0) { setBuyQuote(null); setLoading(false); return; }

  const inAddr = getStableAddressForChain(selectedChain?.chainId, buyInputStable);
  if (!inAddr) throw new Error(`${buyInputStable} address not found for chain`);
  const inTok = getTokenObj(inAddr);
  const inDecimals = Number(inTok?.decimals ?? 6);
  const UNIT = 10n ** BigInt(inDecimals); // scale of input stable

  // Determine if amounts are all equal (treat empty/0 as 0)
  const nonZero = updated.map(t => String(t.amount ?? "0"));
  const allEqual = nonZero.every(v => v === nonZero[0]);

  // Option A: equal-weight proportions (ignore prices)
  if (forceEqualWeight || (allEqual && updated.length > 0)) {
    const n = BigInt(updated.length);
    const SCALE = 10n ** 18n;             // proportions scale (18 decimals)
    const base = SCALE / n;
    const parts: bigint[] = new Array(updated.length).fill(base);
    // fix remainder so sum == 1
    const used = base * n;
    if (used < SCALE) parts[parts.length - 1] += (SCALE - used);

    // input amount: if you still want to compute from amounts×price, do that here;
    // otherwise you may want to accept a separate "budget" input. We’ll keep your
    // current behavior (use amounts×price to derive total spend).
    let totalUnits = 0n;
    for (const t of updated) {
      const units = mulDecimalToBigInt(String(t.amount ?? "0"), String(t.price ?? "0"), UNIT);
      totalUnits += units;
    }
    if (totalUnits <= 0n) { setBuyQuote(null); setLoading(false); throw new Error("missing price or amount data for tokens"); }

    const outputTokens = parts.map((p, i) => {
      // send as number with 18-dec precision; alternatively send string "0.xxxxxx"
      const proportion = Number(p) / Number(SCALE);
      return { tokenAddress: updated[i].address, proportion };
    });

    const body = {
      chainId: Number(selectedChain?.chainId),
      compact: true,
      inputTokens: [{ tokenAddress: inAddr, amount: totalUnits.toString() }],
      outputTokens,
      slippageLimitPercent: options?.slippage ?? 0.5,
      userAddr: primaryWallet.address,
      referralCode: 0,
    };

    const res = await fetch(`${ODOS_BASE}/sor/quote/v2`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body), signal,
    });
    if (!res.ok) throw new Error(`Odos buy quote failed: ${await res.text()}`);
    const data = await res.json();
    const normalized = normalizeOdosQuote(data, selectedChain?.chainId);
    setBuyQuote(normalized);
    setLoading(false);
    return;
  }

  // Option B: value-weighted (amount × price), your original intent
  const perTokenUnits: Array<{ token: any; units: bigint }> = [];
  for (const t of updated) {
    const amountStr = String(t.amount ?? "0");
    const priceStr = String(t.price ?? "0");
    const units = mulDecimalToBigInt(amountStr, priceStr, UNIT);
    perTokenUnits.push({ token: t, units });
  }

  const totalUnits = perTokenUnits.reduce((acc, x) => acc + (x.units ?? 0n), 0n);
  if (totalUnits <= 0n) {
    setBuyQuote(null); setLoading(false);
    throw new Error("missing price or amount data for tokens");
  }

  // proportions in 18-dec fixed-point, normalized to sum==1
  const SCALE = 10n ** 18n;
  const parts: bigint[] = perTokenUnits.map((p) => (p.units * SCALE) / totalUnits);
  const sumParts = parts.reduce((a, b) => a + b, 0n);
  const remainder = SCALE - sumParts;
  if (remainder !== 0n) parts[parts.length - 1] += remainder;

  // prefer sending as numbers; ensure the last one fixes any float error
  let running = 0;
  const outputTokens = parts.map((p, idx) => {
    const asNum = Number(p) / Number(SCALE);
    if (idx < parts.length - 1) {
      running += asNum;
      return { tokenAddress: perTokenUnits[idx].token.address, proportion: asNum };
    } else {
      // force exact 1.0 total in JS float world
      const last = Math.max(0, 1 - running);
      return { tokenAddress: perTokenUnits[idx].token.address, proportion: last };
    }
  });

  const body = {
    chainId: Number(selectedChain?.chainId),
    compact: true,
    inputTokens: [{ tokenAddress: inAddr, amount: totalUnits.toString() }],
    outputTokens,
    slippageLimitPercent: options?.slippage ?? 0.5,
    userAddr: primaryWallet.address,
    referralCode: 0,
  };

  const res = await fetch(`${ODOS_BASE}/sor/quote/v2`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body), signal,
  });

  if (!res.ok) throw new Error(`Odos buy quote failed: ${await res.text()}`);
  const data = await res.json();
  const normalized = normalizeOdosQuote(data, selectedChain?.chainId);
  setBuyQuote(normalized);
  setLoading(false);
  return;
}


        if (mode === "sell") {
          const inputs: { tokenAddress: string; amount: string }[] = [];
          for (const t of sellTokens) {
            const amtStr = t.amount ?? amounts[t.address] ?? "0";
            const amtNum = Number(amtStr || 0);
            if (!amtNum || isNaN(amtNum) || amtNum <= 0) continue;
            const tokenObj = getTokenObj(t.address);
            const decimals = tokenObj?.decimals ?? t.decimals ?? 6;
            const units = parseUnits(amtStr as `${number}`, decimals as any).toString();
            inputs.push({ tokenAddress: t.address, amount: units });
          }
          if (inputs.length === 0) { setSellQuote(null); setLoading(false); return; }

          const outAddr = getStableAddressForChain(selectedChain?.chainId, sellOutputStable);
          if (!outAddr) throw new Error(`${sellOutputStable} address not found for chain`);

          const body = {
            chainId: Number(selectedChain?.chainId),
            compact: true,
            inputTokens: inputs,
            outputTokens: [{ tokenAddress: outAddr, proportion: 1 }],
            slippageLimitPercent: options?.slippage ?? 0.5,
            userAddr: primaryWallet.address,
            referralCode: 0,
          };

          const res = await fetch(`${ODOS_BASE}/sor/quote/v2`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
            signal,
          });

          if (!res.ok) throw new Error(`Odos sell quote failed: ${await res.text()}`);
          const data = await res.json();
          const normalized = normalizeOdosQuote(data, selectedChain?.chainId, outAddr);
          setSellQuote(normalized);
          setLoading(false);
          return;
        }

        if (mode === "perToken") {
          const tokenAddress = options?.tokenAddress;
          if (!tokenAddress) throw new Error("tokenAddress required");

          const desired = Number(amounts[tokenAddress] ?? 1);
          const tokenObj = getTokenObj(tokenAddress);
          const decimals = tokenObj?.decimals ?? 18;
          const inAddr = getStableAddressForChain(selectedChain?.chainId, buyInputStable);
          if (!inAddr) throw new Error(`${buyInputStable} address not found for chain`);

          const oneTokenUnits = toUnits(desired, decimals).toString();

          const body = {
            chainId: Number(selectedChain?.chainId),
            compact: true,
            inputTokens: [{ tokenAddress: inAddr, amount: oneTokenUnits }],
            outputTokens: [{ tokenAddress: tokenAddress, proportion: 1 }],
            slippageLimitPercent: options?.slippage ?? 0.5,
            userAddr: primaryWallet.address,
            referralCode: 0,
          };

          const res = await fetch(`${ODOS_BASE}/sor/quote/v2`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
            signal,
          });

          if (!res.ok) throw new Error(`Odos perToken quote failed: ${await res.text()}`);
          const data = await res.json();
          const normalized = normalizeOdosQuote(data, selectedChain?.chainId);
          setPerTokenQuotes((prev) => ({ ...(prev || {}), [tokenAddress]: normalized }));
          setLoading(false);
          return;
        }
      } catch (err: any) {
        if (err?.name === "AbortError") return;
        console.error(err);
        setError(err?.message || String(err));
        setLoading(false);
      }
    },
    [buyTokens, sellTokens, amounts, primaryWallet, selectedChain, marketTokens, buyInputStable, sellOutputStable]
  );

  // debounce quotes
  useEffect(() => {
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => {
      if (buyTokens.length > 0) getQuote("buy");
      else if (sellTokens.length > 0) getQuote("sell");
    }, 500);

    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, [amounts, buyTokens, sellTokens, getQuote]);

  // ---------------- assemble ----------------
  const assembleTransaction = useCallback(
    async (options?: { simulate?: boolean; quoteType?: "buy" | "sell" | "perToken"; tokenAddress?: string }) => {
      try {
        setLoading(true);
        setError(null);
        if (!selectedChain || !primaryWallet?.address) throw new Error("chain or wallet missing");

        const quoteToUse = options?.quoteType === "sell"
          ? sellQuote
          : options?.quoteType === "perToken" && options?.tokenAddress
            ? perTokenQuotes[options.tokenAddress]
            : buyQuote;
        if (!quoteToUse) throw new Error("requested quote not available");

        const pathId = quoteToUse.pathId || quoteToUse.id || quoteToUse.quoteId || quoteToUse.path?.id;
        if (!pathId) throw new Error("quote missing id");

        const body = { userAddr: primaryWallet.address, pathId, simulate: options?.simulate ?? true };

        const res = await fetch(`${ODOS_BASE}/sor/assemble`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error(`Assemble failed: ${await res.text()}`);

        const data = await res.json();
        setAssembledTx(data);
        setLoading(false);
        return data;
      } catch (err: any) {
        console.error(err);
        setError(err.message || String(err));
        setAssembledTx(null);
        setLoading(false);
        return null;
      }
    },
    [buyQuote, sellQuote, perTokenQuotes, primaryWallet, selectedChain]
  );

  // ---------------- approvals & execute ----------------
  async function ensureAllowance(signer: ethers.Signer, tokenAddress: string, owner: string, spender: string, requiredAmount: bigint) {
    const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, signer.provider || signer);
    const tokenWithSigner = tokenContract.connect(signer);
    const current: bigint = await tokenContract.allowance(owner, spender);
    if (current >= requiredAmount) return null;
    if (current !== 0n) {
      // @ts-ignore
      const tx0 = await tokenWithSigner.approve(spender, 0n);
      await tx0.wait(1);
    }
    // @ts-ignore
    const tx1 = await tokenWithSigner.approve(spender, requiredAmount);
    await tx1.wait(1);
    return tx1;
  }

  const executeSwap = useCallback(
    async (options?: ExecuteOptions) => {
      setLoading(true);
      setError(null);

      try {
        const assembledFull = options?.assembled ?? assembledTx;
        if (!assembledFull) throw new Error("No assembled tx; call assembleTransaction first (or pass assembled in options)");

        const swapTxObj = assembledFull.transaction ?? assembledFull.tx ?? assembledFull;
        const toAddress = swapTxObj.to || swapTxObj.router || swapTxObj.spender || swapTxObj.txTo || swapTxObj.tx?.to;
        const calldata = swapTxObj.data || swapTxObj.calldata || swapTxObj.tx?.data || swapTxObj.txData || swapTxObj.encoded || swapTxObj.txData?.data;
        let value: bigint = 0n;
        try {
          if (swapTxObj.value !== undefined && swapTxObj.value !== null) {
            const v = String(swapTxObj.value);
            value = v.startsWith("0x") ? BigInt(v) : BigInt(v);
          }
        } catch {
          value = 0n;
        }

        if (!toAddress || !calldata) throw new Error("assemble response missing to/data");

        const quoteToUse = options?.quoteType === "sell"
          ? sellQuote
          : options?.quoteType === "perToken" && options?.tokenAddress
            ? perTokenQuotes[options.tokenAddress]
            : buyQuote;

        const assembledApprovalRaw = assembledFull.approvalData ?? assembledFull.approval ?? assembledFull.approvals;
        const assembledInputTokens = assembledFull.inputTokens ?? assembledFull.inputs ?? assembledFull.transaction?.inputTokens;
        const quoteApprovalRaw = quoteToUse?.approvalData ?? quoteToUse?.approval ?? quoteToUse?.approvals;
        const quoteInputTokens = quoteToUse?.inputTokens;

        const approvals: Array<{ tokenAddress: string; spender: string; amount: bigint }> = [];
        const MAX_UINT256 = (1n << 256n) - 1n;

        const pushApproval = (tokenAddress: any, spender: any, _amountRaw?: any) => {
          if (!tokenAddress || !spender) return;
          approvals.push({ tokenAddress: String(tokenAddress), spender: String(spender), amount: MAX_UINT256 });
        };

        if (Array.isArray(assembledApprovalRaw) && assembledApprovalRaw.length > 0) {
          for (let i = 0; i < Math.min(5, assembledApprovalRaw.length); i++) {
            const a = assembledApprovalRaw[i];
            const tokenAddress = a.tokenAddress ?? a.token ?? a.token_addr;
            const spender = a.spenderAddress ?? a.spender ?? a.spender_addr ?? a.spenderAddress ?? toAddress;
            pushApproval(tokenAddress, spender, a.amount);
          }
        } else if (assembledApprovalRaw && typeof assembledApprovalRaw === "object") {
          const a = assembledApprovalRaw;
          const tokenAddress = a.tokenAddress ?? a.token ?? a.token_addr;
          const spender = a.spenderAddress ?? a.spender ?? a.spender_addr ?? a.spenderAddress ?? toAddress;
          pushApproval(tokenAddress, spender, a.amount);
        } else if (Array.isArray(assembledInputTokens) && assembledInputTokens.length > 0) {
          for (let i = 0; i < Math.min(5, assembledInputTokens.length); i++) {
            const it = assembledInputTokens[i];
            if (!it?.tokenAddress || !it?.amount) continue;
            pushApproval(it.tokenAddress, toAddress, it.amount);
          }
        } else if (Array.isArray(quoteApprovalRaw) && quoteApprovalRaw.length > 0) {
          for (let i = 0; i < Math.min(5, quoteApprovalRaw.length); i++) {
            const a = quoteApprovalRaw[i];
            const tokenAddress = a.tokenAddress ?? a.token ?? a.token_addr;
            const spender = a.spenderAddress ?? a.spender ?? a.spender_addr ?? a.spenderAddress ?? toAddress;
            pushApproval(tokenAddress, spender, a.amount);
          }
        } else if (Array.isArray(quoteInputTokens) && quoteInputTokens.length > 0) {
          for (let i = 0; i < Math.min(5, quoteInputTokens.length); i++) {
            const it = quoteInputTokens[i];
            if (!it?.tokenAddress || !it?.amount) continue;
            pushApproval(it.tokenAddress, toAddress, it.amount);
          }
        }

        const connector = (primaryWallet as any).connector;
        if (connector && isZeroDevConnector(connector)) {
          try {
            const kernelClient: any = connector.getAccountAbstractionProvider({ withSponsorship: true });

            const calls: { to: string; data: string; value?: bigint }[] = [];
            const erc20Interface = new ethers.Interface(ERC20_ABI);

            const canReadAllowance = !!provider;

            for (const ap of approvals) {
              const required = ap.amount && ap.amount > 0n ? ap.amount : ((1n << 256n) - 1n);
              let currentAllowance: bigint = 0n;
              if (canReadAllowance) {
                try {
                  const tokenContract = new ethers.Contract(ap.tokenAddress, ERC20_ABI, provider);
                  currentAllowance = await tokenContract.allowance(primaryWallet.address, ap.spender);
                } catch (e) {
                  console.warn("Allowance read failed; will include approve for", ap.tokenAddress, ap.spender, e);
                  currentAllowance = 0n;
                }
              }
              if (currentAllowance < required) {
                const approveCalldata = erc20Interface.encodeFunctionData("approve", [ap.spender, required]);
                calls.push({ to: ap.tokenAddress, data: approveCalldata, value: 0n });
              }
            }

            calls.push({ to: toAddress, data: calldata, value: value ?? 0n });
            const encoded = await kernelClient.account.encodeCalls(
              calls.map((c) => ({ data: c.data, to: c.to, value: c.value ?? 0n }))
            );
            const userOpHash = await kernelClient.sendUserOperation({ callData: encoded });
            setLoading(false);
            return userOpHash;
          } catch (aaErr) {
            console.error("Account abstraction path failed, falling back to signer tx:", aaErr);
          }
        }

        // Non-AA fallback
        if (options?.approveBefore) {
          const inputTokens: { tokenAddress: string; amount: string }[] = quoteToUse?.inputTokens || assembledFull.inputTokens || [];
          for (const inp of inputTokens) {
            if (!inp?.tokenAddress || !inp?.amount) continue;
            const required = BigInt(inp.amount);
            const signer = provider ? provider.getSigner(primaryWallet.address) : null;
            if (!signer) throw new Error("signer/provider required for non-AA approvals");
            await ensureAllowance(signer, inp.tokenAddress, primaryWallet.address, toAddress, required);
          }
        }

        const signer = provider ? provider.getSigner(primaryWallet.address) : null;
        if (!signer) throw new Error("provider/signers required to send transaction");

        const txReq: any = { to: toAddress, data: calldata };
        if (value && value !== 0n) txReq.value = value;

        const tx = await signer.sendTransaction(txReq);
        await tx.wait(1);
        setLoading(false);
        return tx.hash;
      } catch (err: any) {
        console.error(err);
        setError(err.message || String(err));
        setLoading(false);
        return null;
      }
    },
    [assembledTx, buyQuote, sellQuote, perTokenQuotes, primaryWallet, provider]
  );

  // compute stable options for current chain
  const stableOptions = useMemo(
    () => (selectedChain?.chainId ? getStableOptionsForChain(selectedChain.chainId) : []),
    [selectedChain?.chainId, marketTokens]
  );

  // ---------------- provider value ----------------
  return (
    <SwapContext.Provider
      value={{
        buyTokens,
        sellTokens,
        amounts,
        buyQuote,
        sellQuote,
        perTokenQuotes,
        assembledTx,
        loading,
        error,
        defaultBuyToken,
        defaultSellToken,

        // multi-stable
        buyInputStable,
        sellOutputStable,
        setBuyInputStable,
        setSellOutputStable,
        stableOptions,

        addBuyToken,
        addSellToken,
        removeBuyToken,
        removeSellToken,
        updateAmount,
        clearCart,

        getQuote,
        assembleTransaction,
        executeSwap,
      }}
    >
      {children}
    </SwapContext.Provider>
  );
};

export const useSwap = () => {
  const ctx = useContext(SwapContext);
  if (!ctx) throw new Error("useSwap must be used within SwapProvider");
  return ctx;
};