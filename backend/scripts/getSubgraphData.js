const { request, gql } = require("graphql-request");
require("dotenv").config();
const { ethers } = require("ethers");

// SUBGRAPH ENDPOINTS
const AAVEV3_ARB_SUBGRAPH_URL = `https://gateway.thegraph.com/api/${process.env.GRAPHQL_API_KEY}/subgraphs/id/4xyasjQeREe7PxnF6wVdobZvCw5mhoHZq3T7guRpuNPf`;
const COMPOUNDV3_ARB_SUBGRAPH_URL = `https://gateway.thegraph.com/api/${process.env.GRAPHQL_API_KEY}/subgraphs/id/5MjRndNWGhqvNX7chUYLQDnvEgc8DaH8eisEkcJt71SR`;

const baseQuery = gql`
  {
    markets(where: { inputToken_: { symbol: "USDC" } }) {
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

function splitCompoundMarketId(marketId) {
  if (!marketId || !marketId.startsWith("0x") || marketId.length < 82) {
    return null;
  }

  const cometAddress = marketId.slice(0, 42);
  const tokenAddress = "0x" + marketId.slice(-40);

  if (!ethers.isAddress(cometAddress) || !ethers.isAddress(tokenAddress)) {
    return null;
  }

  return { cometAddress, tokenAddress };
}

async function findBestMarket(name, url, isCompound = false) {
  try {
    const response = await request(url, baseQuery);
    const markets = response.markets;

    if (!markets || markets.length === 0) {
      console.log(`No market data found for ${name}.`);
      return null;
    }

    let bestMarket = null;
    let highestRate = 0;

    for (const market of markets) {
      const lenderRate = market.rates[0];
      if (lenderRate) {
        const rate = parseFloat(lenderRate.rate);
        if (rate > highestRate) {
          highestRate = rate;
          bestMarket = {
            id: market.id,
            rate,
            utilization:
              parseFloat(market.totalBorrowBalanceUSD) /
              parseFloat(market.totalDepositBalanceUSD)
          };
        }
      }
    }

    if (bestMarket) {
      console.log(`\n🔹 Best USDC Lending Market on ${name} 🔹`);

      if (isCompound) {
        const split = splitCompoundMarketId(bestMarket.id);
        if (split) {
          console.log("Comet (Pool) Address:     ", split.cometAddress);
        } else {
          console.log("Could not split Compound market ID:", bestMarket.id);
        }
      } else {
        console.log("Market ID:                ", bestMarket.id);
      }

      console.log("Lending Rate:             ", bestMarket.rate.toFixed(2) + "%");
      console.log("Utilization Rate:         ", (bestMarket.utilization * 100).toFixed(2) + "%");
    }

    return bestMarket;
  } catch (error) {
    console.error(`Error querying ${name} subgraph:`, error);
    return null;
  }
}

async function run() {
  await findBestMarket("Aave", AAVEV3_ARB_SUBGRAPH_URL);
  await findBestMarket("Compound", COMPOUNDV3_ARB_SUBGRAPH_URL, true);
}

run();
