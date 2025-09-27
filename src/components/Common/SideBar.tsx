import React, { useState } from "react";
import {
  Box,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Typography,
  Paper,
  Divider,
} from "@mui/material";
import ShowChartIcon from "@mui/icons-material/ShowChart";
import AccountBalanceWalletIcon from "@mui/icons-material/AccountBalanceWallet";
import SavingsIcon from "@mui/icons-material/Savings";
import ShoppingCartIcon from "@mui/icons-material/ShoppingCart";
import Logo from '../../asset/logo.png'
export default function Sidebar({ selectedTab, setSelectedTab }: { selectedTab: string, setSelectedTab: (tab: string) => void }) {
  //const [selectedTab, setSelectedTab] = useState("Market");

  const mainMenu = [
    { label: "Market", icon: <ShowChartIcon /> },
    { label: "Bundles", icon: <SavingsIcon /> },
    { label: "Positions", icon: <AccountBalanceWalletIcon /> },
    { label: "Yields", icon: <SavingsIcon /> },
  ];

  const secondaryMenu = [
    { label: "Cart", icon: <ShoppingCartIcon /> },
  ];

  return (
    <Paper
      elevation={2}
      sx={{
        width: 260,
        height: "95vh",
        borderRadius: 3,
        p: 2,
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        bgcolor: "white",
      }}
    >
      
      <Box>
        
        {/* <Typography
          variant="h6"
          fontWeight={700}
          sx={{ mb: 2, textAlign: "center", color: "#1976d2" }}
        >
          Nomis
        </Typography> */}
        <Box>
        <img src={Logo.src} className="w-[110px]" />
</Box>
        <Divider sx={{ mb: 2 }} />

        
        <List>
          {mainMenu.map((item) => (
            <ListItem key={item.label} disablePadding sx={{ mb: 1 }}>
              <ListItemButton
                selected={selectedTab === item.label}
                onClick={() => setSelectedTab(item.label)}
                sx={{
                  borderRadius: 2,
                  "&.Mui-selected": {
                    bgcolor: "#1976d2",
                    color: "white",
                    "& .MuiListItemIcon-root": { color: "white" },
                  },
                }}
              >
                <ListItemIcon>{item.icon}</ListItemIcon>
                <ListItemText primary={item.label} />
              </ListItemButton>
            </ListItem>
          ))}
        </List>

        <Divider sx={{ my: 2 }} />

        {/* Secondary Menu (Cart) */}
        <List>
          {secondaryMenu.map((item) => (
            <ListItem key={item.label} disablePadding sx={{ mb: 1 }}>
              <ListItemButton
                selected={selectedTab === item.label}
                onClick={() => setSelectedTab(item.label)}
                sx={{
                  borderRadius: 2,
                  "&.Mui-selected": {
                    bgcolor: "#1976d2",
                    color: "white",
                    "& .MuiListItemIcon-root": { color: "white" },
                  },
                }}
              >
                <ListItemIcon>{item.icon}</ListItemIcon>
                <ListItemText primary={item.label} />
              </ListItemButton>
            </ListItem>
          ))}
        </List>
      </Box>

      {/* Footer */}
      <Box>
        <Divider sx={{ mb: 1 }} />
        <Typography variant="caption" color="text.secondary" textAlign="center">
          v1.0.0
        </Typography>
      </Box>
    </Paper>
  );
}
