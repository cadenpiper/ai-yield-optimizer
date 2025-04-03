const { ethers } = require("hardhat");
const hre = require("hardhat");

// Mainnet Addresses
const USDC_ADDRESS = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"; // Mainnet USDC
const AAVE_POOL_ADDRESS = "0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2"; // Aave V3 Pool
const USDC_WHALE = "0xaD354CfBAa4A8572DD6Df021514a3931A8329Ef5"; // USDC whale

// Utility function to log state
async function logState(title, strategyAave) {
  console.log(`=== ${title} ===`);
  console.log(`  Supported Pools[${AAVE_POOL_ADDRESS}]: ${await strategyAave.supportedPools(AAVE_POOL_ADDRESS)}`);
  console.log(`  Supported Tokens[${USDC_ADDRESS}]: ${await strategyAave.supportedTokens(USDC_ADDRESS)}`);
  console.log(`  Token to Pool[${USDC_ADDRESS}]: ${await strategyAave.tokenToPool(USDC_ADDRESS)}`);
  console.log(`  Token to aToken[${USDC_ADDRESS}]: ${await strategyAave.tokenToAToken(USDC_ADDRESS)}\n`);
}

// Setup environment with deployer, whale, and contract
async function setupEnvironment() {
  const [deployer] = await ethers.getSigners();

  // Impersonate USDC whale
  await hre.network.provider.request({
    method: "hardhat_impersonateAccount",
    params: [USDC_WHALE],
  });
  const impersonatedSigner = await ethers.getSigner(USDC_WHALE);

  // Fund whale with ETH for gas
  await deployer.sendTransaction({
    to: impersonatedSigner.address,
    value: ethers.parseEther("1"),
  });

  // Connect to USDC contract
  const usdc = await ethers.getContractAt("IERC20", USDC_ADDRESS);

  // Deploy StrategyAave
  const StrategyAave = await ethers.getContractFactory("StrategyAave");
  const strategyAave = await StrategyAave.deploy(deployer.address); // Deployer as vault
  await strategyAave.waitForDeployment();

  console.log(`📦 Deployed StrategyAave at: ${await strategyAave.getAddress()}\n`);
  return { deployer, impersonatedSigner, usdc, strategyAave };
}

// Test flow: Configure pool and token support
async function testConfigurationFlow(deployer, strategyAave) {
  // Enable pool support
  await strategyAave.connect(deployer).updatePoolSupport(AAVE_POOL_ADDRESS, USDC_ADDRESS, true);
  console.log("🔧 Enabled Aave pool support for USDC");

  // Enable token support
  await strategyAave.connect(deployer).updateTokenSupport(USDC_ADDRESS, true);
  console.log("🔧 Enabled USDC token support");

  await logState("State After Configuration", strategyAave);

  // Disable token support
  await strategyAave.connect(deployer).updateTokenSupport(USDC_ADDRESS, false);
  console.log("🔧 Disabled USDC token support");

  // Disable pool support
  await strategyAave.connect(deployer).updatePoolSupport(AAVE_POOL_ADDRESS, USDC_ADDRESS, false);
  console.log("🔧 Disabled Aave pool support for USDC");

  await logState("Final State", strategyAave);
}

// Main test runner
async function runAaveStrategyTest() {
  console.log("🔁 Starting StrategyAave Test on Ethereum Mainnet Fork...\n");

  const { deployer, impersonatedSigner, usdc, strategyAave } = await setupEnvironment();

  // Log initial balance
  const userBalance = await usdc.balanceOf(impersonatedSigner.address);
  console.log("=== Initial Setup ===");
  console.log(`💰 USDC balance of whale: ${ethers.formatUnits(userBalance, 6)} USDC\n`);

  // Run configuration flow
  await testConfigurationFlow(deployer, strategyAave);
}

async function main() {
  await runAaveStrategyTest();
}

main().catch((err) => {
  console.error("❌ Error:", err);
  process.exit(1);
});