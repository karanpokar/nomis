export function getCoinBundles(coins, limit = 5) {
  // helpers
  const sortBy = (key, desc = true, parser = Number) =>
    [...coins].sort((a, b) => {
      const valA = parser(a[key]) || 0;
      const valB = parser(b[key]) || 0;
      return desc ? valB - valA : valA - valB;
    });

  const topN = (arr) => arr.slice(0, limit);

  const makeBundle = (name, arr) => {
    const marketCaps = arr.map(c => Number(c.marketCap));
    const changes = arr.map(c => Number(c.change));
    const volumes = arr.map(c => Number(c["24hVolume"]));

    return {
      name,
      images: arr.map(c => c.iconUrl),
      minimumBuy: 10,
      marketCap: marketCaps.reduce((a,b)=>a+b,0) / arr.length,
      change: changes.reduce((a,b)=>a+b,0) / arr.length,
      v24hVolume: volumes.reduce((a,b)=>a+b,0) / arr.length,
      coins: arr // full coin objects
    };
  };

  return [
    makeBundle("Top Trending", topN(sortBy("rank", false))),
    makeBundle("Top Volume", topN(sortBy("24hVolume", true))),
    makeBundle("Top Market Cap", topN(sortBy("marketCap", true))),
    makeBundle("Top Gainers", topN(sortBy("change", true))),
    makeBundle("Top Losers", topN(sortBy("change", false))),
    makeBundle("Newest", topN(sortBy("listedAt", true))),
    makeBundle("Oldest", topN(sortBy("listedAt", false))),
  ];
}
