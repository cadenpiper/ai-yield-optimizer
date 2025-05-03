const { request, gql } = require("graphql-request");
require("dotenv").config();
const { ethers } = require("ethers");

/////////////////////////////////////////////////////////////////////////////
/////////// CONFIGURATION & PROVIDERS
/////////////////////////////////////////////////////////////////////////////

// Querying subgraphs on Base mainnet
const provider = new ethers.JsonRpcProvider(`https://base-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`);

// Signing transactions on Base Sepolia (Storing APYs in APYStorage.sol)
const sepoliaProvider = new ethers.JsonRpcProvider(`https://base-sepolia.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`)
const signer = new ethers.Wallet(process.env.PRIVATE_KEY, sepoliaProvider);

/////////////////////////////////////////////////////////////////////////////
/////////// SUBGRAPH ENDPOINTS
/////////////////////////////////////////////////////////////////////////////

// Replace Moonwell and integrate Compound V3 (Comet)
const MOONWELL_SUBGRAPH_URL = `https://gateway.thegraph.com/api/${process.env.GRAPHQL_API_KEY}/subgraphs/id/33ex1ExmYQtwGVwri1AP3oMFPGSce6YbocBP7fWbsBrg`;
const AAVE_V3_SUBGRAPH_URL = `https://gateway.thegraph.com/api/${process.env.GRAPHQL_API_KEY}/subgraphs/id/GQFbb95cE6d8mV989mL5figjaGaKCQB3xqYrr1bRyXqF`;

/////////////////////////////////////////////////////////////////////////////
/////////// FETCH POOL ADDRESSES
/////////////////////////////////////////////////////////////////////////////

const POOL_ADDRESSES_PROVIDER = "0xe20fCBdBfFC4Dd138cE8b2E6FBb6CB49777ad64D"; // Aave PoolAddressesProvider on Base
const ABI = [
  "function getPool() external view returns (address)"
];

// Either call smart contracts like Aave above or query The Graph for Compound V3
const moonwellQuery = gql`
{
  markets(where: { inputToken_: { symbol: "USDC" } }) {
    id
    name
    inputToken {
      symbol
    }
    rates(
      where: { side: LENDER }
      orderBy: rate
      orderDirection: desc
      first: 1
    ) {
      rate
      type
      side
    }
  }
}
`;

// Add getCompoundPoolAddress(), delete Moonwell
async function getMoonwellPoolAddress() {
  try {
    console.log("\nFetching Moonwell pool address...");
    const data = await request(MOONWELL_SUBGRAPH_URL, moonwellQuery);
    
    if (!data.markets || data.markets.length === 0) {
      console.log("No USDC lending pools found on Moonwell.\n");
      return null;
    }

    const market = data.markets[0];
    console.log(`Moonwell Pool Address: ${market.id}`);

    return market.id;
  } catch (error) {
    console.error("Error fetching Moonwell Pool Address:", error);
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
/////////// FETCH APYs
/////////////////////////////////////////////////////////////////////////////

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

// Add fetchCompoundAPY(), delete Moonwell
async function fetchMoonwellAPY() {
  try {
    console.log("\nFetching Moonwell APY...");

    const data = await request(MOONWELL_SUBGRAPH_URL, moonwellQuery);

    if (!data?.markets || data.markets.length === 0) {
      console.log("No Moonwell lending pools found.\n");
      return;
    }

    const market = data.markets[0];

    if (!market.rates || market.rates.length === 0) {
      console.log("No lender-side rates found for this market.\n");
      return;
    }

    const formattedApy = parseFloat(market.rates[0].rate).toFixed(2); // Format to 2 decimal places

    console.log(`Best Moonwell USDC Pool: ${market.name}`);
    console.log(`APY: ${formattedApy}%`);
    console.log(`Pool Address: ${market.id}\n`);

    return { poolAddress: market.id, poolName: market.name, apy: formattedApy };
  } catch (error) {
    console.error("Error fetching Moonwell APY:\n", error, "\n");
  }
}

async function fetchAaveAPY(aavePoolAddress) {
  try {
    if (!aavePoolAddress) throw new Error("Aave pool address is missing.");

    console.log("Fetching Aave V3 APY...\n");
    const data = await request(AAVE_V3_SUBGRAPH_URL, aaveAPYQuery);
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

// Remove APYStorage contract. Add strategy contracts, BriqVault, and BriqShares contracts
/////////////////////////////////////////////////////////////////////////////
/////////// STORING APY DATA IN APYStorage.sol
/////////////////////////////////////////////////////////////////////////////

const APY_STORAGE_ADDRESS = "0xce52BC5c88c7bD76b17e05674e33380AA892D491"; // APYStorage.sol contract on Base Sepolia
const APY_STORAGE_ABI = [
  "function updateAPY(address _pool, uint256 _newAPY) external"
];

const apyStorage = new ethers.Contract(APY_STORAGE_ADDRESS, APY_STORAGE_ABI, signer);

async function storeAPYs(moonwellPoolAddress, aavePoolAddress, moonwellAPY, aaveAPY) {
  try {
    console.log(`/////////Updating APYs in contract/////////`);
    console.log(`\nAave Pool: ${aavePoolAddress} | APY: ${aaveAPY / 1e2}%`);
    console.log(`Moonwell Pool: ${moonwellPoolAddress} | APY: ${(moonwellAPY / 1e2).toFixed(2)}%\n`);

    await safeUpdateAPY(aavePoolAddress, aaveAPY, "Aave");
    await safeUpdateAPY(moonwellPoolAddress, moonwellAPY, "Moonwell");

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

// Restructure script flow to include new contracts
/////////////////////////////////////////////////////////////////////////////
/////////// RUNNING EVERYTHING IN SEQUENCE
/////////////////////////////////////////////////////////////////////////////

async function main() {
  console.log("\n\n\n/////////Fetching pool addresses/////////");

  // Fetch pool addresses
  const [moonwellPoolAddress, aavePoolAddress] = await Promise.all([
    getMoonwellPoolAddress(),
    getAavePoolAddress(),
  ]);

  if (!moonwellPoolAddress || !aavePoolAddress) {
    console.error("Failed to fetch one or both pool addresses. Exiting.");
    return;
  }

  console.log("\n/////////Fetching APY data/////////");

  // Fetch APY data
  const [moonwellAPYData, aaveAPYData] = await Promise.all([
    fetchMoonwellAPY(),
    fetchAaveAPY(aavePoolAddress),
  ]);

  if (!moonwellAPYData || !aaveAPYData) {
    console.error("Failed to fetch one or both APY values. Exiting.");
    return;
  }

  console.log("/////////All APY data fetched successfully/////////\n");

  await storeAPYs(
    moonwellPoolAddress,
    aavePoolAddress,
    parseFloat(moonwellAPYData.apy) * 1e2,
    parseFloat(aaveAPYData.apy) * 1e2
  );
}

main();
