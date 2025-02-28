const { request, gql } = require("graphql-request");
require("dotenv").config();

const apiKey = process.env.GRAPHQL_API_KEY;

const endpoint = `https://gateway.thegraph.com/api/${apiKey}/subgraphs/id/71ZTy1veF9twER9CLMnPWeLQ7GZcwKsjmygejrgKirqs`;

const query = gql`
{
  interestRates(
    where: { market_: { inputToken: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" }, side: LENDER } 
    orderBy: rate
    orderDirection: desc
    first: 1
  ) {
    id
    rate
    market {
      name
    }
  }
}
`;

async function fetchMorphoAPY() {
  try {
    const data = await request(endpoint, query);
    const market = data.interestRates[0];

    if (!market) {
      console.log("No USDC lending pools found.");
      return;
    }

    const rawApy = Number(market.rate).toFixed(2);

    console.log(`Best USDC Pool: ${market.market.name} | APY: ${rawApy}%`);

    return { poolName: market.market.name, apy: rawApy };
  } catch (error) {
    console.error("Error fetching Morpho APY:", error);
  }
}

fetchMorphoAPY();
