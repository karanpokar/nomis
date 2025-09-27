// src/pages/YieldPage.tsx (or wherever)
"use client";
import React, { useState } from "react";
import { Grid, Paper, Box } from "@mui/material";
//import AvailableToStakeList from "./AvailableToStakeList";
//import PositionsList from "./PositionList";
//import StakeModal from "./StakeModal";
//import UnstakeModal from "./UnstakeModal";

export default function YieldPage() {
  const [stakeOpen, setStakeOpen] = useState(false);
  const [unstakeOpen, setUnstakeOpen] = useState(false);
  const [stakeSelection, setStakeSelection] = useState<string[]>([]);
  const [unstakeSelection, setUnstakeSelection] = useState<string[]>([]);

  return (
    <></>
    // <Box p={2}>
    //   <Grid container spacing={2}>
    //     <Box >
    //       <Paper sx={{ p: 2 }}>
    //         <AvailableToStakeList
    //           onOpenStake={(selected) => {
    //             setStakeSelection(selected);
    //             setStakeOpen(true);
    //           }}
    //         />
    //       </Paper>
    //     </Box>

    //     <Box  >
    //       <Paper sx={{ p: 2 }}>
    //         <PositionsList
    //           onOpenUnstake={(selected) => {
    //             setUnstakeSelection(selected);
    //             setUnstakeOpen(true);
    //           }}
    //         />
    //       </Paper>
    //     </Box>
    //   </Grid>

    //   <StakeModal open={stakeOpen} onClose={() => setStakeOpen(false)} selectedAssets={stakeSelection} />
    //   <UnstakeModal open={unstakeOpen} onClose={() => setUnstakeOpen(false)} selectedPositions={unstakeSelection} />
    // </Box>
  );
}
