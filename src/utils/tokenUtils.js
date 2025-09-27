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

// Group stocks by tag and return top-5 by marketCap for each tag
export function getStockBundlesByTag(stocks, limit = 5) {
  const grouped = stocks.reduce((acc, stock) => {
    const tag = stock.tag || "Other";
    if (!acc[tag]) acc[tag] = [];
    acc[tag].push(stock);
    return acc;
  }, {});

  const sortByMarketCap = arr =>
    [...arr].sort((a, b) => Number(b.marketCap || 0) - Number(a.marketCap || 0));

  const makeBundle = (tag, arr) => ({
    name: tag.charAt(0).toUpperCase() + tag.slice(1), // Add name for display
    tag,
    images: arr.map(c => c.iconUrl),
    minimumBuy: 10,
    marketCap: arr.reduce((a, b) => a + Number(b.marketCap || 0), 0) / arr.length,
    change: arr.reduce((a, b) => a + Number(b.change || 0), 0) / arr.length,
    v24hVolume: arr.reduce((a, b) => a + Number(b["24hVolume"] || 0), 0) / arr.length,
    coins: arr
  });

  return Object.entries(grouped).map(([tag, arr]) =>
    makeBundle(tag, sortByMarketCap(arr).slice(0, limit))
  );
}
