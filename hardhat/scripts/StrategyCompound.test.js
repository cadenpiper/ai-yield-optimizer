const { ethers } = require("hardhat");
const { expect } = require("chai");

// === CONFIGURATION ===
const USDC_ADDRESS   = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
const COMET_USDC     = "0xc3d688B66703497DAA19211EEdff47f25384cdc3";
const USDC_WHALE     = "0xaD354CfBAa4A8572DD6Df021514a3931A8329Ef5";

// === UTILITIES ===
const logTitle = (title) => console.log(`\n🔹 ${title.toUpperCase()} 🔹`);
const logLine = (label, value) => console.log(`   ${label.padEnd(30)} ${value}`);

async function logState(title, strategy) {
  logTitle(`State: ${title}`);
  logLine("Supported Market", await strategy.supportedMarkets(COMET_USDC));
  logLine("Supported Token", await strategy.supportedTokens(USDC_ADDRESS));
  logLine("Token → Comet", await strategy.tokenToComet(USDC_ADDRESS));
  console.log();
}

// === SETUP ===
async function setupEnvironment() {
  const [deployer] = await ethers.getSigners();

  await hre.network.provider.request({
    method: "hardhat_impersonateAccount",
    params: [USDC_WHALE],
  });

  const whale = await ethers.getSigner(USDC_WHALE);

  await deployer.sendTransaction({
    to: whale.address,
    value: ethers.parseEther("1"),
  });

  const usdc = await ethers.getContractAt("IERC20", USDC_ADDRESS);
  const Strategy = await ethers.getContractFactory("StrategyCompoundComet");
  const strategy = await Strategy.deploy(deployer.address);
  await strategy.waitForDeployment();

  console.log(`🚀 Deployed StrategyCompoundComet at ${await strategy.getAddress()}\n`);
  return { deployer, whale, usdc, strategy };
}

// === TEST FLOWS ===
async function configureStrategy(deployer, strategy) {
  logTitle("Configuration");

  await strategy.connect(deployer).updateMarketSupport(COMET_USDC, USDC_ADDRESS, true);
  logLine("Enabled Market", "✅");

  await strategy.connect(deployer).updateTokenSupport(USDC_ADDRESS, true);
  logLine("Enabled Token", "✅");

  await logState("After Enabling", strategy);

  await strategy.connect(deployer).updateTokenSupport(USDC_ADDRESS, false);
  logLine("Disabled Token", "🛑");

  await strategy.connect(deployer).updateMarketSupport(COMET_USDC, USDC_ADDRESS, false);
  logLine("Disabled Market", "🛑");

  await logState("After Disabling", strategy);
}

async function testDeposit(deployer, whale, usdc, strategy) {
  logTitle("Deposit Flow");

  await strategy.connect(deployer).updateMarketSupport(COMET_USDC, USDC_ADDRESS, true);
  await strategy.connect(deployer).updateTokenSupport(USDC_ADDRESS, true);
  await logState("Before Deposit", strategy);

  const depositAmount = ethers.parseUnits("100", 6);
  logLine("Depositing", `${ethers.formatUnits(depositAmount, 6)} USDC`);

  await usdc.connect(whale).approve(await strategy.getAddress(), depositAmount);
  await usdc.connect(whale).transfer(deployer.address, depositAmount);
  await usdc.connect(deployer).approve(await strategy.getAddress(), depositAmount);

  await strategy.connect(deployer).deposit(USDC_ADDRESS, depositAmount);
  logLine("Deposit Executed", "📥");

  const balance = await strategy.balanceOf(USDC_ADDRESS);
  logLine("balanceOf() Return", `${ethers.formatUnits(balance, 6)} USDC`);
  console.log();
}

async function testPartialWithdraw(deployer, usdc, strategy) {
  logTitle("Partial Withdraw");

  const half = ethers.parseUnits("50", 6);

  const usdcBefore = await usdc.balanceOf(deployer.address);
  const balanceBefore = await strategy.balanceOf(USDC_ADDRESS);

  logLine("USDC Before (Vault)", `${ethers.formatUnits(usdcBefore, 6)} USDC`);
  logLine("balanceOf() Before", `${ethers.formatUnits(balanceBefore, 6)} USDC`);

  await strategy.connect(deployer).withdraw(USDC_ADDRESS, half);

  const usdcAfter = await usdc.balanceOf(deployer.address);
  const balanceAfter = await strategy.balanceOf(USDC_ADDRESS);

  logLine("USDC After (Vault)", `${ethers.formatUnits(usdcAfter, 6)} USDC`);
  logLine("balanceOf() After", `${ethers.formatUnits(balanceAfter, 6)} USDC`);
  console.log();
}

async function testWithdraw(deployer, usdc, strategy) {
  logTitle("Withdraw Flow");

  const remaining = await strategy.balanceOf(USDC_ADDRESS);

  const usdcBefore = await usdc.balanceOf(deployer.address);
  const balanceBefore = await strategy.balanceOf(USDC_ADDRESS);

  logLine("USDC Before (Vault)", `${ethers.formatUnits(usdcBefore, 6)} USDC`);
  logLine("balanceOf() Before", `${ethers.formatUnits(balanceBefore, 6)} USDC`);

  await strategy.connect(deployer).withdraw(USDC_ADDRESS, remaining);

  const usdcAfter = await usdc.balanceOf(deployer.address);
  const balanceAfter = await strategy.balanceOf(USDC_ADDRESS);

  logLine("USDC After (Vault)", `${ethers.formatUnits(usdcAfter, 6)} USDC`);
  logLine("balanceOf() After", `${ethers.formatUnits(balanceAfter, 6)} USDC`);
  console.log();
}

// === MAIN RUNNER ===
async function runTest() {
  console.log("🧪 Starting StrategyCompoundComet Test on Mainnet Fork...\n");

  const { deployer, whale, usdc, strategy } = await setupEnvironment();

  const whaleBalance = await usdc.balanceOf(whale.address);
  logLine("USDC Balance of Whale", `${ethers.formatUnits(whaleBalance, 6)} USDC`);
  console.log();

  await configureStrategy(deployer, strategy);
  await testDeposit(deployer, whale, usdc, strategy);
  await testPartialWithdraw(deployer, usdc, strategy);
  await testWithdraw(deployer, usdc, strategy);
}

async function main() {
  await runTest();
}

main().catch((err) => {
  console.error("❌ Error:", err);
  process.exit(1);
});
