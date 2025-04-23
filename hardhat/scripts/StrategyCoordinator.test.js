const { ethers, userConfig } = require("hardhat");
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
  const strategyCompound = await StrategyCompound.deploy();
  await strategyCompound.waitForDeployment();

  console.log(`\nDeployed StrategyCompoundComet at ${await strategyCompound.getAddress()}`);

  const StrategyAave = await ethers.getContractFactory("StrategyAave");
  const strategyAave = await StrategyAave.deploy();
  await strategyAave.waitForDeployment();

  console.log(`Deployed StrategyAave at ${await strategyAave.getAddress()}`);

  const StrategyCoordinator = await ethers.getContractFactory("StrategyCoordinator");
  const strategyCoordinator = await StrategyCoordinator.deploy(vault.address, await strategyAave.getAddress(), await strategyCompound.getAddress());
  await strategyCoordinator.waitForDeployment();

  console.log(`Deployed StrategyCoordinator at ${await strategyCoordinator.getAddress()}\n`)

  // Set Coordinator contract address
  await strategyCompound.connect(vault).setCoordinator(await strategyCoordinator.getAddress());
  await strategyAave.connect(vault).setCoordinator(await strategyCoordinator.getAddress());

  return { vault, whale, usdc, strategyCompound, strategyAave, strategyCoordinator };
}

async function configureStrategyForToken(vault, strategyCompound, strategyAave, strategyCoordinator) {
  // Update support for pools and USDC token for both strategies
  await strategyCompound.connect(vault).updateMarketSupport(COMET_USDC, USDC_ADDRESS, true);
  await strategyCompound.connect(vault).updateTokenSupport(USDC_ADDRESS, true);
  await logCompoundState("Compound After Enabling", strategyCompound);

  await strategyAave.connect(vault).updatePoolSupport(AAVE_POOL_ADDRESS, USDC_ADDRESS, true);
  await strategyAave.connect(vault).updateTokenSupport(USDC_ADDRESS, true);
  await logAaveState("Aave After Enabling", strategyAave);

  // Test updating token strategies
  await strategyCoordinator.connect(vault).setStrategyForToken(USDC_ADDRESS, 1);
  await logCoordinatorState("Coordinator After Enabling Strategy 1", strategyCoordinator);

  await strategyCoordinator.connect(vault).setStrategyForToken(USDC_ADDRESS, 0);
  await logCoordinatorState("Coordinator After Enabling Strategy 0", strategyCoordinator);
}

async function deposit(vault, whale, usdc, strategyCoordinator) {
  // Strategy 0 Deposit (AAVE V3)
  await strategyCoordinator.connect(vault).setStrategyForToken(USDC_ADDRESS, 0);
  await logCoordinatorState("Deposit Srategy 0", strategyCoordinator);

  const depositAmount = ethers.parseUnits("100", 6);
  logLine("Depositing to AAVE V3", `${ethers.formatUnits(depositAmount, 6)} USDC`);

  await usdc.connect(whale).transfer(vault.address, depositAmount);
  await usdc.connect(vault).approve(await strategyCoordinator.getAddress(), depositAmount);

  await strategyCoordinator.connect(vault).deposit(USDC_ADDRESS, depositAmount);
  logLine("Deposit Executed", "✅");

  const balance0 = await strategyCoordinator.balanceOf(USDC_ADDRESS);
  logLine("AAVE Balance", `${ethers.formatUnits(balance0, 6)} USDC`);

  // Strategy 1 Deposit (Compound V3)
  await strategyCoordinator.connect(vault).setStrategyForToken(USDC_ADDRESS, 1);
  await logCoordinatorState("Deposit Srategy 1", strategyCoordinator);

  logLine("Depositing to Compound V3", `${ethers.formatUnits(depositAmount, 6)} USDC`);

  await usdc.connect(whale).transfer(vault.address, depositAmount);
  await usdc.connect(vault).approve(await strategyCoordinator.getAddress(), depositAmount);

  await strategyCoordinator.connect(vault).deposit(USDC_ADDRESS, depositAmount);
  logLine("Deposit Executed", "✅");

  const balance1 = await strategyCoordinator.balanceOf(USDC_ADDRESS);
  logLine("Compound Balance", `${ethers.formatUnits(balance1, 6)} USDC`);
}

async function withdraw(vault, usdc, strategyCoordinator) {
  // Strategy 0 Withdrawal
  await strategyCoordinator.connect(vault).setStrategyForToken(USDC_ADDRESS, 0);
  await logCoordinatorState("Withdraw Strategy 0", strategyCoordinator);

  const existingBalance0 = await strategyCoordinator.balanceOf(USDC_ADDRESS);
  logLine("Existing Balance", `${ethers.formatUnits(existingBalance0, 6)} USDC`);

  await strategyCoordinator.connect(vault).withdraw(USDC_ADDRESS, existingBalance0);

  const balance0 = await strategyCoordinator.balanceOf(USDC_ADDRESS);
  logLine("balanceOf() return", `${ethers.formatUnits(balance0, 6)} USDC`);

  const vaultBalance0 = await usdc.balanceOf(vault.address);
  logLine("Vault Balance After Withdraw", `${ethers.formatUnits(vaultBalance0, 6)} USDC`);

  // Strategy 1 Withdrawal
  await strategyCoordinator.connect(vault).setStrategyForToken(USDC_ADDRESS, 1);
  await logCoordinatorState("Withdraw Strategy 1", strategyCoordinator);

  const existingBalance1 = await strategyCoordinator.balanceOf(USDC_ADDRESS);
  logLine("Existing Balance", `${ethers.formatUnits(existingBalance1, 6)} USDC`);

  await strategyCoordinator.connect(vault).withdraw(USDC_ADDRESS, existingBalance1);

  const balance1 = await strategyCoordinator.balanceOf(USDC_ADDRESS);
  logLine("balanceOf() return", `${ethers.formatUnits(balance1, 6)} USDC`);

  const vaultBalance1 = await usdc.balanceOf(vault.address);
  logLine("Vault Balance After Withdraw", `${ethers.formatUnits(vaultBalance1, 6)} USDC`);
}

async function emergencyWithdraw(vault, usdc, strategyCoordinator) {
  // Strategy 0
  await logCoordinatorState("Emergency Withdraw Strategy 0", strategyCoordinator);

  const depositAmount = ethers.parseUnits("100", 6);
  await usdc.connect(vault).approve(await strategyCoordinator.getAddress(), depositAmount);

  await strategyCoordinator.connect(vault).deposit(USDC_ADDRESS, depositAmount);

  const balance0 = await strategyCoordinator.balanceOf(USDC_ADDRESS);
  logLine("Existing Strategy 0 Balance:", `${ethers.formatUnits(balance0, 6)} USDC`);

  const vaultBalance0Before = await usdc.balanceOf(vault.address);
  logLine("Vault Balance Before Withdrawal", `${ethers.formatUnits(vaultBalance0Before, 6)} USDC`);

  await strategyCoordinator.connect(vault).emergencyWithdraw(USDC_ADDRESS);
  const balance0After = await strategyCoordinator.balanceOf(USDC_ADDRESS);

  logLine("Remaining Strategy 0 Balance:", `${ethers.formatUnits(balance0After, 6)} USDC`);

  const vaultBalance0After = await usdc.balanceOf(vault.address);
  logLine("Vault Balance After Withdrawal", `${ethers.formatUnits(vaultBalance0After, 6)} USDC`);

  // Strategy 1
  await strategyCoordinator.connect(vault).setStrategyForToken(USDC_ADDRESS, 1);
  await logCoordinatorState("Emergency Withdraw Strategy 1", strategyCoordinator);

  await usdc.connect(vault).approve(await strategyCoordinator.getAddress(), depositAmount);

  await strategyCoordinator.connect(vault).deposit(USDC_ADDRESS, depositAmount);

  const balance1 = await strategyCoordinator.balanceOf(USDC_ADDRESS);
  logLine("Existing Strategy 1 Balance:", `${ethers.formatUnits(balance1, 6)} USDC`);

  const vaultBalance1Before = await usdc.balanceOf(vault.address);
  logLine("Vault Balance Before Withdrawal", `${ethers.formatUnits(vaultBalance1Before, 6)} USDC`);

  await strategyCoordinator.connect(vault).emergencyWithdraw(USDC_ADDRESS);
  const balance1After = await strategyCoordinator.balanceOf(USDC_ADDRESS);

  logLine("Remaining Strategy 1 Balance:", `${ethers.formatUnits(balance1After, 6)} USDC`);

  const vaultBalance1After = await usdc.balanceOf(vault.address);
  logLine("Vault Balance After Withdrawal", `${ethers.formatUnits(vaultBalance1After, 6)} USDC`);
}

async function runTest() {
  console.log("\nStarting StrategyCoordinator Test on Mainnet Fork...");

  const { vault, whale, usdc, strategyCompound, strategyAave, strategyCoordinator } = await setupEnvironment();

  await configureStrategyForToken(vault, strategyCompound, strategyAave, strategyCoordinator);
  await deposit(vault, whale, usdc, strategyCoordinator);
  await withdraw(vault, usdc, strategyCoordinator);
  await emergencyWithdraw(vault, usdc, strategyCoordinator);
}

async function main() {
  await runTest();
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
