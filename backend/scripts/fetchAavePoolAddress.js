const { ethers } = require("ethers");
require("dotenv").config();

const provider = new ethers.JsonRpcProvider("https://base-mainnet.g.alchemy.com/v2/" + process.env.ALCHEMY_API_KEY);

const POOL_ADDRESSES_PROVIDER = "0xe20fCBdBfFC4Dd138cE8b2E6FBb6CB49777ad64D"; // Aave PoolAddressesProvider on Base

const ABI = [
  "function getPool() external view returns (address)"
];

async function fetchAavePoolAddress() {
  try {
    const providerContract = new ethers.Contract(POOL_ADDRESSES_PROVIDER, ABI, provider);
    const poolAddress = await providerContract.getPool();
    console.log("✅ Aave V3 Pool Address:", poolAddress);
  } catch (error) {
    console.error("❌ Error fetching Aave Pool Address:", error);
  }
}

fetchAavePoolAddress();
