'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { ethers } from 'ethers';
import { useDynamicContext } from '@dynamic-labs/sdk-react-core';
import { getUniversalLink } from '@selfxyz/core';
import { SelfAppBuilder, SelfQRcodeWrapper, type SelfApp } from '@selfxyz/qrcode';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  IconButton,
  Typography,
  Link,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';

type VerificationCtx = {
  isVerified: boolean;
  isUSUser: boolean;
  loading: boolean;
  openVerify: () => void;
  closeVerify: () => void;
  reloadStatus: () => Promise<void>;
  showQR: boolean;
  selfApp: SelfApp | null;
  handleSuccess: (proofPayload: string, details?: any) => Promise<void>;
  setShowQR:any
};

const VerificationContext = createContext<VerificationCtx | undefined>(undefined);

// --- Minimal ABI
const CONTRACT_ABI = [
  'function scope() view returns (uint256)',
  'function isVerified(address user) view returns (bool)',
];

const CONTRACT_ADDRESS = (process.env.NEXT_PUBLIC_SELF_CONTRACT?.toLowerCase() || '') as `0x${string}`;
const RPC_URL =
  (process.env.NEXT_PUBLIC_CELO_RPC || 'https://forno.celo-sepolia.celo-testnet.org').trim();
const CHAIN_ID = Number(process.env.NEXT_PUBLIC_CHAIN_ID || 11142220);

export const VerificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { primaryWallet } = useDynamicContext();
  const userAddress = (primaryWallet?.address || '').toLowerCase();

  const [loading, setLoading] = useState(true);
  const [isVerified, setIsVerified] = useState(false);
  const [isUSUser, setIsUSUser] = useState(false);

  const [showQR, setShowQR] = useState(false);
  const [selfApp, setSelfApp] = useState<SelfApp | null>(null);
  const [scope, setScope] = useState<bigint | null>(null);

  // Reader (no signer needed)
  const reader = useMemo(() => new ethers.JsonRpcProvider(RPC_URL), []);

  // --- helpers
  const readIsVerified = useCallback(
    async (addr: string) => {
      if (!addr || !CONTRACT_ADDRESS) return false;
      const c = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, reader);
      try {
        return (await c.isVerified(addr)) as boolean;
      } catch {
        return false;
      }
    },
    [reader]
  );

  const pollUntilVerified = useCallback(
    async (addr: string, intervalMs = 2500, maxAttempts = 24) => {
      for (let i = 0; i < maxAttempts; i++) {
        const ok = await readIsVerified(addr);
        if (ok) return true;
        await new Promise((r) => setTimeout(r, intervalMs));
      }
      return false;
    },
    [readIsVerified]
  );

  // Reload status (scope + current wallet verification)
  const reloadStatus = useCallback(async () => {
    setLoading(true);
    try {
      if (!CONTRACT_ADDRESS) throw new Error('Missing NEXT_PUBLIC_SELF_CONTRACT');
      const c = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, reader);
      const s: bigint = await c.scope();
      setScope(s);

      if (userAddress) {
        const v = await c.isVerified(userAddress);
        setIsVerified(v);
      } else {
        setIsVerified(false);
      }
    } catch (err) {
      console.error('Failed to reload verification status', err);
    } finally {
      setLoading(false);
    }
  }, [reader, userAddress]);

  useEffect(() => {
    reloadStatus();
  }, [reloadStatus]);

  // Re-check when wallet changes
  useEffect(() => {
    if (!userAddress) return;
    (async () => {
      const v = await readIsVerified(userAddress);
      setIsVerified(v);
    })();
  }, [userAddress, readIsVerified]);

  // Build Self app once scope is known
  useEffect(() => {
    if (!scope || !CONTRACT_ADDRESS) return;
    try {
      const app = new SelfAppBuilder({
        version: 2,
        appName: process.env.NEXT_PUBLIC_SELF_APP_NAME || 'Nomis Verify',
        scope: 'proof-of-human-nomis',            // ✅ use on-chain numeric scope
        endpoint: CONTRACT_ADDRESS,         // ✅ your contract
         endpointType: 'staging_celo',                // ✅ on-chain/contract endpoint
        logoBase64: 'https://i.postimg.cc/mrmVf9hm/self.png',
        userIdType: 'hex',
        userId: userAddress || ethers.ZeroAddress,
        disclosures: {
          minimumAge: 18,
          ofac: true,
          excludedCountries: ['USA'],
          nationality: true,
        },
      }).build();
      setSelfApp(app);
    } catch (err) {
        setShowQR(false);
        
      console.error('Failed to build SelfApp', err);
    }
  }, [scope, userAddress]);

  const openVerify = useCallback(() => setShowQR(true), []);
  const closeVerify = useCallback(() => setShowQR(false), []);

  // --- RELAYER FLOW: no local tx; poll contract until relayer updates storage
  const handleSuccess = useCallback(
    async (proofPayload: string, details?: any) => {
      try {
        // Set US flag for UI (if disclosure provided)
        const nat =
          details?.disclosures?.nationality?.code ??
          details?.nationality?.code ??
          details?.nationality;
        if (typeof nat === 'string') setIsUSUser(nat.toUpperCase() === 'USA');

        // Determine which address to poll
        const addr = userAddress;
        if (!addr) {
          console.warn('No connected wallet; cannot poll isVerified.');
          // You may close the modal or leave it open; choosing to close:
          setShowQR(false);
          return;
        }

        // Optional: if details contains a txHash from relayer, you could wait for it:
        // const txHash = details?.txHash || details?.transactionHash;
        // if (txHash) await reader.waitForTransaction(txHash, 1);

        // Poll contract until verified flips to true
        const ok = await pollUntilVerified(addr, 2500, 24); // ~60s
        if (ok) {
          setIsVerified(true);
          setShowQR(false);
        } else {
          console.warn('Timed out waiting for on-chain verification.');
          // keep open or close with a toast; here we keep it open
        }
      } catch (err) {
        console.error('Relayer flow: verification tracking failed', err);
      }
    },
    [userAddress, pollUntilVerified]
  );

  return (
    <VerificationContext.Provider
      value={{
        isVerified,
        isUSUser,
        loading,
        openVerify,
        closeVerify,
        reloadStatus,
        showQR,
        selfApp,
        handleSuccess,
        setShowQR
      }}
    >
      {children}

    
    </VerificationContext.Provider>
  );
};

export const useVerification = () => {
  const ctx = useContext(VerificationContext);
  if (!ctx) throw new Error('useVerification must be used within VerificationProvider');
  return ctx;
};
