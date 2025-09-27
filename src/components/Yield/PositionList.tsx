// src/components/PositionList.tsx
"use client";
import React, { useEffect, useMemo, useState } from "react";
import {
  Box,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  Avatar,
  Checkbox,
  Button,
  Typography,
  Divider,
} from "@mui/material";
import { useAave } from "@/context/AaveContext";
import { useUser } from "@/context/UserContext";

export default function PositionsList({ onOpenUnstake }: { onOpenUnstake: (selected: string[]) => void }) {
  const { fetchUserPositions, positionsCache } = useAave();
  const { primaryWallet } = useUser();
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [positions, setPositions] = useState<any[]>([]);
  const walletAddr = primaryWallet?.address?.toLowerCase();

  useEffect(() => {
    (async () => {
      if (!primaryWallet?.address) return;
      const cached = positionsCache[walletAddr || ""] ?? null;
      if (cached) setPositions(cached);
      const fetched = await fetchUserPositions();
      if (fetched) setPositions(fetched);
    })();
  }, [primaryWallet?.address]);

  const toggle = (addr: string) => setSelected((s) => ({ ...s, [addr]: !s[addr] }));
  const chosen = useMemo(() => Object.keys(selected).filter((k) => selected[k]), [selected]);

  const selectAll = () => {
    const all: Record<string, boolean> = {};
    positions.forEach((p) => {
      const key = p.underlying.toLowerCase();
      all[key] = true;
    });
    setSelected(all);
  };

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
        <Typography variant="h6">Your Positions</Typography>
        <Box display="flex" gap={1}>
          <Button size="small" onClick={selectAll} disabled={positions.length === 0}>
            Select all
          </Button>
          <Button variant="contained" disabled={chosen.length === 0} onClick={() => onOpenUnstake(chosen)}>
            Unstake selected ({chosen.length})
          </Button>
        </Box>
      </Box>

      <Divider sx={{ mb: 1 }} />

      <List sx={{ maxHeight: 420, overflow: "auto" }}>
        {positions.length === 0 ? (
          <Typography px={2}>No positions found</Typography>
        ) : (
          positions.map((p: any) => {
            const key = p.underlying.toLowerCase();
            return (
              <ListItem key={key} secondaryAction={<Checkbox edge="end" checked={!!selected[key]} onChange={() => toggle(key)} />}>
                <ListItemAvatar>
                  <Avatar>{p.symbol?.[0] ?? "?"}</Avatar>
                </ListItemAvatar>
                <ListItemText
                  primary={
                    <Box display="flex" justifyContent="space-between" gap={2}>
                      <Box>
                        <Typography fontWeight={600}>{p.symbol}</Typography>
                        <Typography variant="body2" color="text.secondary">Supplied: {Number(p.supplied || 0).toFixed(6)}</Typography>
                      </Box>
                      <Box textAlign="right">
                        <Typography>${p.suppliedUsd ? Number(p.suppliedUsd).toFixed(2) : "N/A"}</Typography>
                      </Box>
                    </Box>
                  }
                />
              </ListItem>
            );
          })
        )}
      </List>
    </Box>
  );
}
