"use client";

import React, { useState } from "react";
import {
  Typography,
  Box,
  Divider,
  ButtonGroup,
  Button
} from "@mui/material";

import Sidebar from "../Common/SideBar";
import TokenTable from "./components/TableComponents";
import BundleTable from "./components/BundlesTables";
import PositionsTable from "./components/PositionsTable";
import YieldPage from "../Yield/YieldPage";
import BuyCart from "./components/BuyCart";
import { DynamicWidget } from "@dynamic-labs/sdk-react-core";
import { useTokenContext } from "@/context/TokenContext";

/* ---------------- SectionShell ---------------- */
// Rounded card container with sticky header and its own scroll area
function SectionShell({
  header,
  children,
}: {
  header?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Box
      sx={{
        height: "100%",
        width: "100%",
        maxWidth: 1200,                // optional: limit width for readability
        mx: "auto",
        bgcolor: "#fff",
        borderRadius: 3,
        border: "1px solid #e5e7eb",
        boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
        overflow: "hidden",            // keep rounded corners clean
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Sticky header */}
      {header && (
        <Box
          sx={{
            position: "sticky",
            top: 0,
            zIndex: 1,
            bgcolor: "#fff",
            borderBottom: "1px solid #eee",
            px: 3,
            py: 2,
          }}
        >
          {header}
        </Box>
      )}

      {/* Scrollable body */}
      <Box
        sx={{
          flex: 1,
          overflowY: "auto",
          px: 3,
          py: 2,
          scrollbarGutter: "stable both-edges",
          scrollbarWidth: "thin", // Firefox
          "&::-webkit-scrollbar": { width: 8 },
          "&::-webkit-scrollbar-thumb": {
            borderRadius: 999,
            backgroundColor: "rgba(0,0,0,.25)",
          },
        }}
      >
        {children}
      </Box>
    </Box>
  );
}

/* ---------------- MARKET ---------------- */
const Market = () => {
  const { marketTokens, stockTokens, chain } = useTokenContext();
  const [showStocks, setShowStocks] = useState(chain === "ethereum");

  React.useEffect(() => {
    if (chain !== "ethereum") setShowStocks(false);
  }, [chain]);

  const tokens = showStocks && chain === "ethereum" ? stockTokens : marketTokens;

  return (
    <SectionShell
      header={
        <Box sx={{ display: "flex", alignItems: "center" }}>
          {chain === "ethereum" && (
            <ButtonGroup>
              <Button
                variant={!showStocks ? "contained" : "outlined"}
                onClick={() => setShowStocks(false)}
              >
                Tokens
              </Button>
              <Button
                variant={showStocks ? "contained" : "outlined"}
                onClick={() => setShowStocks(true)}
              >
                Stock Tokens
              </Button>
            </ButtonGroup>
          )}
          <Box sx={{ flex: 1 }} />
          <DynamicWidget />
        </Box>
      }
    >
      {tokens.length === 0 ? (
        <Typography>No tokens available</Typography>
      ) : (
        <Box sx={{ display: "grid", gap: 2, overflowX: "auto" }}>
          <TokenTable tokens={tokens} />
        </Box>
      )}
    </SectionShell>
  );
};

/* ---------------- BUNDLES ---------------- */
const Bundles = () => {
  const { bundles, stockBundles, chain }: any = useTokenContext();
  const [showStockBundles, setShowStockBundles] = useState(false);

  const data = showStockBundles && chain === "ethereum" ? stockBundles : bundles;

  return (
    <SectionShell
      header={
        <Box sx={{ display: "flex", alignItems: "center" }}>
          <ButtonGroup>
            <Button
              variant={!showStockBundles ? "contained" : "outlined"}
              onClick={() => setShowStockBundles(false)}
            >
              Bundles
            </Button>
            <Button
              variant={showStockBundles ? "contained" : "outlined"}
              onClick={() => setShowStockBundles(true)}
              disabled={chain !== "ethereum"}
            >
              Stock Bundles
            </Button>
          </ButtonGroup>
          <Box sx={{ flex: 1 }} />
          <DynamicWidget />
        </Box>
      }
    >
      {data.length === 0 ? (
        <Typography>No bundles available</Typography>
      ) : (
        <Box sx={{ display: "grid", gap: 2, overflowX: "auto" }}>
          <BundleTable bundles={data} />
        </Box>
      )}
    </SectionShell>
  );
};

/* ---------------- POSITIONS ---------------- */
const Positions = () => (
  <SectionShell
    header={
      <Box sx={{ display: "flex", alignItems: "center" }}>
        <Typography variant="h6">Portfolio / Positions</Typography>
        <Box sx={{ flex: 1 }} />
        <DynamicWidget />
      </Box>
    }
  >
    <Divider sx={{ mb: 2 }} />
    <PositionsTable />
  </SectionShell>
);

/* ---------------- YIELDS ---------------- */
const Yields = () => (
  <SectionShell header={<Typography variant="h6">Yields</Typography>}>
    <Divider sx={{ mb: 2 }} />
    <YieldPage />
  </SectionShell>
);

/* ---------------- DASHBOARD ---------------- */
export default function Dashboard() {
  const [selectedTab, setSelectedTab] = useState("Market");

  const renderContent = () => {
    switch (selectedTab) {
      case "Market": return <Market />;
      case "Bundles": return <Bundles />;
      case "Positions": return <Positions />;
      case "Yields": return <Yields />;
      case "Cart": return <BuyCart />;
      default: return <Market />;
    }
  };

  return (
    <Box
      sx={{
        display: "flex",
        width: "100vw",
        height: "100vh",
        bgcolor: "#f5f6fa",
        overflow: "hidden",
      }}
    >
      {/* Sidebar */}
      <Box
        sx={{
         
          flexShrink: 0,
        
          boxShadow: 2,
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          height: "100vh",
          p: 2,
          borderRadius: 0,
          
          position: "relative",
          zIndex: 1,
        }}
      >
        <Sidebar setSelectedTab={setSelectedTab} selectedTab={selectedTab} />
      </Box>
      {/* Main Content */}
      <Box
        sx={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          minWidth: 0,
          height: "100vh",
          overflowY: "auto",
          p: 0, // Remove extra padding
          bgcolor: "#f5f6fa", // Match parent bg
          borderRadius: 0, // Remove border radius
        }}
      >
        {/* This scrolls vertically, while each SectionShell also scrolls */}
        <Box
          sx={{
            flex: 1,
            overflowY: "auto",
            p: 2,
          }}
        >
          {renderContent()}
        </Box>
      </Box>
    </Box>
  );
}
