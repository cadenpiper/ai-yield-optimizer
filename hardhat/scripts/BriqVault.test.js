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
}

async function logAaveState(title, strategy) {
  logTitle(`State: ${title}`);
  logLine("Supported Pool", await strategy.supportedPools(AAVE_POOL_ADDRESS));
  logLine("Supported Token", await strategy.supportedTokens(USDC_ADDRESS));
  logLine("Token → Pool", await strategy.tokenToPool(USDC_ADDRESS));
  logLine("Token → aToken", await strategy.tokenToAToken(USDC_ADDRESS));
}

async function logCoordinatorState(title, strategy) {
  logTitle(`State: ${title}`);
  logLine("Supported Token", await strategy.supportedTokens(USDC_ADDRESS));
  logLine("Token → Strategy", await strategy.tokenToStrategy(USDC_ADDRESS));
}

async function setupEnvironment() {
  const [deployer, user] = await ethers.getSigners();

  await hre.network.provider.request({
    method: "hardhat_impersonateAccount",
    params: [USDC_WHALE],
  });
  const whale = await ethers.getSigner(USDC_WHALE);

  // Fund whale with ETH for transactions
  await deployer.sendTransaction({
    to: whale.address,
    value: ethers.parseEther("1"),
  });

  const usdc = await ethers.getContractAt("IERC20", USDC_ADDRESS);

  // Deploy contracts
  const BriqShares = await ethers.getContractFactory("BriqShares");
  const briqShares = await BriqShares.deploy("Briq", "BRIQ");
  await briqShares.waitForDeployment();

  const StrategyCompound = await ethers.getContractFactory("StrategyCompoundComet");
  const strategyCompound = await StrategyCompound.deploy();
  await strategyCompound.waitForDeployment();

  const StrategyAave = await ethers.getContractFactory("StrategyAave");
  const strategyAave = await StrategyAave.deploy();
  await strategyAave.waitForDeployment();

  const StrategyCoordinator = await ethers.getContractFactory("StrategyCoordinator");
  const strategyCoordinator = await StrategyCoordinator.deploy(await strategyAave.getAddress(), await strategyCompound.getAddress());
  await strategyCoordinator.waitForDeployment();

  const BriqVault = await ethers.getContractFactory("BriqVault");
  const briqVault = await BriqVault.deploy(await strategyCoordinator.getAddress(), await briqShares.getAddress());
  await briqVault.waitForDeployment();

  console.log(`\nDeployed BriqShares at ${await briqShares.getAddress()}`);
  console.log(`Deployed StrategyCompoundComet at ${await strategyCompound.getAddress()}`);
  console.log(`Deployed StrategyAave at ${await strategyAave.getAddress()}`);
  console.log(`Deployed StrategyCoordinator at ${await strategyCoordinator.getAddress()}`)
  console.log(`Deployed BriqVault at ${await briqVault.getAddress()}`)

  // Set coordinator contract address in both strategies
  await strategyCompound.connect(deployer).setCoordinator(await strategyCoordinator.getAddress());
  await strategyAave.connect(deployer).setCoordinator(await strategyCoordinator.getAddress());

  // Update vault address for BriqShares and StrategyCoordinator
  await briqShares.connect(deployer).setVault(await briqVault.getAddress());
  await strategyCoordinator.connect(deployer).updateVaultAddress(await briqVault.getAddress());

  console.log("\nVault Address Updated (StrategyCoordinator)", `${await strategyCoordinator.vault()}`);

  return { deployer, user, whale, usdc, briqShares, strategyCompound, strategyAave, strategyCoordinator, briqVault };
}

async function configureStrategyForToken(deployer, strategyCompound, strategyAave, strategyCoordinator) {
  // Update support for pools and USDC token for both strategies
  await strategyCompound.connect(deployer).updateMarketSupport(COMET_USDC, USDC_ADDRESS, true);
  await strategyCompound.connect(deployer).updateTokenSupport(USDC_ADDRESS, true);

  await strategyAave.connect(deployer).updatePoolSupport(AAVE_POOL_ADDRESS, USDC_ADDRESS, true);
  await strategyAave.connect(deployer).updateTokenSupport(USDC_ADDRESS, true);

  await logCompoundState("Compound After Enabling", strategyCompound);
  await logAaveState("Aave After Enabling", strategyAave);

  // Update token strategies
  await strategyCoordinator.connect(deployer).setStrategyForToken(USDC_ADDRESS, 0);
  await logCoordinatorState("Coordinator After Enabling Strategy 0", strategyCoordinator);

  await strategyCoordinator.connect(deployer).setStrategyForToken(USDC_ADDRESS, 1);
  await logCoordinatorState("Coordinator After Enabling Strategy 1", strategyCoordinator);
}

async function deposit(deployer, user, whale, usdc, briqShares, strategyCoordinator, briqVault) {
  // Strategy 0 Deposit
  await strategyCoordinator.connect(deployer).setStrategyForToken(USDC_ADDRESS, 0);
  await logCoordinatorState("Deposit Srategy 0", strategyCoordinator);

  const depositAmount = ethers.parseUnits("100", 6);

  await usdc.connect(whale).transfer(user.address, depositAmount);
  await usdc.connect(user).approve(await briqVault.getAddress(), depositAmount);
  
  await briqVault.connect(user).deposit(USDC_ADDRESS, depositAmount);
  logLine("Deposit Amount", `${ethers.formatUnits(depositAmount, 6)} USDC`);
  logLine("Deposit Executed", "✅");

  // Calculate and display balances and shares
  const balance0 = await strategyCoordinator.getStrategyBalance(USDC_ADDRESS);
  const sharesBalance0 = await briqShares.balanceOf(user.address);
  const totalShares0 = await briqShares.totalSupply();

  logLine("AAVE Balance", `${ethers.formatUnits(balance0, 6)} USDC`);
  logLine("Depositor Shares", `${ethers.formatUnits(sharesBalance0, 18)} BRIQ`);
  logLine("Total Shares", `${ethers.formatUnits(totalShares0, 18)} BRIQ`);


  // Strategy 1 Deposit
  await strategyCoordinator.connect(deployer).setStrategyForToken(USDC_ADDRESS, 1);
  await logCoordinatorState("Deposit Srategy 1", strategyCoordinator);

  await usdc.connect(whale).transfer(user.address, depositAmount);
  await usdc.connect(user).approve(await briqVault.getAddress(), depositAmount);
  
  await briqVault.connect(user).deposit(USDC_ADDRESS, depositAmount);
  logLine("Deposit Amount", `${ethers.formatUnits(depositAmount, 6)} USDC`);
  logLine("Deposit Executed", "✅");

  const balance1 = await strategyCoordinator.getStrategyBalance(USDC_ADDRESS);
  const sharesBalance1 = await briqShares.balanceOf(user.address);
  const totalShares1 = await briqShares.totalSupply();

  logLine("Compound Balance", `${ethers.formatUnits(balance0, 6)} USDC`);
  logLine("Depositor Shares", `${ethers.formatUnits(sharesBalance1, 18)} BRIQ`);
  logLine("Total Shares", `${ethers.formatUnits(totalShares1, 18)} BRIQ`);
}

async function withdraw(deployer, user, usdc, briqShares, strategyAave, strategyCompound, strategyCoordinator, briqVault) {
  await strategyCoordinator.connect(deployer).setStrategyForToken(USDC_ADDRESS, 0);
  await logCoordinatorState("Withdraw", strategyCoordinator);

  const compoundBalanceBefore = await strategyCompound.balanceOf(USDC_ADDRESS);
  const aaveBalanceBefore = await strategyAave.balanceOf(USDC_ADDRESS);
  const userBalanceBefore = await usdc.balanceOf(user.address);
  const userSharesBefore = await briqShares.balanceOf(user.address);

  logLine("Compound USDC Balance Before", `${ethers.formatUnits(compoundBalanceBefore, 6)} USDC`);
  logLine("Aave USDC Balance Before", `${ethers.formatUnits(aaveBalanceBefore, 6)} USDC`);
  logLine("User Balance Before", `${ethers.formatUnits(userBalanceBefore, 6)} USDC`);
  logLine("User Shares Before", `${ethers.formatUnits(userSharesBefore, 18)} BRIQ`);

  // Withdraw
  const sharesToWithdraw = ethers.parseUnits("120", 18);
  logLine("Withdrawing...", `${ethers.formatUnits(sharesToWithdraw)} shares`);
  await briqVault.connect(user).withdraw(USDC_ADDRESS, sharesToWithdraw);
  logLine("Withdrawal Executed", "✅");

  const compoundBalanceAfter = await strategyCompound.balanceOf(USDC_ADDRESS);
  const aaveBalanceAfter = await strategyAave.balanceOf(USDC_ADDRESS);
  const userBalanceAfter = await usdc.balanceOf(user.address);
  const userSharesAfter = await briqShares.balanceOf(user.address);

  logLine("Compound USDC Balance After", `${ethers.formatUnits(compoundBalanceAfter, 6)} USDC`);
  logLine("Aave USDC Balance After", `${ethers.formatUnits(aaveBalanceAfter, 6)} USDC`);
  logLine("User Balance After", `${ethers.formatUnits(userBalanceAfter, 6)} USDC`);
  logLine("User Shares After", `${ethers.formatUnits(userSharesAfter, 18)} BRIQ\n`);
}

async function runTest() {
  console.log("\nStarting BriqVault Test on Mainnet Fork...");

  const { deployer, user, whale, usdc, briqShares, strategyCompound, strategyAave, strategyCoordinator, briqVault } = await setupEnvironment();
  await configureStrategyForToken(deployer, strategyCompound, strategyAave, strategyCoordinator);
  await deposit(deployer, user, whale, usdc, briqShares, strategyCoordinator, briqVault);
  await withdraw(deployer, user, usdc, briqShares, strategyAave, strategyCompound, strategyCoordinator, briqVault);
}

async function main() {
  await runTest();
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
