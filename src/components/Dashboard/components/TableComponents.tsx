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
} from "@mui/material";
import { useSwap } from "@/context/SwapContext";
import { SparkLineChart } from "@mui/x-charts"; // Add this import

type Token = {
  uuid: string;
  symbol: string;
  name: string;
  color: string;
  iconUrl: string;
  price: string;
  marketCap: string;
  change: string;
  address: string;
  sparkline?: string[]; // optional sparkline data
};

export default function TokenTable({ tokens }: { tokens: any[] }) {
    const {buyTokens,addBuyToken,removeBuyToken}=useSwap()

    const isStablecoin = (token: Token) => {
  const stables = ["USDC", "USDT", "DAI", "BUSD", "TUSD", "USDP", "FDUSD", "USDS"];
  return (
    stables.includes(token.symbol.toUpperCase()) ||
    token.name.toLowerCase().includes("usd")
  );
};

const isInBuyTokens = (token: Token) => {
  return buyTokens.some((t) => t.address === token.address);
}

//console.log("Tokens in TokenTable:", buyTokens);

// Helper to get sparkline data, fallback to previous value or average if missing or invalid
const getSparklineData = (token: Token) => {
  let raw = Array.isArray(token.sparkline) ? token.sparkline : [];
  let avg = Number(token.price) || 1;
  let result: number[] = [];
  let lastValid = avg;

for (let i = 0; i < 24; i++) {
  let val = Number(raw[i]);
  //console.log("Sparkline value:", val==null,val);
  if (val || val > 0) {
    
    result.push(val);
    lastValid = val;
  } else {
    
    result.push(lastValid);
  }
}

  return result;
};

  return (
    <TableContainer
      component={Paper}
      sx={{ borderRadius: 3, border: "1px solid #eee" }}
    >
      <Table>
        <TableHead>
          <TableRow>
            <TableCell>Token</TableCell>
            <TableCell align="right">Price</TableCell>
            <TableCell align="right">Market Cap</TableCell>
            <TableCell align="right">Change (24h)</TableCell>
            <TableCell align="right">Price last (24h)</TableCell>
            <TableCell align="center">Action</TableCell>
          </TableRow>
        </TableHead>

        <TableBody>
          {(tokens.filter((t) => !isStablecoin(t))).map((token) => (
            <TableRow key={token.uuid}>
              {/* Logo + Symbol + Name */}
              <TableCell>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
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
                  <Box>
                    <Typography fontWeight={600}>{token.symbol}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      {token.name}
                    </Typography>
                  </Box>
                </Box>
              </TableCell>

              {/* Price */}
              <TableCell sx={{
                fontWeight: 600,
                fontSize: '16px'
              }} align="right">
                ${Number(token.price).toLocaleString(undefined, { maximumFractionDigits: 2 })}
              </TableCell>

              {/* Market Cap */}
              <TableCell align="right">
                ${Number(token.marketCap).toLocaleString()}
              </TableCell>

              {/* Change */}
              <TableCell
                align="right"
                sx={{ color: Number(token.change) >= 0 ? "green" : "red" }}
              >
                {token.change}%
              </TableCell>

              {/* Sparkline */}
              <TableCell align="center">
                <Box sx={{ width: 100, height: 40 }}>
                  <SparkLineChart
                    data={getSparklineData(token)}
                    height={40}
                    width={100}
                    curve="linear"
                    showTooltip={false}
                    color={Number(token.change) >= 0 ? "#16a34a" : "#dc2626"} // greenish or redish
                  />
                </Box>
              </TableCell>

              {/* Action */}
              <TableCell align="center">
                <Button
                  variant="contained"
                  size="small"
                  sx={{ borderRadius: 2, textTransform: "none" }}
                  onClick={() => 
                    isInBuyTokens(token) ? removeBuyToken(token?.address) : addBuyToken(token)
                  }
                >
                  {isInBuyTokens(token)?'Remove':"Buy"}
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
