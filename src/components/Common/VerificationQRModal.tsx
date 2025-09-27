'use client';

import React from 'react';
import { Dialog, DialogTitle, DialogContent, IconButton, Typography, Link } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { getUniversalLink } from '@selfxyz/core';
import { SelfQRcodeWrapper } from '@selfxyz/qrcode';
import { useVerification } from '../../context/VerificationContext';

const VerificationQRModal: React.FC = () => {
  const { showQR, closeVerify, selfApp, handleSuccess,setShowQR } = useVerification();

  return (
    <Dialog open={showQR}  onClose={closeVerify} fullWidth maxWidth="lg" >
      <DialogTitle>
        Verify your identity
        <IconButton
          aria-label="close"
          onClick={closeVerify}
          sx={{ position: 'absolute', right: 8, top: 8 }}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ textAlign: 'center', pb: 3 }}>
        <Typography variant="body2" sx={{ mb: 2 }}>
          Scan this QR code with the Self app to verify your identity.
        </Typography>

        {selfApp ? (
          <SelfQRcodeWrapper
            selfApp={selfApp}
            /* @ts-ignore */
            onSuccess={handleSuccess}
            onError={(e) => {
              console.error('Self QR Error:', e);
              setShowQR(false);
              alert('Verification failed, please try again.');
            }}
          />
        ) : (
          <Typography>Loading QR…</Typography>
        )}

        {selfApp && (
          <Link
            href={getUniversalLink(selfApp)}
            target="_blank"
            rel="noreferrer"
            underline="hover"
            sx={{ display: 'block', mt: 2 }}
          >
            Open in Self App
          </Link>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default VerificationQRModal;
