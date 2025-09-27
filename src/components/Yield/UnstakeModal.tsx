// src/components/UnstakeModal.tsx
"use client";
import React, { useEffect, useMemo, useState, useCallback } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Box,
  Typography,
  IconButton,
  Divider,
  Alert,
  Chip,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import { useAave } from "@/context/AaveContext";
import { useUser } from "@/context/UserContext";

export default function UnstakeModal({
  open,
  onClose,
  selectedPositions,
}: {
  open: boolean;
  onClose: () => void;
  selectedPositions: string[];
}) {
  const { positionsCache, reservesMap, 
    //batchWithdraw, 
    fetchUserPositions, loading, error: aaveError } = useAave();
  const { primaryWallet } = useUser();
  const walletAddr = primaryWallet?.address?.toLowerCase();

  const userPositions = useMemo(() => {
    if (!walletAddr || !positionsCache) return [];
    const cached = positionsCache[walletAddr] ?? [];
    return Array.isArray(cached) ? cached : [];
  }, [positionsCache, walletAddr]);

  const [rows, setRows] = useState<Record<string, { amount: string; symbol?: string; supplied?: number; priceUsd?: number | null }>>({});
  const [busy, setBusy] = useState(false);
  const [tx, setTx] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!open) {
      setRows({});
      setTx(null);
      setError(null);
      setSuccess(false);
      return;
    }
    const initial: Record<string, any> = {};
    for (const sel of selectedPositions) {
      const key = sel.toLowerCase();
      const position = userPositions.find((p) => p.underlying?.toLowerCase() === key);
      const reserve = reservesMap[key];
      initial[key] = {
        amount: "",
        symbol: position?.symbol || reserve?.symbol || key.slice(0, 6),
        supplied: position?.supplied ?? 0,
        priceUsd: reserve?.priceUsd ?? null,
      };
    }
    setRows(initial);
    setTx(null);
    setError(null);
    setSuccess(false);
  }, [open, selectedPositions, userPositions, reservesMap]);

  const handleAmountChange = (addr: string, value: string) => {
    const key = addr.toLowerCase();
    if (value === "" || value.toLowerCase() === "max" || /^\d*\.?\d*$/.test(value)) {
      setRows((p) => ({ ...p, [key]: { ...p[key], amount: value } }));
      setError(null);
    }
  };

  const handleSetMax = (addr: string) => {
    const key = addr.toLowerCase();
    const rowData = rows[key];
    if (rowData?.supplied && rowData.supplied > 0) {
      setRows((p) => ({ ...p, [key]: { ...p[key], amount: rowData.supplied!.toString() } }));
    } else {
      setRows((p) => ({ ...p, [key]: { ...p[key], amount: "max" } }));
    }
    setError(null);
  };

  const totalUsdValue = useMemo(() => {
    let total = 0;
    let hasValues = false;
    Object.entries(rows).forEach(([addr, rowData]) => {
      const { amount, supplied, priceUsd } = rowData;
      if (!amount || !priceUsd) return;
      let withdrawAmount = 0;
      if (amount.toLowerCase() === "max") withdrawAmount = supplied || 0;
      else {
        const numAmount = parseFloat(amount);
        if (!isNaN(numAmount) && numAmount > 0) withdrawAmount = numAmount;
      }
      if (withdrawAmount > 0) {
        total += withdrawAmount * priceUsd;
        hasValues = true;
      }
    });
    return hasValues ? total : null;
  }, [rows]);

//   const handleUnstake = async () => {
//     setError(null);
//     setTx(null);
//     setSuccess(false);
//     if (!primaryWallet?.address) {
//       setError("Wallet not connected");
//       return;
//     }

//     const items = Object.entries(rows)
//       .map(([addr, rowData]) => {
//         const amount = rowData.amount?.trim();
//         if (!amount) return null;
//         if (amount.toLowerCase() === "max") return { asset: addr, amountHumanOrMax: "max" };
//         const numAmount = parseFloat(amount);
//         if (isNaN(numAmount) || numAmount <= 0) return null;
//         // validate
//         const supplied = rowData.supplied || 0;
//         if (numAmount > supplied) {
//           setError(`Amount ${numAmount} exceeds supplied ${supplied} for ${rowData.symbol}`);
//           return null;
//         }
//         return { asset: addr, amountHumanOrMax: amount };
//       })
//       .filter(Boolean) as { asset: string; amountHumanOrMax: string }[];

//     if (items.length === 0) {
//       setError("Please enter valid amounts or click Max for at least one position");
//       return;
//     }

//     setBusy(true);
//     try {
//       const result = await batchWithdraw(items, { useAA: true });
//       const display = Array.isArray(result) ? result[0] : String(result);
//       setTx(display);
//       setSuccess(true);
//       setTimeout(() => {
//         if (primaryWallet?.address) fetchUserPositions(primaryWallet.address);
//       }, 3000);
//     } catch (err: any) {
//       console.error("Batch withdrawal error:", err);
//       setError(err?.message || "Failed to submit withdrawal");
//     } finally {
//       setBusy(false);
//     }
//   };

  const hasValidInputs = useMemo(() => {
    return Object.values(rows).some((row) => {
      const amount = row.amount?.trim();
      if (!amount) return false;
      if (amount.toLowerCase() === "max") return true;
      const num = parseFloat(amount);
      return !isNaN(num) && num > 0;
    });
  }, [rows]);

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Typography variant="h6">Unstake Selected Positions</Typography>
          <Box display="flex" alignItems="center" gap={1}>
            <Chip label={`${selectedPositions.length} selected`} size="small" color="primary" variant="outlined" />
            <IconButton onClick={onClose} size="small"><CloseIcon /></IconButton>
          </Box>
        </Box>
      </DialogTitle>

      <DialogContent dividers>
        {loading && <Alert severity="info" sx={{ mb: 2 }}>Loading position data...</Alert>}
        {aaveError && <Alert severity="error" sx={{ mb: 2 }}>{aaveError}</Alert>}
        {Object.keys(rows).length === 0 ? (
          <Alert severity="warning">No positions selected or position data unavailable</Alert>
        ) : (
          <Box>
            {Object.entries(rows).map(([addr, rowData]) => (
              <Box key={addr} sx={{ display: "flex", gap: 2, alignItems: "center", mb: 2, p: 2, border: "1px solid", borderColor: "divider", borderRadius: 1, backgroundColor: "background.paper" }}>
                <Box sx={{ minWidth: 140 }}>
                  <Typography variant="body1" fontWeight={600}>{rowData.symbol || addr.slice(0, 8)}</Typography>
                  <Typography variant="caption" color="text.secondary">{addr.slice(0, 10)}...{addr.slice(-8)}</Typography>
                  <Box mt={0.5}>
                    <Typography variant="body2" color="text.secondary">Available: {rowData.supplied?.toFixed(6) || "0.000000"}</Typography>
                    {/*@ts-ignore*/}
                    {rowData?.suppliedUsd && <Typography variant="caption" color="text.secondary">≈ ${rowData?.suppliedUsd.toFixed(2)}</Typography>}
                  </Box>
                </Box>

                <TextField
                  label="Amount to withdraw"
                  size="small"
                  value={rowData.amount}
                  onChange={(e) => handleAmountChange(addr, e.target.value)}
                  placeholder="0.0 or 'max'"
                  inputProps={{ inputMode: "decimal", style: { textAlign: "right" } }}
                  sx={{ flex: 1, minWidth: 150 }}
                  helperText={rowData.amount && rowData.priceUsd && rowData.amount !== "max" ? `≈ $${(parseFloat(rowData.amount) * rowData.priceUsd).toFixed(2)}` : " "}
                />

                <Button size="small" variant="outlined" onClick={() => handleSetMax(addr)} disabled={!rowData.supplied || rowData.supplied <= 0}>Max</Button>
              </Box>
            ))}
          </Box>
        )}

        <Divider sx={{ my: 2 }} />

        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          <Typography variant="body1">Estimated Total Withdrawal:</Typography>
          <Typography variant="h6" fontWeight={600}>{totalUsdValue ? `$${totalUsdValue.toFixed(2)}` : "--"}</Typography>
        </Box>

        {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
        {success && tx && <Alert severity="success" sx={{ mt: 2 }}><Typography variant="body2">Transaction submitted successfully!</Typography><Typography variant="caption" sx={{ wordBreak: "break-all" }}>UserOp Hash: {tx}</Typography></Alert>}
      </DialogContent>

      <DialogActions sx={{ p: 2 }}>
        <Button onClick={onClose} disabled={busy}>Cancel</Button>
        <Button variant="contained" disabled={busy || !hasValidInputs || !!aaveError} onClick={()=>{
            //TODO: enable when batchWithdraw is available
        }} sx={{ minWidth: 120 }}>{busy ? "Submitting..." : "Unstake (Batch AA)"}</Button>
      </DialogActions>
    </Dialog>
  );
}
