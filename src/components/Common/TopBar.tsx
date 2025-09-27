"use client";
import React, { useState } from "react";
import {
  AppBar,
  Toolbar,
  Typography,
  Box,
  Select,
  MenuItem,
  Button,
  Paper,
} from "@mui/material";
import { networks } from "@/constants/network";

import { DynamicWidget, useDynamicContext, useSwitchNetwork } from "@dynamic-labs/sdk-react-core";
//import { useUser } from "@/context/UserContext";

// Mock chains




export default function TopBar() {
    //const {chain, setChain}=useMarket();
    //const {switchChain}=useUser();
  const switchNetwork = useSwitchNetwork();
  const { primaryWallet } = useDynamicContext();

const getNetworkByValue=(networkValue:string) => {
    return networks?.find(n => n.value === networkValue) || null;
  }


  return (
    <Box
    
      sx={{
        height: 64,
        borderRadius: 3,
        mb: 2,
        px: 3,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
      }}
    >
      {/* Left: Title */}
      <Typography variant="h6" fontWeight={700}>
        Welcome
      </Typography>

      {/* Right: Chain Switch + Wallet/Login */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
        {/* Chain Switch */}
       

        {/* Wallet / Login */}
       <DynamicWidget />
      </Box>
    </Box>
  );
}

{/*
   <Select
          size="small"
          value={chain}
          onChange={async(e) => {
            setChain(e.target.value)
            
            await switchNetwork({ wallet: primaryWallet, network: getNetworkByValue(e.target.value)?.chainId })
            switchChain(e.target.value)} }
          sx={{
            borderRadius: 2,
            bgcolor: "#f5f5f5",
            minWidth: 140,
          }}
        >
          {networks.map((c) => (
            <MenuItem key={c.chainId} value={c.label}>
              {c.label}
            </MenuItem>
          ))}
        </Select>
  */}