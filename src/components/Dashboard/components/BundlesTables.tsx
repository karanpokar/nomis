import React from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Button,
  Box,
  Typography,
  AvatarGroup,
  Avatar,
  Tooltip,
} from "@mui/material";
import { useSwap } from "@/context/SwapContext";
import toast from "react-hot-toast";

type Coin = {
  uuid: string;
  symbol: string;
  name: string;
  iconUrl: string;
  price: string;
  marketCap: string;
  change: string;
  ["24hVolume"]?: string;
};

type Bundle = {
  name: string;
  images: string[];
  minimumBuy: number;
  marketCap: number;
  change: number;
  v24hVolume: number;
  coins: Coin[];
};

export default function BundleTable({ bundles }: { bundles: any[] }) {
  const { addBuyToken, buyTokens } = useSwap();
  return (
    <TableContainer
      component={Paper}
      sx={{ borderRadius: 3, border: "1px solid #eee" }}
    >
      <Table>
        <TableHead>
          <TableRow>
            <TableCell>Bundle</TableCell>
            <TableCell align="right">Coins</TableCell>
            <TableCell align="right">Market Cap (avg)</TableCell>
            <TableCell align="right">24h Change (avg)</TableCell>
            <TableCell align="right">24h Volume (avg)</TableCell>
            <TableCell align="center">Action</TableCell>
          </TableRow>
        </TableHead>

        <TableBody>
          {bundles.map((bundle) => (
            <TableRow key={bundle.name}>
              {/* Bundle name + icons */}

              <TableCell>
                <Typography fontWeight={600}>{bundle.name}</Typography>
              </TableCell>

              <TableCell>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  <AvatarGroup
                    max={5}
                    sx={{ "& .MuiAvatar-root": { width: 28, height: 28 } }}
                  >
                    {bundle.coins.map((coin: any, i: any) => (
                      <Tooltip
                        key={coin.uuid}
                        title={`${coin.name} (${coin.symbol})`}
                        arrow
                      >
                        <Avatar
                          src={coin.iconUrl}
                          alt={coin.symbol}
                          sx={{ border: "2px solid #fff", cursor: "pointer" }}
                        />
                      </Tooltip>
                    ))}
                  </AvatarGroup>
                </Box>
              </TableCell>

              {/* Avg Market Cap */}
              <TableCell align="right">
                $
                {bundle.marketCap.toLocaleString(undefined, {
                  maximumFractionDigits: 0,
                })}
              </TableCell>

              {/* Avg Change */}
              <TableCell
                align="right"
                sx={{
                  color: bundle.change >= 0 ? "green" : "red",
                  fontWeight: 600,
                }}
              >
                {bundle.change.toFixed(2)}%
              </TableCell>

              {/* Avg 24h Volume */}
              <TableCell align="right">
                $
                {bundle.v24hVolume.toLocaleString(undefined, {
                  maximumFractionDigits: 0,
                })}
              </TableCell>

              {/* Action */}
              <TableCell align="center">
                <Button
                  variant="contained"
                  size="small"
                  sx={{ borderRadius: 2, textTransform: "none" }}
                  onClick={() => {
                    if (buyTokens.length + bundle.coins.length > 5) {
                      toast.error("You can add maximum 5 tokens in Buy Cart!");
                      return;
                    }  
                      bundle.coins.forEach((coin: any) => {
                        addBuyToken(coin);
                        toast.success("Bundle added to Buy Cart!");
                      });
                    
                  }}
                >
                  Invest
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
