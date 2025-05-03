const { request, gql } = require("graphql-request");
require("dotenv").config();
const { ethers } = require("ethers");

// CONFIGURATION
const provider = new ethers.JsonRpcProvider(
  `https://arb-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`
);

// SUBGRAPH ENDPOINT
const AAVEV3_ARB_SUBGRAPH_URL = `https://gateway.thegraph.com/api/${process.env.GRAPHQL_API_KEY}/subgraphs/id/4xyasjQeREe7PxnF6wVdobZvCw5mhoHZq3T7guRpuNPf`;

// AAVE V3 QUERY
const aaveQuery = gql`
{
  markets(
    where: { inputToken_: { symbol: "USDC" } }
  ) {
    id
    inputToken {
      symbol
    }
    totalDepositBalanceUSD
    totalBorrowBalanceUSD
    rates(where: { side: LENDER }) {
      rate
    }
  }
}
`;

async function queryAave() {
  try {
    const response = await request(AAVEV3_ARB_SUBGRAPH_URL, aaveQuery);

    if (!response.markets || response.markets.length === 0) {
      console.log("No market data found for Aave.");
      return null;
    }

    const markets = response.markets;
    let bestMarket = null;
    let highestRate = 0;

    for (const market of markets) {
      const lenderRateObject = market.rates[0];
      if (lenderRateObject) {
        const rate = parseFloat(lenderRateObject.rate);
        if (rate > highestRate) {
          highestRate = rate;
          bestMarket = {
            marketId: market.id,
            lendingRate: rate,
            utilizationRate:
              parseFloat(market.totalBorrowBalanceUSD) /
              parseFloat(market.totalDepositBalanceUSD)
          };
        }
      }
    }

    if (bestMarket) {
      console.log("\nBest USDC Lending Market on Aave:");
      console.log("Market ID:       ", bestMarket.marketId);
      console.log("Lending Rate:    ", bestMarket.lendingRate.toFixed(2) + "%");
      console.log("Utilization Rate:", (bestMarket.utilizationRate * 100).toFixed(2) + "%");
    }

    return bestMarket;
  } catch (error) {
    console.error("Error querying Aave subgraph:", error);
    return null;
  }
}

queryAave();
