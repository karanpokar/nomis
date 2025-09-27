"use client";
import React, { createContext, useContext, useState, ReactNode, useEffect, useRef, useCallback } from "react";
import { ethers } from "ethers";
import { isZeroDevConnector } from "@dynamic-labs/ethereum-aa";
//import { useMarket } from "./MarketContext";
import { parseUnits } from "viem";
import { useTokenContext } from "./TokenContext";

// Minimal ERC20 ABI (allowance, approve, decimals, balanceOf)
const ERC20_ABI = [
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function allowance(address owner, address spender) external view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function balanceOf(address owner) view returns (uint256)",
];

type Token = {
  address: string;
  symbol: string;
  name?: string;
  decimals?: number;
  price?: number;
  iconUrl?: string;
  amount?: string;
};

type QuoteResponse = any | null;
type AssembleResponse = any | null;

type ExecuteOptions = {
  approveBefore?: boolean;
  quoteType?: "buy" | "sell" | "perToken";
  tokenAddress?: string;
  // NEW: optional assembled transaction override to avoid state race
  assembled?: any;
};

type SwapContextType = {
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

  function getUsdcAddressForChain(chainId: number | string, marketTokensParam?: Array<any>) {
    // prefer dynamic token list if provided
    const searchList = marketTokensParam ?? marketTokens;
    if (searchList && Array.isArray(searchList)) {
      const found = searchList.find((x: any) => x?.symbol === "USDC" || x?.symbol === "USDC.e" || x?.symbol?.toLowerCase() === "usdc");
      if (found && found.address) {
        console.debug("USDC found in marketTokens:", found.address);
        return found.address;
      }
    }

    const id = Number(chainId);
    const fallback: Record<number, string> = {
      1: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
      10: "0x7F5c764cBc14f9669B88837ca1490cCa17c31607",
      42161: "0xaf88d065e77c8cc2239327c5edb3a432268e5831",
      324: "0x1d17CBcF0D6D143135aE902365D2E5e2A16538D4",
      59144: "0x176211869cA2b568f2A7D4EE941E073a821EE1ff",
      8453: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
      137: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359",
      56: "0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d",
      43114: "0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E",
      250: "0x04068DA6C83AFCFA0e13ba15A6696662335D5B75",
      100: "0xDdAFbb505ad214D7B80b1f830Fccc89b60Fb7A83",
      42220: "0xcebA9300f2b948710d2653dD7B07f33A8B32118C",
      25: "0xc21223249CA28397B4B6541d8d8B6f8C8bA8F8c0",
      1285: "0x818ec0A7Fe18Ff94269904fCED6AE3DaE6d6dC0b",
    };

    const addr = fallback[id] || "";
    if (!addr) console.warn(`USDC address not found for chain ${chainId}. Please add to mapping or ensure marketTokens contains USDC for this chain.`);
    return addr;
  }

  // set defaults when tokens update
  useEffect(() => {
    if (marketTokens && marketTokens.length > 0) {
      const usdcToken = marketTokens.find((t: any) => t.symbol === "USDC") || marketTokens[0];
      setDefaultBuyToken(usdcToken ?? null);
      setDefaultSellToken(usdcToken ?? null);
    }
  }, [marketTokens]);

  // ---------------- quote normalization helper ----------------
  const normalizeOdosQuote = (data: any, chainId: number | string) => {
    // Keep raw copy for debugging
    const normalized: any = { raw: data };

    try {
      // gasEstimateValue: prefer direct numeric, otherwise fall back to gasEstimate
      if (data?.gasEstimateValue !== undefined && data?.gasEstimateValue !== null) {
        normalized.gasEstimateValue = Number(data.gasEstimateValue);
      } else if (data?.gasEstimate !== undefined && data?.gasEstimate !== null) {
        // gasEstimate may be gas units; but we don't know native price — leave as is or set to 0
        normalized.gasEstimateValue = Number(data.gasEstimateValue ?? 0);
      } else {
        normalized.gasEstimateValue = 0;
      }

      // netOutValue: derive from outputTokens if present and USDC output exists
      const usdcAddress = getUsdcAddressForChain(chainId);
      const usdcObj = getTokenObj(usdcAddress);
      const usdcDecimals = Number(usdcObj?.decimals ?? 6);

      if (Array.isArray(data?.outputTokens) && data.outputTokens.length > 0) {
        // Prefer explicit USDC output token
        const usdcOut = data.outputTokens.find((o: any) => (o?.tokenAddress || "").toLowerCase() === (usdcAddress || "").toLowerCase()) || data.outputTokens[0];
        if (usdcOut && usdcOut.amount !== undefined && usdcOut.amount !== null) {
          try {
            const outBig = BigInt(String(usdcOut.amount));
            normalized.netOutValue = Number(ethers.formatUnits(outBig, usdcDecimals));
          } catch {
            // if parse fails fallback to number conversion
            normalized.netOutValue = Number(usdcOut.amount) / Math.pow(10, usdcDecimals);
          }
        } else {
          normalized.netOutValue = Number(data?.netOutValue ?? 0);
        }
      } else if (data?.netOutValue !== undefined && data?.netOutValue !== null) {
        // If the API already returned a human netOutValue, take it (prefer numeric)
        normalized.netOutValue = Number(data.netOutValue);
      } else {
        normalized.netOutValue = 0;
      }

      // outValues: normalize array of numeric strings if present
      if (Array.isArray(data?.outValues)) {
        normalized.outValues = data.outValues.map((v: any) => {
          const n = Number(v);
          return Number.isFinite(n) ? n : parseFloat(String(v)) || 0;
        });
      } else {
        normalized.outValues = [];
      }

      // Also expose inputTokens normalized human amounts where possible
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
          // fallback
          human = Number(it.amount) / Math.pow(10, dec);
        }
        return { ...it, humanAmount: human };
      });

      // keep other helpful metadata
      normalized.pathId = data.pathId ?? data.id ?? data.quoteId ?? data.path?.id;
    } catch (err) {
      console.warn("normalizeOdosQuote failed", err);
      // best effort fallback
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
        //console.log("Getting quote...", selectedChain, primaryWallet?.address);

        if (mode === "buy") {
          // helpers to work with decimal strings using BigInt
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
            const numerator = productInt * targetScale + productScale / 2n;
            return numerator / productScale;
          };

          const updated = buyTokens.map((t) => ({ ...t, amount: String(amounts[t.address] ?? t.amount ?? "0") }));
          if (updated.length === 0) {
            setBuyQuote(null);
            setLoading(false);
            return;
          }

          const usdcAddress = getUsdcAddressForChain(selectedChain?.chainId);
          if (!usdcAddress) throw new Error("USDC address not found for chain");
          const usdcObj = getTokenObj(usdcAddress);
          const usdcDecimals = Number(usdcObj?.decimals ?? 6);
          const targetScaleUnits = 10n ** BigInt(usdcDecimals);

          const perTokenUnits: Array<{ token: any; units: bigint }> = [];
          for (const t of updated) {
            const amountStr = String(t.amount ?? "0");
            const priceStr = String(t.price ?? "0");
            const units = mulDecimalToBigInt(amountStr, priceStr, targetScaleUnits);
            perTokenUnits.push({ token: t, units });
          }

          const totalUnits = perTokenUnits.reduce((acc, x) => acc + (x.units ?? 0n), 0n);
          if (totalUnits <= 0n) {
            setBuyQuote(null);
            setLoading(false);
            throw new Error("missing price or amount data for tokens");
          }

          const SCALE = 10n ** 18n;
          const parts: bigint[] = perTokenUnits.map((p) => (p.units * SCALE) / totalUnits);
          const sumParts = parts.reduce((a, b) => a + b, 0n);
          const remainder = SCALE - sumParts;
          if (remainder !== 0n) {
            parts[parts.length - 1] = parts[parts.length - 1] + remainder;
          }

          const formatProportionDecimal = (part: bigint, scale: bigint) => {
            const whole = part / scale;
            const frac = part % scale;
            if (whole >= 1n) return "1";
            const fracStr = frac.toString().padStart(18, "0");
            return fracStr === "" ? "0" : `0.${fracStr}`;
          };

          const outputTokens = perTokenUnits.map((p, idx) => ({
            tokenAddress: p.token.address,
            proportion: formatProportionDecimal(parts[idx], SCALE),
          }));

          const totalUSDCUnits = totalUnits; // BigInt already

          const body = {
            chainId: Number(selectedChain?.chainId),
            compact: true,
            inputTokens: [{ tokenAddress: usdcAddress, amount: totalUSDCUnits.toString() }],
            outputTokens: outputTokens.map((t) => ({ tokenAddress: t.tokenAddress, proportion: parseFloat(t.proportion) })),
            slippageLimitPercent: options?.slippage ?? 0.5,
            userAddr: primaryWallet.address,
            referralCode: 0,
          };

          console.debug("Buy quote body:", body, {
            perTokenUnits,
            totalUnits: totalUSDCUnits.toString(),
            outputTokens,
          });

          const res = await fetch(`${ODOS_BASE}/sor/quote/v2`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
            signal,
          });

          if (!res.ok) {
            const txt = await res.text();
            throw new Error(`Odos buy quote failed: ${txt}`);
          }

          const data = await res.json();
          const normalized = normalizeOdosQuote(data, selectedChain?.chainId);
          setBuyQuote(normalized);
          setLoading(false);
          return;
        }

        if (mode === "sell") {
          const inputs: { tokenAddress: string; amount: string }[] = [];
          //console.log("Sell tokens:", sellTokens, amounts);
          for (const t of sellTokens) {
            const amtStr = t.amount ?? amounts[t.address] ?? "0";
            const amtNum = Number(amtStr || 0);
            if (!amtNum || isNaN(amtNum) || amtNum <= 0) continue;
            const tokenObj = getTokenObj(t.address);
            const decimals = tokenObj?.decimals ?? t.decimals ?? 6;
            const units = parseUnits(amtStr,decimals).toString();
            //(parseFloat(amtStr)*10**decimals).toString();
            inputs.push({ tokenAddress: t.address, amount: units });
          }
          //console.log("Sell inputs:", inputs);
          if (inputs.length === 0) {
            setSellQuote(null);
            setLoading(false);
            return;
          }

          const usdcAddress = getUsdcAddressForChain(selectedChain?.chainId);
          if (!usdcAddress) throw new Error("USDC address not found for chain");

          const body = {
            chainId: Number(selectedChain?.chainId),
            compact: true,
            inputTokens: inputs,
            outputTokens: [{ tokenAddress: usdcAddress, proportion: 1 }],
            slippageLimitPercent: options?.slippage ?? 0.5,
            userAddr: primaryWallet.address,
            referralCode: 0,
          };
          //console.debug("Sell quote body:", body,primaryWallet?.address);

          const res = await fetch(`${ODOS_BASE}/sor/quote/v2`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
            signal,
          });

          if (!res.ok) {
            const txt = await res.text();
            throw new Error(`Odos sell quote failed: ${txt}`);
          }

          const data = await res.json();
          const normalized = normalizeOdosQuote(data, selectedChain?.chainId);
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
          const usdcAddress = getUsdcAddressForChain(selectedChain?.chainId);
          if (!usdcAddress) throw new Error("USDC address not found for chain");

          const oneTokenUnits = toUnits(desired, decimals).toString();

          const body = {
            chainId: Number(selectedChain?.chainId),
            compact: true,
            inputTokens: [{ tokenAddress: usdcAddress, amount: oneTokenUnits }],
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

          if (!res.ok) {
            const txt = await res.text();
            throw new Error(`Odos perToken quote failed: ${txt}`);
          }

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
    [buyTokens, sellTokens, amounts, primaryWallet, selectedChain, marketTokens]
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

        const quoteToUse = options?.quoteType === "sell" ? sellQuote : options?.quoteType === "perToken" && options.tokenAddress ? perTokenQuotes[options.tokenAddress] : buyQuote;
        if (!quoteToUse) throw new Error("requested quote not available");

        const pathId = quoteToUse.pathId || quoteToUse.id || quoteToUse.quoteId || quoteToUse.path?.id;
        if (!pathId) throw new Error("quote missing id");

        const body = { userAddr: primaryWallet.address, pathId, simulate: options?.simulate ?? true };

        const res = await fetch(`${ODOS_BASE}/sor/assemble`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          const txt = await res.text();
          throw new Error(`Assemble failed: ${txt}`);
        }

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
    // allowance returns bigint in ethers v6
    const current: bigint = await tokenContract.allowance(owner, spender);
    if (current >= requiredAmount) return null;
    if (current !== 0n) {
      /*@ts-ignore*/
      const tx0 = await tokenWithSigner.approve(spender, 0n);
      await tx0.wait(1);
    }
    /*@ts-ignore*/
    const tx1 = await tokenWithSigner.approve(spender, requiredAmount);
    await tx1.wait(1);
    return tx1;
  }

  const executeSwap = useCallback(
    async (options?: ExecuteOptions) => {
      setLoading(true);
      setError(null);

      try {
        // Prefer assembled override (the full assembled response) to avoid race problems
        const assembledFull = options?.assembled ?? assembledTx;
        if (!assembledFull) throw new Error("No assembled tx; call assembleTransaction first (or pass assembled in options)");

        // 'assembledFull' may contain .transaction (swap tx) and top-level inputTokens / approvalData
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

        // choose correct quote for approvals (still useful as a fallback)
        const quoteToUse = options?.quoteType === "sell"
          ? sellQuote
          : options?.quoteType === "perToken" && options?.tokenAddress
            ? perTokenQuotes[options.tokenAddress]
            : buyQuote;

        // Gather approval info:
        const assembledApprovalRaw = assembledFull.approvalData ?? assembledFull.approval ?? assembledFull.approvals;
        const assembledInputTokens = assembledFull.inputTokens ?? assembledFull.inputs ?? assembledFull.transaction?.inputTokens;
        const quoteApprovalRaw = quoteToUse?.approvalData ?? quoteToUse?.approval ?? quoteToUse?.approvals;
        const quoteInputTokens = quoteToUse?.inputTokens;

        const approvals: Array<{ tokenAddress: string; spender: string; amount: bigint }> = [];

        const MAX_UINT256 = (1n << 256n) - 1n;

const pushApproval = (tokenAddress: any, spender: any, _amountRaw?: any) => {
  if (!tokenAddress || !spender) return;
  approvals.push({
    tokenAddress: String(tokenAddress),
    spender: String(spender),
    amount: MAX_UINT256,
  });
};

        if (Array.isArray(assembledApprovalRaw) && assembledApprovalRaw.length > 0) {
          for (let i = 0; i < Math.min(5, assembledApprovalRaw.length); i++) {
            const a = assembledApprovalRaw[i];
            const tokenAddress = a.tokenAddress ?? a.token ?? a.token_addr;
            const spender = a.spenderAddress ?? a.spender ?? a.spender_addr ?? a.spenderAddress ?? toAddress;
            const amountStr = a.amount ?? a.approvalAmount ?? a.allowanceAmount ?? a.requiredAmount;
            pushApproval(tokenAddress, spender, amountStr);
          }
        } else if (assembledApprovalRaw && typeof assembledApprovalRaw === "object") {
          const a = assembledApprovalRaw;
          const tokenAddress = a.tokenAddress ?? a.token ?? a.token_addr;
          const spender = a.spenderAddress ?? a.spender ?? a.spender_addr ?? a.spenderAddress ?? toAddress;
          const amountStr = a.amount ?? a.approvalAmount ?? a.allowanceAmount ?? a.requiredAmount;
          pushApproval(tokenAddress, spender, amountStr);
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
            const amountStr = a.amount ?? a.approvalAmount ?? a.allowanceAmount ?? a.requiredAmount;
            pushApproval(tokenAddress, spender, amountStr);
          }
        } else if (Array.isArray(quoteInputTokens) && quoteInputTokens.length > 0) {
          for (let i = 0; i < Math.min(5, quoteInputTokens.length); i++) {
            const it = quoteInputTokens[i];
            if (!it?.tokenAddress || !it?.amount) continue;
            pushApproval(it.tokenAddress, toAddress, it.amount);
          }
        }
        console.log("Collected approvals:", approvals);
        // Debug logging
        console.log("AA executeSwap: assembledInputTokens:", assembledInputTokens);
        console.log("AA executeSwap: quoteInputTokens:", quoteInputTokens);
        console.log("AA executeSwap: assembledApprovalRaw:", assembledApprovalRaw);
        console.log("AA executeSwap: normalized approvals:", approvals);

        const connector = (primaryWallet as any).connector;
        if (connector && isZeroDevConnector(connector)) {
          try {
            const kernelClient: any = connector.getAccountAbstractionProvider({ withSponsorship: true });

            const calls: { to: string; data: string; value?: bigint }[] = [];
            const erc20Interface = new ethers.Interface(ERC20_ABI);

            const canReadAllowance = !!provider;

            for (const ap of approvals) {
              const maxUint = BigInt("0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff");
              const required = ap.amount && ap.amount > 0n ? ap.amount : maxUint;

              let currentAllowance: bigint = 0n;
              if (canReadAllowance) {
                try {
                  const tokenContract = new ethers.Contract(ap.tokenAddress, ERC20_ABI, provider);
                  currentAllowance = await tokenContract.allowance(primaryWallet.address, ap.spender);
                } catch (e) {
                  console.warn("Allowance read failed; will include approve for", ap.tokenAddress, ap.spender, e);
                  currentAllowance = 0n;
                }
              } else {
                currentAllowance = 0n;
              }

              console.log(`Token ${ap.tokenAddress} allowance to ${ap.spender}:`, currentAllowance, "required:", required);

              if (currentAllowance < required) {
                const approveCalldata = erc20Interface.encodeFunctionData("approve", [ap.spender, required]);
                calls.push({ to: ap.tokenAddress, data: approveCalldata, value: 0n });
              } else {
                console.log("Skipping approve; allowance sufficient for", ap.tokenAddress);
              }
            }

            calls.push({ to: toAddress, data: calldata, value: value ?? 0n });
            console.log("AA executeSwap: calls to batch:", calls);

            const encoded = await kernelClient.account.encodeCalls(
              calls.map((c) => ({ data: c.data, to: c.to, value: c.value ?? 0n }))
            );

            const userOpHash = await kernelClient.sendUserOperation({ callData: encoded });
            setLoading(false);
            return userOpHash;
          } catch (aaErr) {
            console.error("Account abstraction path failed, falling back to signer tx:", aaErr);
            // fall through to non-AA path
          }
        }

        // Non-AA / fallback path: ensure approvals if requested and send normal transaction
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
