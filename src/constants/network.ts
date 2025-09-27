
const alchemyKey=process.env.NEXT_ALCHEMY_KEY

export const networks = [
  
  {
    label: "Ethereum",
    value: "ethereum",
    chainId: 1,
     isActive:true,
    rpc: `https://eth-mainnet.g.alchemy.com/v2/${alchemyKey}`,
    logo: "https://static.alchemyapi.io/images/emblems/eth-mainnet.svg",
    explorer: "https://etherscan.io",
  },
  {
    label: "Polygon",
    value: "polygon",
    rpc: `https://polygon-mainnet.g.alchemy.com/v2/${alchemyKey}`,
    chainId: 137,
     isActive:true,
    logo: "https://static.alchemyapi.io/images/emblems/matic-mainnet.svg",
    explorer: "https://polygonscan.com",
  },
    {
    label: "Sonic",
    value: "sonic",
    chainId: 146,
     isActive:true,
    rpc: "https://sonic-rpc.publicnode.com",
    logo: "https://icons.llamao.fi/icons/chains/rsz_sonic.jpg",
    explorer: "https://sonicscan.org",
  },
  {
    label: "BASE",
    value: "base",
    chainId: 8453,
     isActive:true,
    rpc: `https://base-mainnet.g.alchemy.com/v2/${alchemyKey}`,
    logo: "https://static.alchemyapi.io/images/emblems/base-mainnet.svg",
    explorer: "https://basescan.org",
  },
  {
    label: "Arbitrum",
    value: "arbitrum",
    chainId: 42161,
     isActive:true,
    rpc: `https://arb-mainnet.g.alchemy.com/v2/${alchemyKey}`,
    logo: "https://static.alchemyapi.io/images/emblems/arb-mainnet.svg",
    explorer: "https://arbiscan.io",
   
  },
  {
    label: "Optimism",
    value: "optimism",
    chainId: 10,
     isActive:true,
    rpc: `https://opt-mainnet.g.alchemy.com/v2/${alchemyKey}`,
    logo: "https://static.alchemyapi.io/images/emblems/opt-mainnet.svg",
    explorer: "https://optimistic.etherscan.io",
   
  },
];

export const getNetworkById=(chainId: number) => {
  return networks.find((n) => n.chainId === chainId);
}

export const getRPCByNetwork=(network: string) => {
  return networks.find((n) => n.value === network)?.rpc;
}

export const getNetworkByValue=(value: string) => {
  return networks.find((n) => n.value === value);
}

export const defaultNetwork = networks[0];  