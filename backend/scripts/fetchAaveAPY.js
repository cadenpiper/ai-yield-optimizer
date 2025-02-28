const { request, gql } = require("graphql-request");
require("dotenv").config();

const apiKey = process.env.GRAPHQL_API_KEY;

const endpoint = `https://gateway.thegraph.com/api/${apiKey}/subgraphs/id/GQFbb95cE6d8mV989mL5figjaGaKCQB3xqYrr1bRyXqF`;

const query = gql`
{
  reserves(
    where: { underlyingAsset: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" }
    first: 1
  ) {
    id
    name
    symbol
    liquidityRate
  }
}
`;

async function fetchAaveAPY() {
  try {
    const data = await request(endpoint, query);
    const reserve = data.reserves[0];

    if (!reserve) {
      console.log("No USDC lending pools found.");
      return;
    }

    const rawApy = reserve.liquidityRate;
    const formattedApy = (Number(rawApy) / 1e27) * 100;

    console.log(`Best Aave V3 USDC Pool: ${reserve.name} | APY: ${formattedApy.toFixed(2)}%`);

    return { poolName: reserve.name, apy: formattedApy.toFixed(2) };
  } catch (error) {
    console.error("Error fetching Aave APY:", error);
  }
}

fetchAaveAPY();
