"use client";
import React, { useMemo, useState } from "react";
import {
  Box,
  Paper,
  Typography,
  TextField,
  IconButton,
  Divider,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  InputAdornment,
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import { useSwap } from "@/context/SwapContext";
import { useTokenBalances } from "@dynamic-labs/sdk-react-core";
import { useUser } from "@/context/UserContext";

function safeNumber(v: any) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export default function SellCart() {
  const {
    removeSellToken,
    sellTokens,
    amounts,
    updateAmount,
    getQuote,
    assembleTransaction,
    executeSwap,
    sellQuote,
  } = useSwap();

  const { selectedChain } = useUser();
  console.log("Selected chain in SellCart:", sellTokens);
  // fetch token balances via Dynamic Labs hook for the active chain
//   const { tokenBalances = [], isLoading: balancesLoading } = useTokenBalances({
//     networkId: selectedChain?.chainId || 1,
//   });

  // map balances by lowercased address for quick lookup
  const balanceMap = useMemo(() => {
    const m: Record<string, { balance: number; formatted?: string; decimals?: number }> = {};
    (sellTokens || []).forEach((tb: any) => {
      const addr = (tb.address || tb.contractAddress || tb.tokenAddress || "").toLowerCase();
      // Dynamic Labs token object shapes vary; try a few fields
      const rawBalance = tb.balance ?? tb.formatted ?? tb.amount ?? 0;
      const decimals = tb.decimals ?? tb.tokenDecimals ?? 18;
      // prefer numeric formatted balance if available (some SDKs supply formatted already)
      const balanceNum = typeof rawBalance === "string" && rawBalance.includes(".") ? parseFloat(rawBalance) : Number(rawBalance);
      m[addr] = { balance: Number.isFinite(balanceNum) ? balanceNum : 0, formatted: String(rawBalance), decimals };
    });
    return m;
  }, [sellTokens]);

  const [openFundsModal, setOpenFundsModal] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);

  const handleAmountChange = (address: string, value: string) => {
    const sanitized = value === "" ? "" : String(parseFloat(value) || 0);
    updateAmount(address, sanitized);
  };

  const handleSetMax = (address: string,balance:string) => {
    //const addr = address.toLowerCase();
    //const b = balanceMap[addr]?.balance ?? 0;
    // set with reasonable precision: use up to 6 decimal places for display (adjust as needed)
    //const str = (Math.floor(b * 1e4) / 1e4).toString();
    //console.log("Set max for", address, "to", str);
    updateAmount(address, balance);
  };

  const calcTotals = () => {
    let totalValue = 0;
    let totalTokens = 0;
    sellTokens.forEach((t: any) => {
      const amt = parseFloat(String(amounts[t.address] ?? 0)) || 0;
      totalValue += amt * Number(t.price ?? 0);
      totalTokens += amt;
    });
    const networkFee = totalValue * 0.002;
    return { totalValue, totalTokens, networkFee };
  };

  const { totalValue, totalTokens, networkFee } = calcTotals();

  const handleSell = async () => {
    setLocalError(null);
    setMessage(null);

    if (sellTokens.length === 0) {
      setLocalError("No tokens in sell cart");
      return;
    }

    const anyPositive = sellTokens.some((t: any) => {
      const amt = parseFloat(String(amounts[t.address] ?? 0)) || 0;
      return amt > 0;
    });
    if (!anyPositive) {
      setLocalError("Enter amount for at least one token");
      return;
    }

    setProcessing(true);

    try {
      await getQuote("sell", { slippage: 0.5 });
      const assembled = await assembleTransaction({ simulate: true, quoteType: "sell" });
      if (!assembled) throw new Error("Failed to assemble sell transaction");

      const result = await executeSwap({ approveBefore: true, quoteType: "sell", assembled });
      if (result) {
        setMessage(`Swap submitted: ${result}`);
      } else {
        setLocalError("Swap submission failed or was rejected");
      }
    } catch (err: any) {
      console.error("Sell error:", err);
      setLocalError(err?.message || String(err));
    } finally {
      setProcessing(false);
    }
  };

  return (
    <Box sx={{ display: "flex", gap: 3 }}>
      {/* Left - Token List */}
      <Paper sx={{ flex: 2, p: 2, borderRadius: 3, border: "1px solid #eee" }}>
        <Typography variant="h6" mb={2}>
          Sell Cart
        </Typography>

        {sellTokens.length === 0 ? (
          <Typography color="text.secondary">No tokens added yet.</Typography>
        ) : (
          sellTokens.map((token: any) => {
            const addr = (token.address || "").toLowerCase();
            const chainBalance = token?.amount;
            const displayBalance = token?.amount;
            const price = Number(token.price ?? 0);
            return (
              <Box
                key={token.address}
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 2,
                  mb: 2,
                }}
              >
                {/* Token Info */}
                <Box sx={{ display: "flex", alignItems: "center", gap: 1, minWidth: 150 }}>
                  {token.iconUrl ? (
                    <img
                      src={token.iconUrl}
                      alt={token.symbol}
                      width={28}
                      height={28}
                      style={{
                        borderRadius: "50%",
                        border: `2px solid ${token.color || "#ddd"}`,
                      }}
                    />
                  ) : (
                    <Box sx={{ width: 28, height: 28, borderRadius: "50%", background: token.color || "#ddd" }} />
                  )}
                  <Box>
                    <Typography fontWeight={600}>{token.symbol}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      Balance: {displayBalance?.toLocaleString(undefined, { maximumFractionDigits: 6 })}
                    </Typography>
                  </Box>
                </Box>

                {/* Amount Input with Max */}
                <TextField
                  size="small"
                  type="number"
                  label="Amount"
                  value={amounts[token.address] ?? ""}
                  onChange={(e) => handleAmountChange(token.address, e.target.value)}
                  inputProps={{ min: 0 }}
                  sx={{ width: 160 }}
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">
                        <Button size="small" onClick={() => handleSetMax(token.address,chainBalance)} sx={{ textTransform: "none" }}>
                          Max
                        </Button>
                      </InputAdornment>
                    ),
                  }}
                />

                {/* Estimated USD value */}
                <Box sx={{ flexGrow: 1 }}>
                  <Typography fontWeight={600} textAlign="right">
                    ${((parseFloat(String(amounts[token.address] ?? 0)) || 0) * price).toFixed(2)}
                  </Typography>
                </Box>

                {/* Remove Button */}
                <IconButton onClick={() => removeSellToken(token.address)} aria-label={`remove-${token.symbol}`}>
                  <DeleteIcon />
                </IconButton>
              </Box>
            );
          })
        )}
      </Paper>

      {/* Right - Summary */}
      <Paper sx={{ flex: 1, p: 2, borderRadius: 3, border: "1px solid #eee" }}>
        <Typography variant="h6" mb={2}>
          Summary
        </Typography>

        <Box sx={{ display: "flex", justifyContent: "space-between", mb: 1 }}>
          <Typography color="text.secondary">Total Tokens</Typography>
          <Typography fontWeight={600}>{totalTokens}</Typography>
        </Box>

        <Box sx={{ display: "flex", justifyContent: "space-between", mb: 1 }}>
          <Typography color="text.secondary">Estimated Output (USDC)</Typography>
          <Typography fontWeight={600}>
            ${typeof sellQuote?.netOutValue === "number" ? sellQuote.netOutValue.toFixed(2) : totalValue.toFixed(2)}
          </Typography>
        </Box>

        <Box sx={{ display: "flex", justifyContent: "space-between", mb: 2 }}>
          <Typography color="text.secondary">Network Fee</Typography>
          <Typography fontWeight={600}>
            ${typeof sellQuote?.gasEstimateValue === "number" ? sellQuote.gasEstimateValue.toFixed(2) : networkFee.toFixed(2)}
          </Typography>
        </Box>

        <Divider sx={{ mb: 2 }} />

        {localError && (
          <Typography color="error" sx={{ mb: 1 }}>
            {localError}
          </Typography>
        )}
        {message && (
          <Typography color="success.main" sx={{ mb: 1 }}>
            {message}
          </Typography>
        )}

        <Button
          variant="contained"
          fullWidth
          sx={{ borderRadius: 2, textTransform: "none" }}
          onClick={handleSell}
          disabled={sellTokens.length === 0 || processing}
        >
          {processing ? "Processing..." : "Sell Now"}
        </Button>
      </Paper>

      {/* Modal kept for parity (not used here) */}
      <Dialog open={openFundsModal} onClose={() => setOpenFundsModal(false)}>
        <DialogTitle>Action blocked</DialogTitle>
        <DialogContent>
          <Typography>
            An issue was detected in your inputs. Please review amounts and balances before continuing.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenFundsModal(false)}>Cancel</Button>
          <Button variant="contained" onClick={() => {/* trigger relevant flow */}}>
            OK
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
