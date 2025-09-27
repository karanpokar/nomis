// src/components/StakeModal.tsx
"use client";
import React, { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Box,
  Typography,
  IconButton,
  Divider,
  Alert,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import { useUser } from "@/context/UserContext";

export default function StakeModal({
  open,
  onClose,
  selectedAssets,
}: {
  open: boolean;
  onClose: () => void;
  selectedAssets: string[];
}) {

  

  return (
   <></>
  );
}
