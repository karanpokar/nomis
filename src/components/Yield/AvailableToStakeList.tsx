// src/components/AvailableToStakeList.tsx
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

export default function AvailableToStakeList({ onOpenStake }: { onOpenStake: (selected: string[]) => void }) {
  const { aaveReserves, reservesMap } = useAave();
  const { primaryWallet } = useUser();
  const [selected, setSelected] = useState<Record<string, boolean>>({});

  useEffect(() => {
    // reset selection when wallet changes
    setSelected({});
  }, [primaryWallet?.address]);

  const toggle = (addr: string) => setSelected((s) => ({ ...s, [addr]: !s[addr] }));
  const chosen = useMemo(() => Object.keys(selected).filter((k) => selected[k]), [selected]);

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
        <Typography variant="h6">Available to Stake</Typography>
        <Button variant="contained" disabled={chosen.length === 0} onClick={() => onOpenStake(chosen)}>
          Stake selected ({chosen.length})
        </Button>
      </Box>

      <Divider sx={{ mb: 1 }} />

      <List sx={{ maxHeight: 420, overflow: "auto" }}>
        {aaveReserves.length === 0 ? (
          <Typography px={2}>No reserves found</Typography>
        ) : (
          aaveReserves.map((r: any) => {
            const key = r.underlying.toLowerCase();
            return (
              <ListItem
              
                key={key}
                secondaryAction={<Checkbox edge="end" checked={!!selected[key]} onChange={() => toggle(key)} />}
                button
                onClick={() => toggle(key)}
              >
                <ListItemAvatar>
                  <Avatar>{r.symbol?.[0] ?? "?"}</Avatar>
                </ListItemAvatar>
                <ListItemText
                  primary={
                    <Box display="flex" justifyContent="space-between" gap={2}>
                      <Box>
                        <Typography fontWeight={600}>{r.symbol}</Typography>
                        <Typography variant="body2" color="text.secondary">
                          APY: {r.liquidityRate ? (Number(r.liquidityRate) > 1e6 ? ((Number(r.liquidityRate) / 1e27) * 365 * 24 * 3600 * 100).toFixed(2) : (Number(r.liquidityRate) * 100).toFixed(2)) : "—"}%
                        </Typography>
                      </Box>
                      <Box textAlign="right">
                        <Typography>{r.priceUsd ? `$${Number(r.priceUsd).toFixed(4)}` : "—"}</Typography>
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
