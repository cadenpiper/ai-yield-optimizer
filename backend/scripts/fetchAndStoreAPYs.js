const { request, gql } = require("graphql-request");
require("dotenv").config();
const { ethers } = require("ethers");

/////////////////////////////////////////////////////////////////////////////
/////////// Fetching Pool Addresses from AAVE V3 and Morpho Blue
/////////////////////////////////////////////////////////////////////////////

const provider = new ethers.JsonRpcProvider(`https://base-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`);

const MORPHO_BLUE_SUBGRAPH_URL = `https://gateway.thegraph.com/api/${process.env.GRAPHQL_API_KEY}/subgraphs/id/71ZTy1veF9twER9CLMnPWeLQ7GZcwKsjmygejrgKirqs`;

const POOL_ADDRESSES_PROVIDER = "0xe20fCBdBfFC4Dd138cE8b2E6FBb6CB49777ad64D"; // Aave PoolAddressesProvider on Base

const ABI = [
  "function getPool() external view returns (address)"
];

const morphoPoolQuery = gql`
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

async function getMorphoPoolAddress() {
  try {
    console.log("\nFetching Morpho Blue pool address...");
    const data = await request(MORPHO_BLUE_SUBGRAPH_URL, morphoPoolQuery);
    const market = data.interestRates[0];

    if (!market) {
      console.log("No USDC lending pools found on Morpho.\n");
      return null;
    }

    console.log(`Morpho Pool Address: ${market.market.irm}\n`);
    return market.market.irm;
  } catch (error) {
    console.error("Error fetching Morpho Blue Pool Address:", error);
    return null;
  }
}

async function getAavePoolAddress() {
  try {
    console.log("Fetching Aave V3 pool address...\n");
    const providerContract = new ethers.Contract(POOL_ADDRESSES_PROVIDER, ABI, provider);
    const poolAddress = await providerContract.getPool();
    console.log(`Aave V3 Pool Address: ${poolAddress}`);
    return poolAddress;
  } catch (error) {
    console.error("Error fetching Aave Pool Address:\n", error, "\n");
    return null;
  }
}

/////////////////////////////////////////////////////////////////////////////
/////////// Fetching APYs from AAVE V3 and Morpho Blue
/////////////////////////////////////////////////////////////////////////////

const apiKey = process.env.GRAPHQL_API_KEY;

const morphoEndpoint = `https://gateway.thegraph.com/api/${apiKey}/subgraphs/id/71ZTy1veF9twER9CLMnPWeLQ7GZcwKsjmygejrgKirqs`;
const aaveEndpoint = `https://gateway.thegraph.com/api/${apiKey}/subgraphs/id/GQFbb95cE6d8mV989mL5figjaGaKCQB3xqYrr1bRyXqF`;

const morphoAPYQuery = gql`
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

const aaveAPYQuery = gql`
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

async function fetchMorphoAPY(morphoPoolAddress) {
  try {
    if (!morphoPoolAddress) throw new Error("Morpho pool address is missing.");

    console.log("\nFetching Morpho Blue APY...");
    const data = await request(morphoEndpoint, morphoAPYQuery);
    const market = data.interestRates[0];

    if (!market) {
      console.log("No USDC lending pools found.\n");
      return;
    }

    const morphoAPY = Number(market.rate).toFixed(2);
    console.log(`Best Morpho USDC Pool: ${market.market.name}`);
    console.log(`APY: ${morphoAPY}%`);
    console.log(`Pool Address: ${morphoPoolAddress}\n`);

    return { poolAddress: morphoPoolAddress, poolName: market.market.name, apy: morphoAPY };
  } catch (error) {
    console.error("Error fetching Morpho APY:\n", error, "\n");
  }
}

async function fetchAaveAPY(aavePoolAddress) {
  try {
    if (!aavePoolAddress) throw new Error("Aave pool address is missing.");

    console.log("Fetching Aave V3 APY...\n");
    const data = await request(aaveEndpoint, aaveAPYQuery);
    const reserve = data.reserves[0];

    if (!reserve) {
      console.log("No USDC lending pools found.\n");
      return;
    }

    const rawApy = reserve.liquidityRate;
    const formattedApy = (Number(rawApy) / 1e27) * 100;
    const aaveAPY = formattedApy.toFixed(2)

    console.log(`Best Aave V3 USDC Pool: ${reserve.name}`);
    console.log(`APY: ${aaveAPY}%`);
    console.log(`Pool Address: ${aavePoolAddress}\n`);

    return { poolAddress: aavePoolAddress, poolName: reserve.name, apy: aaveAPY };
  } catch (error) {
    console.error("Error fetching Aave APY:\n", error, "\n");
  }
}

/////////////////////////////////////////////////////////////////////////////
/////////// Store APY data on APYStorage.sol file
/////////////////////////////////////////////////////////////////////////////

const RPC_URL_SEPOLIA = "https://base-sepolia.g.alchemy.com/v2/" + process.env.ALCHEMY_API_KEY;
const sepoliaProvider = new ethers.JsonRpcProvider(RPC_URL_SEPOLIA);

const signer = new ethers.Wallet(process.env.PRIVATE_KEY, sepoliaProvider);

const APY_STORAGE_ADDRESS = "0xce52BC5c88c7bD76b17e05674e33380AA892D491"; // APY Storage contract on Base Sepolia

const APY_STORAGE_ABI = [
  "function updateAPY(address _pool, uint256 _newAPY) external"
];

const apyStorage = new ethers.Contract(APY_STORAGE_ADDRESS, APY_STORAGE_ABI, signer);

async function storeAPYs(morphoPoolAddress, aavePoolAddress, morphoAPY, aaveAPY) {
  try {
    console.log(`Updating APYs in contract...`);
    console.log(`Aave Pool: ${aavePoolAddress} | APY: ${aaveAPY / 1e2}%`);
    console.log(`Morpho Pool: ${morphoPoolAddress} | APY: ${(morphoAPY / 1e2).toFixed(2)}%`);

    await safeUpdateAPY(aavePoolAddress, aaveAPY, "Aave");
    await safeUpdateAPY(morphoPoolAddress, morphoAPY, "Morpho");

  } catch (error) {
    console.error("Error fetching APYs:", error);
  }
}

async function safeUpdateAPY(poolAddress, formattedAPY, name) {
  try {
    const tx = await apyStorage.updateAPY(poolAddress, formattedAPY);
    await tx.wait();
    console.log(`Successfully updated ${name} APY: ${formattedAPY / 1e2}%`);
    
  } catch (error) {
    if (error.reason && error.reason.includes("APY Has not changed")) {
      console.log(`${name} APY is unchanged, skipping update.`);
    } else {
      console.error(`Error updating ${name} APY:`, error);
    }
  }
}

/////////////////////////////////////////////////////////////////////////////
/////////// Running Everything in Sequence
/////////////////////////////////////////////////////////////////////////////

async function main() {
  console.log("\n\n\nFetching pool addresses...");

  // Fetch pool addresses
  const [morphoPoolAddress, aavePoolAddress] = await Promise.all([
    getMorphoPoolAddress(),
    getAavePoolAddress(),
  ]);

  if (!morphoPoolAddress || !aavePoolAddress) {
    console.error("Failed to fetch one or both pool addresses. Exiting.");
    return;
  }

  console.log("\n\nFetching APY data...");

  // Fetch APY data
  const [morphoAPYData, aaveAPYData] = await Promise.all([
    fetchMorphoAPY(morphoPoolAddress),
    fetchAaveAPY(aavePoolAddress),
  ]);

  if (!morphoAPYData || !aaveAPYData) {
    console.error("Failed to fetch one or both APY values. Exiting.");
    return;
  }

  console.log("\n\nAll APY data fetched successfully.\n");

  await storeAPYs(
    morphoPoolAddress,
    aavePoolAddress,
    parseFloat(morphoAPYData.apy) * 1e2,
    parseFloat(aaveAPYData.apy) * 1e2
  );
}

main();
