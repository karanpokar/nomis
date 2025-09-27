"use client";
import React, { useState } from "react";
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
  Select,
  MenuItem,
  FormControl,
  InputLabel,
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import { useSwap } from "@/context/SwapContext";

export default function BuyCart() {
  const {
    removeBuyToken,
    buyTokens,
    defaultBuyToken,
    amounts,
    updateAmount,
    getQuote,
    assembleTransaction,
    executeSwap,
    buyQuote,

    // NEW
    buyInputStable,
    setBuyInputStable,
    stableOptions,
  } = useSwap();

  // local UI state
  const [openFundsModal, setOpenFundsModal] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);

  const handleAmountChange = (address: string, value: string) => {
    const sanitized = value === "" ? "" : String(parseFloat(value) || 0);
    updateAmount(address, sanitized);
  };

  const calcTotals = () => {
    let totalValue = 0;
    let totalTokens = 0;
    buyTokens.forEach((t: any) => {
      const amt = parseFloat(String(amounts[t.address] ?? 0)) || 0;
      totalValue += amt * Number(t.price ?? 0);
      totalTokens += amt;
    });
    const networkFee = totalValue * 0.002; // example: 0.2% fee
    return { totalValue, totalTokens, networkFee };
  };

  const { totalValue, totalTokens, networkFee } = calcTotals();

 const handleBuy = async () => {
  setLocalError(null);
  setMessage(null);

  if (buyTokens.length === 0) {
    setLocalError("No tokens in cart");
    return;
  }

  setProcessing(true);
  try {
    // 1) Get the fresh quote (SwapContext now RETURNS it)
    const q = await getQuote("buy", { slippage: 0.5 });
    if (!q) throw new Error("Quote unavailable");
    
    // 2) Assemble using the returned quote (avoid state timing issues)
    const assembled = await assembleTransaction({
      simulate: true,
      quoteType: "buy",
      quote: q,              // ← pass the override here
    });
    if (!assembled) throw new Error("Failed to assemble buy transaction");

    // 3) Execute
    const result = await executeSwap({
      approveBefore: true,
      quoteType: "buy",
      assembled,
    });

    if (result) setMessage(`Swap submitted: ${result}`);
    else setLocalError("Swap submission failed or was rejected");
  } catch (err: any) {
    console.error("Buy error:", err);
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
          Your Cart
        </Typography>

        {buyTokens.length === 0 ? (
          <Typography color="text.secondary">No tokens added yet.</Typography>
        ) : (
          buyTokens.map((token: any) => (
            <Box key={token.address} sx={{ display: "flex", alignItems: "center", gap: 2, mb: 2 }}>
              {/* Token Info */}
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, minWidth: 150 }}>
                {token.iconUrl ? (
                  <img
                    src={token.iconUrl}
                    alt={token.symbol}
                    width={28}
                    height={28}
                    style={{ borderRadius: "50%", border: `2px solid ${token.color || "#ddd"}` }}
                  />
                ) : (
                  <Box sx={{ width: 28, height: 28, borderRadius: "50%", background: token.color || "#ddd" }} />
                )}
                <Box>
                  <Typography fontWeight={600}>{token.symbol}</Typography>
                </Box>
              </Box>

              {/* Amount Input */}
              <TextField
                size="small"
                type="number"
                label="Amount"
                value={amounts[token.address] ?? ""}
                onChange={(e) => handleAmountChange(token.address, e.target.value)}
                inputProps={{ min: 0 }}
                sx={{ width: 120 }}
              />

              {/* Price */}
              <Box sx={{ flexGrow: 1 }}>
                <Typography fontWeight={600} textAlign="right">
                  ${((parseFloat(String(amounts[token.address] ?? 0)) || 0) * Number(token.price ?? 0)).toFixed(2)}
                </Typography>
              </Box>

              {/* Remove Button */}
              <IconButton onClick={() => removeBuyToken(token.address)} aria-label={`remove-${token.symbol}`}>
                <DeleteIcon />
              </IconButton>
            </Box>
          ))
        )}
      </Paper>

      {/* Right - Summary */}
      <Paper sx={{ flex: 1, p: 2, borderRadius: 3, border: "1px solid #eee" }}>
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
          <Typography variant="h6">Summary</Typography>
          <FormControl size="small" sx={{ minWidth: 140 }}>
            <InputLabel id="buy-stable-label">Pay with</InputLabel>
            <Select
              labelId="buy-stable-label"
              label="Pay with"
              value={buyInputStable}
              onChange={(e) => setBuyInputStable(e.target.value as any)}
            >
              {stableOptions
                // hide PYUSD when not on Ethereum for clarity (provider will also hide via options)
                .filter((opt) => opt.symbol !== "PYUSD" || true)
                .map((opt) => (
                  <MenuItem key={opt.symbol} value={opt.symbol}>
                    {opt.symbol}
                  </MenuItem>
                ))}
            </Select>
          </FormControl>
        </Box>

        <Box sx={{ display: "flex", justifyContent: "space-between", mb: 1 }}>
          <Typography color="text.secondary">Total Tokens</Typography>
          <Typography fontWeight={600}>{totalTokens}</Typography>
        </Box>

        <Box sx={{ display: "flex", justifyContent: "space-between", mb: 1 }}>
          <Typography color="text.secondary">Equivalent ({buyInputStable})</Typography>
          <Typography fontWeight={600}>
            ${buyQuote?.raw?.inValues?.[0] || ''}
          </Typography>
        </Box>

        <Box sx={{ display: "flex", justifyContent: "space-between", mb: 2 }}>
          <Typography color="text.secondary">Network Fee</Typography>
          <Typography fontWeight={600}>
            ${typeof buyQuote?.gasEstimateValue === "number" ? buyQuote.gasEstimateValue.toFixed(2) : networkFee.toFixed(2)}
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
          onClick={handleBuy}
          disabled={buyTokens.length === 0 || !buyQuote || processing}
        >
          {processing ? "Processing..." : "Buy Now"}
        </Button>
      </Paper>

      {/* Insufficient Funds Modal */}
      <Dialog open={openFundsModal} onClose={() => setOpenFundsModal(false)}>
        <DialogTitle>Insufficient Funds</DialogTitle>
        <DialogContent>
          <Typography>
            Your balance is too low to complete this purchase. Please add funds to continue.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenFundsModal(false)}>Cancel</Button>
          <Button variant="contained" onClick={() => { /* trigger add funds flow */ }}>
            Add Funds
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}