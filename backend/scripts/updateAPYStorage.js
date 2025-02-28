const { ethers } = require("ethers");
const { request, gql } = require("graphql-request");
require("dotenv").config();

const RPC_URL = "https://base-sepolia.g.alchemy.com/v2/" + process.env.ALCHEMY_API_KEY;
const provider = new ethers.JsonRpcProvider(RPC_URL);

const signer = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

const APY_STORAGE_ADDRESS = "0xce52BC5c88c7bD76b17e05674e33380AA892D491"; // APY Storage contract on Base Sepolia

const APY_STORAGE_ABI = [
  "function updateAPY(address _pool, uint256 _newAPY) external"
];

const apyStorage = new ethers.Contract(APY_STORAGE_ADDRESS, APY_STORAGE_ABI, signer);

const AAVE_SUBGRAPH_URL = "https://gateway.thegraph.com/api/" + process.env.GRAPHQL_API_KEY + "/subgraphs/id/GQFbb95cE6d8mV989mL5figjaGaKCQB3xqYrr1bRyXqF";
const MORPHO_SUBGRAPH_URL = "https://gateway.thegraph.com/api/" + process.env.GRAPHQL_API_KEY + "/subgraphs/id/71ZTy1veF9twER9CLMnPWeLQ7GZcwKsjmygejrgKirqs";

const aaveQuery = gql`
{
  reserves(where: { underlyingAsset: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" }, first: 1) {
    liquidityRate
  }
}`;

const morphoQuery = gql`
{
  interestRates(where: { market_: { inputToken: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" }, side: LENDER }, orderBy: rate, orderDirection: desc, first: 1) {
    rate
  }
}`;

async function fetchAndStoreAPYs() {
  try {
    const aaveData = await request(AAVE_SUBGRAPH_URL, aaveQuery);
    const aaveAPY = aaveData.reserves[0]?.liquidityRate;
    if (!aaveAPY) throw new Error("Failed to fetch Aave APY");

    const morphoData = await request(MORPHO_SUBGRAPH_URL, morphoQuery);
    const morphoAPY = morphoData.interestRates[0]?.rate;
    if (!morphoAPY) throw new Error("Failed to fetch Morpho APY");

    // ✅ Correct Scaling
    const formattedAaveAPY = Math.floor(Number(aaveAPY) / 1e21);
    const formattedMorphoAPY = Math.floor(Number(morphoAPY) * 1e4);

    // ✅ Convert to human-readable percentage format
    const displayAaveAPY = (formattedAaveAPY / 1e4).toFixed(2);  // 4.24%
    const displayMorphoAPY = (formattedMorphoAPY / 1e4).toFixed(2); // 7.99%

    const aavePoolAddress = "0xA238Dd80C259a72e81d7e4664a9801593F98d1c5";  // Aave pool contract on Base
    const morphoPoolAddress = "0x46415998764c29ab2a25cbea6254146d50d22687";  // Morpho pool contract on Base

    console.log(`Updating APYs in contract...`);
    console.log(`Aave Pool: ${aavePoolAddress} | APY: ${displayAaveAPY}%`);
    console.log(`Morpho Pool: ${morphoPoolAddress} | APY: ${displayMorphoAPY}%`);

    await safeUpdateAPY(aavePoolAddress, formattedAaveAPY, "Aave");
    await safeUpdateAPY(morphoPoolAddress, formattedMorphoAPY, "Morpho");

  } catch (error) {
    console.error("❌ Error fetching APYs:", error);
  }
}

async function safeUpdateAPY(poolAddress, formattedAPY, name) {
  try {
    const tx = await apyStorage.updateAPY(poolAddress, formattedAPY);
    await tx.wait();
    console.log(`✅ Successfully updated ${name} APY: ${formattedAPY / 1e4}%`);
  } catch (error) {
    if (error.reason && error.reason.includes("APY Has not changed")) {
      console.log(`⚠️ ${name} APY is unchanged, skipping update.`);
    } else {
      console.error(`❌ Error updating ${name} APY:`, error);
    }
  }
}

fetchAndStoreAPYs();
