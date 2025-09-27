// src/pages/YieldPage.tsx (or wherever)
"use client";
import React, { useState } from "react";
import { Grid, Paper, Box } from "@mui/material";
export default function YieldPage() {
  const [stakeOpen, setStakeOpen] = useState(false);
  const [unstakeOpen, setUnstakeOpen] = useState(false);
  const [stakeSelection, setStakeSelection] = useState<string[]>([]);
  const [unstakeSelection, setUnstakeSelection] = useState<string[]>([]);

  return (
    <></>
  );
}
