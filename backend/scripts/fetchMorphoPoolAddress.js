const { request, gql } = require("graphql-request");
require("dotenv").config();

const MORPHO_BLUE_SUBGRAPH_URL = `https://gateway.thegraph.com/api/${process.env.GRAPHQL_API_KEY}/subgraphs/id/71ZTy1veF9twER9CLMnPWeLQ7GZcwKsjmygejrgKirqs`;

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
      id
      name
      inputToken {
        symbol
      }
      irm
    }
  }
}
`;

async function fetchMorphoPoolAddress() {
  try {
    const data = await request(MORPHO_BLUE_SUBGRAPH_URL, query);
    const market = data.interestRates[0];

    if (!market) {
      console.log("❌ No USDC lending pools found on Morpho.");
      return;
    }

    const poolAddress = market.market.irm; // `irm` is assumed to be the contract address
    const apy = market.rate;

    console.log(`✅ Best Morpho Blue USDC Pool: ${market.market.name}`);
    console.log(`✅ Pool Address: ${poolAddress}`);
    console.log(`✅ APY: ${apy}%`);

    return { poolAddress, apy };
  } catch (error) {
    console.error("❌ Error fetching Morpho Blue Pool Address:", error);
  }
}

fetchMorphoPoolAddress();
