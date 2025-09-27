// src/components/StakeModal.tsx
"use client";
import React, { useEffect, useMemo, useState } from "react";
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
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import { useAave } from "@/context/AaveContext";
import { useUser } from "@/context/UserContext";

export default function StakeModal({
  open,
  onClose,
  selectedAssets,
}: {
  open: boolean;
  onClose: () => void;
  selectedAssets: string[];
}) {
  const { reservesMap, 
    //batchSupply, 
    //refetchReserves, 
    fetchUserPositions } = useAave();
  const { primaryWallet } = useUser();
  const [rows, setRows] = useState<Record<string, { amount: string; symbol?: string; priceUsd?: number | null }>>({});
  const [busy, setBusy] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setRows({});
      setTxHash(null);
      setError(null);
    } else {
      const initial: Record<string, any> = {};
      for (const addr of selectedAssets) {
        const r = reservesMap[addr.toLowerCase()];
        initial[addr.toLowerCase()] = { amount: "", symbol: r?.symbol, priceUsd: r?.priceUsd ?? null };
      }
      setRows(initial);
    }
  }, [open, selectedAssets, reservesMap]);

  const totalUsd = useMemo(() => {
    return Object.entries(rows).reduce((s, [addr, r]) => {
      const amt = parseFloat(r.amount || "0") || 0;
      const price = Number(r.priceUsd ?? 0);
      return s + amt * price;
    }, 0);
  }, [rows]);

  const handleAmountChange = (addr: string, v: string) => {
    setRows((p) => ({ ...p, [addr]: { ...p[addr], amount: v } }));
    setError(null);
    setTxHash(null);
  };

//   const handleStake = async () => {
//     setError(null);
//     setTxHash(null);
//     if (!primaryWallet?.address) {
//       setError("Wallet not connected");
//       return;
//     }
//     const items = Object.entries(rows)
//       .map(([addr, r]) => ({ asset: addr, amountHuman: String(r.amount || "0") }))
//       .filter((x) => Number(x.amountHuman) > 0);

//     if (items.length === 0) {
//       setError("Set amounts for at least one asset");
//       return;
//     }

//     setBusy(true);
//     try {
//       // prefer AA/ZeroDev batch
//       const result = await batchSupply(items, { useAA: true });
//       // batchSupply returns array (userOpHash or tx hashes) — normalize to string display
//       const display = Array.isArray(result) ? result[0] : String(result);
//       setTxHash(display);
//       // refresh later
//       setTimeout(() => {
//         void fetchUserPositions(primaryWallet.address);
//         void refetchReserves();
//       }, 4000);
//     } catch (err: any) {
//       console.error("batchSupply error", err);
//       setError(err?.message || String(err));
//     } finally {
//       setBusy(false);
//     }
//   };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>
        Stake selected assets
        <IconButton onClick={onClose} sx={{ position: "absolute", right: 8, top: 8 }}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers>
        {Object.keys(rows).length === 0 ? (
          <Typography>No assets selected</Typography>
        ) : (
          Object.entries(rows).map(([addr, r]) => (
            <Box key={addr} display="flex" gap={2} alignItems="center" mb={1}>
              <Box sx={{ minWidth: 120 }}>
                <Typography fontWeight={600}>{r.symbol}</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ fontSize: 12 }}>
                  {addr}
                </Typography>
              </Box>
              <TextField
                label="Amount"
                size="small"
                value={r.amount}
                onChange={(e) => handleAmountChange(addr, e.target.value)}
                inputProps={{ inputMode: "decimal" }}
                sx={{ flex: 1 }}
              />
              <Button size="small" onClick={() => handleAmountChange(addr, "max")}>
                Max
              </Button>
              <Box sx={{ minWidth: 120, textAlign: "right" }}>
                <Typography>${r.priceUsd ? (Number(r.priceUsd) * (parseFloat(r.amount || "0") || 0)).toFixed(2) : "N/A"}</Typography>
              </Box>
            </Box>
          ))
        )}
        <Divider sx={{ my: 1 }} />
        <Box display="flex" justifyContent="space-between" mb={1}>
          <Typography>Total (USD)</Typography>
          <Typography fontWeight={600}>${totalUsd.toFixed(2)}</Typography>
        </Box>

        {error && <Alert severity="error">{error}</Alert>}
        {txHash && <Alert severity="success">UserOp submitted: <Typography component="span" sx={{ wordBreak: "break-all" }}>{txHash}</Typography></Alert>}
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose} disabled={busy}>Cancel</Button>
        <Button variant="contained" disabled={busy} onClick={()=>{
            //TODO : enable when batchSupply is available
        }}>
          {busy ? "Submitting..." : "Stake (Batch AA)"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
