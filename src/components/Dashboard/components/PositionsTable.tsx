"use client";
import React, { useState, useEffect } from "react";
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
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress,
  Alert,
} from "@mui/material";
import { useSwap } from "@/context/SwapContext";
import { useDynamicContext } from "@dynamic-labs/sdk-react-core";
import { useUser } from "@/context/UserContext";
import SellCart from "./SellCart"; // adjust path if needed
import { useUserTokens } from "@/context/useUserTokens";
import toast from "react-hot-toast";

type TokenBalanceRow = {
  address: string;
  symbol: string;
  name?: string;
  logoURI?: string;
  balance?: number | string;
  price?: number;
  liquidityPoolSizeUsd?: number;
  usd_value?:number;
};

export default function PositionsTable() {
  const { addSellToken, removeSellToken, sellTokens } = useSwap();
  const { selectedChain } = useUser();
  const { primaryWallet } = useDynamicContext();

  // Use the new useUserTokens hook
  const { userTokens, loading, error, fetchUserTokens } = useUserTokens();

  const [openSellModal, setOpenSellModal] = useState(false);

  // Get wallet address
  const walletAddress = primaryWallet?.address;

  // Fetch tokens when wallet address changes
  useEffect(() => {
    if (walletAddress && fetchUserTokens) {
      // Map chain ID to Moralis chain format
      const getChainName = (chainId: number) => {
        switch (chainId) {
          case 1: return 'eth';
          case 137: return 'polygon';
          case 56: return 'bsc';
          case 8453: return 'base';
          case 43114: return 'avalanche';
          case 250: return 'fantom';
          case 42161: return 'arbitrum';
          case 10: return 'optimism';
          default: return 'eth';
        }
      };

      const chainName = getChainName(selectedChain?.chainId || 1);
      fetchUserTokens(walletAddress, chainName);
    }
  }, [walletAddress, selectedChain?.chainId, fetchUserTokens]);

  const isStablecoin = (token: TokenBalanceRow) => {
    const stables = ["USDC", "USDT", "DAI", "BUSD", "TUSD", "USDP", "FDUSD", "USDS"];
    return stables.includes((token.symbol || "").toUpperCase()) || (token.name || "").toLowerCase().includes("usd");
  };

  const isInSellToken = (token: TokenBalanceRow) => {
    return sellTokens.some((t: any) => t.address?.toLowerCase() === token.address?.toLowerCase());
  };

  const safeNumber = (v: any) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  };

  // Show loading state
  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", p: 4 }}>
        <CircularProgress />
        <Typography sx={{ ml: 2 }}>Loading tokens...</Typography>
      </Box>
    );
  }

  // Show error state
  if (error) {
    return (
      <Box sx={{ p: 2 }}>
        <Alert severity="error" sx={{ mb: 2 }}>
          Error loading tokens: {error}
        </Alert>
        <Button 
          variant="outlined" 
          onClick={() => walletAddress && fetchUserTokens(walletAddress)}
        >
          Retry
        </Button>
      </Box>
    );
  }

  return (
    <>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", p: 2 }}>
        <Typography variant="h6">Tokens</Typography>
        <Box>
          <Button
            variant="outlined"
            size="small"
            sx={{ mr: 2, borderRadius: 2, textTransform: "none" }}
            onClick={() => walletAddress && fetchUserTokens(walletAddress)}
          >
            Refresh
          </Button>
          <Button
            variant="outlined"
            size="small"
            sx={{ mr: 2, borderRadius: 2, textTransform: "none" }}
            onClick={() => {
              // open modal to view/edit sell cart
              setOpenSellModal(true);
            }}
          >
            Open Sell Cart ({sellTokens.length})
          </Button>
        </Box>
      </Box>

      <TableContainer component={Paper} sx={{ borderRadius: 3, border: "1px solid #eee" }}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Token</TableCell>
              <TableCell align="right">Price</TableCell>
              <TableCell align="right">Balance</TableCell>
              <TableCell align="right">Change% (24H)</TableCell>
              <TableCell align="right">Balance in USD</TableCell>
              <TableCell align="center">Action</TableCell>
            </TableRow>
          </TableHead>

          <TableBody>
            {(userTokens || []).map((token: any) => {
              const row: TokenBalanceRow = {
                address: token.address || token.contractAddress || token.tokenAddress || "",
                symbol: token.symbol || token.ticker || "UNKNOWN",
                name: token.name || token.tokenName || "",
                logoURI: token.logoURI || token.logo || "",
                balance: (token.balance || token.formatted || token.amount || 0),
                price: (token.price || token.tokenPrice || 0),
                liquidityPoolSizeUsd: (token.liquidityPoolSizeUsd || token.liquidity || 0),
              };

              const balanceNumber = (row.balance) || 0;
              const priceNumber = (row.price) || 0;
              const balanceUsd = row.usd_value;

              return (
                <TableRow key={row.address}>
                  {/* Logo + Symbol + Name */}
                  <TableCell>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                      {row.logoURI ? (
                        <img
                          src={row.logoURI}
                          alt={row.symbol}
                          width={28}
                          height={28}
                          style={{ borderRadius: "50%", border: `2px solid #ddd` }}
                        />
                      ) : (
                        <Box sx={{ width: 28, height: 28, borderRadius: "50%", background: "#eee" }} />
                      )}
                      <Box>
                        <Typography fontWeight={600}>{row.symbol}</Typography>
                        <Typography variant="body2" color="text.secondary">
                          {row.name}
                        </Typography>
                      </Box>
                    </Box>
                  </TableCell>
 <TableCell sx={{ fontWeight: 500, fontSize: "16px" }} align="right">
                    ${Number(token?.price).toLocaleString(undefined, { maximumFractionDigits: 6 })}
                  </TableCell>
                  {/* Balance */}
                  <TableCell sx={{ fontWeight: 600, fontSize: "16px" }} align="right">
                    {Number(balanceNumber).toLocaleString(undefined, { maximumFractionDigits: 6 })}
                  </TableCell>

                  {/* Liquidity */}
                  <TableCell align="right" sx={{ color: token.change >= 0 ? "green" : "red" }}>
                    {Number(token.change || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })} %
                  </TableCell>

                  {/* Balance in USD */}
                  <TableCell align="right" >
                    ${Number(token?.usd_value)}
                  </TableCell>

                  {/* Action */}
                  <TableCell align="center">
                    <Button
                      variant={isInSellToken(row) ? "outlined" : "contained"}
                      color={isInSellToken(row) ? "inherit" : "primary"}
                      size="small"
                      sx={{ borderRadius: 2, textTransform: "none" }}
                      onClick={() => {
                        if (isInSellToken(row)) {
                          removeSellToken(row.address);
                          toast('Token Removed!', {
  icon: '🗑️',
});
                        } else {
                          // add token object compatible with SwapContext Token type
                          addSellToken({
                            address: row.address,
                            symbol: row.symbol,
                            name: row.name,
                            iconUrl: row.logoURI,
                            amount: String(row.balance ?? "0"),
                            price: row.price,
                            decimals:token.decimals
                          });
                          toast.success('Token added to Sell Cart!')
                        }
                      }}
                    >
                      {isInSellToken(row) ? "Remove" : "Add to Sell Cart"}
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
            {userTokens.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} align="center" sx={{ py: 4 }}>
                  <Typography color="text.secondary">
                    No tokens found for this wallet
                  </Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Sell Cart Modal */}
      <Dialog fullWidth maxWidth="lg" open={openSellModal} onClose={() => setOpenSellModal(false)}>
        <DialogTitle>Sell Cart</DialogTitle>
        <DialogContent dividers>
          {/* Render the SellCart component you already have */}
          <SellCart />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenSellModal(false)}>Close</Button>
          <Button
            variant="contained"
            onClick={() => {
              // optional: could trigger sell from modal as well, but SellCart has its own button
              setOpenSellModal(false);
            }}
          >
            Done
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}