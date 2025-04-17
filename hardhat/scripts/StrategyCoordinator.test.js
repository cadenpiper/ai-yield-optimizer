const { ethers } = require("hardhat");
const { expect } = require("chai");

const USDC_ADDRESS = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
const USDC_WHALE = "0xaD354CfBAa4A8572DD6Df021514a3931A8329Ef5";
const COMET_USDC     = "0xc3d688B66703497DAA19211EEdff47f25384cdc3";
const AAVE_POOL_ADDRESS = "0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2";

// === UTILITIES ===
const logTitle = (title) => console.log(`\n🔹 ${title.toUpperCase()} 🔹`);
const logLine = (label, value) => console.log(`   ${label.padEnd(30)} ${value}`);

async function logCompoundState(title, strategy) {
  logTitle(`State: ${title}`);
  logLine("Supported Market", await strategy.supportedMarkets(COMET_USDC));
  logLine("Supported Token", await strategy.supportedTokens(USDC_ADDRESS));
  logLine("Token → Comet", await strategy.tokenToComet(USDC_ADDRESS));
  console.log();
}

async function logAaveState(title, strategy) {
  logTitle(`State: ${title}`);
  logLine("Supported Pool", await strategy.supportedPools(AAVE_POOL_ADDRESS));
  logLine("Supported Token", await strategy.supportedTokens(USDC_ADDRESS));
  logLine("Token → Pool", await strategy.tokenToPool(USDC_ADDRESS));
  logLine("Token → aToken", await strategy.tokenToAToken(USDC_ADDRESS));
  console.log();
}

async function logCoordinatorState(title, strategy) {
  logTitle(`State: ${title}`);
  logLine("Supported Token", await strategy.supportedTokens(USDC_ADDRESS));
  logLine("Token → Strategy", await strategy.tokenToStrategy(USDC_ADDRESS));
}

async function setupEnvironment() {
  const [vault] = await ethers.getSigners();

  await hre.network.provider.request({
    method: "hardhat_impersonateAccount",
    params: [USDC_WHALE],
  });
  const whale = await ethers.getSigner(USDC_WHALE);

  // Fund whale with ETH for transactions
  await vault.sendTransaction({
    to: whale.address,
    value: ethers.parseEther("1"),
  });

  const usdc = await ethers.getContractAt("IERC20", USDC_ADDRESS);
  const StrategyCompound = await ethers.getContractFactory("StrategyCompoundComet");
  const strategyCompound = await StrategyCompound.deploy(vault.address);
  await strategyCompound.waitForDeployment();

  console.log(`\nDeployed StrategyCompoundComet at ${await strategyCompound.getAddress()}`);

  const StrategyAave = await ethers.getContractFactory("StrategyAave");
  const strategyAave = await StrategyAave.deploy(vault.address);
  await strategyAave.waitForDeployment();

  console.log(`Deployed StrategyAave at ${await strategyAave.getAddress()}`);

  const StrategyCoordinator = await ethers.getContractFactory("StrategyCoordinator");
  const strategyCoordinator = await StrategyCoordinator.deploy(vault.address, await strategyAave.getAddress(), await strategyCompound.getAddress());
  await strategyCoordinator.waitForDeployment();

  console.log(`Deployed StrategyCoordinator at ${await strategyCoordinator.getAddress()}\n`)

  return { vault, whale, usdc, strategyCompound, strategyAave, strategyCoordinator };
}

async function configureStrategyForToken(vault, strategyCompound, strategyAave, strategyCoordinator) {
  await strategyCompound.connect(vault).updateMarketSupport(COMET_USDC, USDC_ADDRESS, true);
  await strategyCompound.connect(vault).updateTokenSupport(USDC_ADDRESS, true);
  await logCompoundState("Compound After Enabling", strategyCompound);

  await strategyAave.connect(vault).updatePoolSupport(AAVE_POOL_ADDRESS, USDC_ADDRESS, true);
  await strategyAave.connect(vault).updateTokenSupport(USDC_ADDRESS, true);
  await logAaveState("Aave After Enabling", strategyAave);

  await strategyCoordinator.connect(vault).setStrategyForToken(USDC_ADDRESS, 1);
  await logCoordinatorState("Coordinator After Enabling Strategy 1", strategyCoordinator);

  await strategyCoordinator.connect(vault).setStrategyForToken(USDC_ADDRESS, 0);
  await logCoordinatorState("Coordinator After Enabling Strategy 0", strategyCoordinator);
}

async function runTest() {
  console.log("\nStarting StrategyCoordinator Test on Mainnet Fork...\n");

  const { vault, whale, usdc, strategyCompound, strategyAave, strategyCoordinator } = await setupEnvironment();

  await configureStrategyForToken(vault, strategyCompound, strategyAave, strategyCoordinator);
}

async function main() {
  await runTest();
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});