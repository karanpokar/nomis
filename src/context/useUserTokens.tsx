import { useState, useCallback } from 'react';

// Types based on Moralis API response
interface MoralisTokenResponse {
  cursor: string;
  page: number;
  page_size: number;
  result: MoralisToken[];
}

interface MoralisToken {
  token_address: string;
  symbol: string;
  name: string;
  logo: string;
  thumbnail: string;
  decimals: string;
  balance: string;
  possible_spam: string;
  verified_contract: boolean;
  balance_formatted: string;
  usd_price: number;
  usd_price_24hr_percent_change: number;
  usd_price_24hr_usd_change: number;
  usd_value: number;
  usd_value_24hr_usd_change: number;
  native_token: boolean;
  portfolio_percentage: number;
}

// Normalized token interface compatible with your table
interface UserToken {
  address: string;
  symbol: string;
  name: string;
  logoURI: string;
  balance: string;
  balance_formatted: string;
  price: number;
  usd_value: number;
  decimals: string;
  verified_contract: boolean;
  native_token: boolean;
  possible_spam: string;
  change:number;
  liquidityPoolSizeUsd: number; // Default to 0 for Moralis data
}

interface UseUserTokensOptions {
  apiKey: string | null;
}

interface UseUserTokensReturn {
  userTokens: UserToken[];
  loading: boolean;
  error: string | null;
  fetchUserTokens: (walletAddress: string, chain?: string) => Promise<void>;
}

export const useUserTokens = (): UseUserTokensReturn => {
  const [userTokens, setUserTokens] = useState<UserToken[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
    const apiKey = process.env.NEXT_PUBLIC_MORALIS_API_KEY || null;
  const fetchUserTokens = useCallback(async (walletAddress: string, chain: string = 'eth'): Promise<void> => {
    if (!apiKey || !walletAddress) {
      setError('API key and wallet address are required');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const url = `https://deep-index.moralis.io/api/v2.2/wallets/${walletAddress}/tokens?chain=${chain}`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'accept': 'application/json',
          'X-API-Key': apiKey,
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data: MoralisTokenResponse = await response.json();

      // Transform Moralis tokens to match your table structure
      const transformedTokens: UserToken[] = data.result.map((token: MoralisToken) => ({
        address: token.token_address,
        symbol: token.symbol,
        name: token.name,
        logoURI: token.logo || token.thumbnail,
        balance: token.balance_formatted,
        balance_formatted: token.balance_formatted,
        price: token.usd_price || 0,
        usd_value: token.usd_value || 0,
        decimals: token.decimals,
        verified_contract: token.verified_contract,
        native_token: token.native_token,
        possible_spam: token.possible_spam,
        change:token?.usd_price_24hr_percent_change,
        liquidityPoolSizeUsd: 0, // Moralis doesn't provide this, defaulting to 0
      }));

      setUserTokens(transformedTokens);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred';
      setError(errorMessage);
      console.error('Error fetching user tokens:', err);
    } finally {
      setLoading(false);
    }
  }, [apiKey]);

  return {
    userTokens,
    loading,
    error,
    fetchUserTokens,
  };
};

