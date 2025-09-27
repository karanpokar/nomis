// src/components/UnstakeModal.tsx
"use client";
import React, { useEffect, useMemo, useState, useCallback } from "react";
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
  Chip,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import { useUser } from "@/context/UserContext";

export default function UnstakeModal({
  open,
  onClose,
  selectedPositions,
}: {
  open: boolean;
  onClose: () => void;
  selectedPositions: string[];
}) {
  

 

  return (
 <></>
  );
}
