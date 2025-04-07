const { ethers } = require("hardhat");
const hre = require("hardhat");

// Mainnet Addresses
const USDC_ADDRESS      = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"; // Mainnet USDC
const AAVE_POOL_ADDRESS = "0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2"; // Aave V3 Pool
const USDC_WHALE        = "0xaD354CfBAa4A8572DD6Df021514a3931A8329Ef5"; // USDC whale

// Utility function to log state
async function logState(title, strategyAave) {
  console.log(`\n=== 📊 ${title} ===`);
  console.log(`  ➤ Supported Pool:      ${await strategyAave.supportedPools(AAVE_POOL_ADDRESS)}`);
  console.log(`  ➤ Supported Token:     ${await strategyAave.supportedTokens(USDC_ADDRESS)}`);
  console.log(`  ➤ Token to Pool:       ${await strategyAave.tokenToPool(USDC_ADDRESS)}`);
  console.log(`  ➤ Token to aToken:     ${await strategyAave.tokenToAToken(USDC_ADDRESS)}\n`);
}

// Setup environment
async function setupEnvironment() {
  const [deployer] = await ethers.getSigners();

  await hre.network.provider.request({
    method: "hardhat_impersonateAccount",
    params: [USDC_WHALE],
  });

  const impersonatedSigner = await ethers.getSigner(USDC_WHALE);

  await deployer.sendTransaction({
    to: impersonatedSigner.address,
    value: ethers.parseEther("1"),
  });

  const usdc = await ethers.getContractAt("IERC20", USDC_ADDRESS);
  const StrategyAave = await ethers.getContractFactory("StrategyAave");
  const strategyAave = await StrategyAave.deploy(deployer.address);
  await strategyAave.waitForDeployment();

  console.log(`\n🚀 Deployed StrategyAave at: ${await strategyAave.getAddress()}\n`);

  return { deployer, impersonatedSigner, usdc, strategyAave };
}

async function testConfigurationFlow(deployer, strategyAave) {
  console.log("\n🔧 Running Configuration Flow...");

  await strategyAave.connect(deployer).updatePoolSupport(AAVE_POOL_ADDRESS, USDC_ADDRESS, true);
  console.log("✅ Enabled Aave pool support for USDC");

  await strategyAave.connect(deployer).updateTokenSupport(USDC_ADDRESS, true);
  console.log("✅ Enabled USDC token support");

  await logState("State After Enabling", strategyAave);

  await strategyAave.connect(deployer).updateTokenSupport(USDC_ADDRESS, false);
  console.log("🚫 Disabled USDC token support");

  await strategyAave.connect(deployer).updatePoolSupport(AAVE_POOL_ADDRESS, USDC_ADDRESS, false);
  console.log("🚫 Disabled Aave pool support for USDC");

  await logState("State After Disabling", strategyAave);
}

async function testDepositFlow(deployer, impersonatedSigner, usdc, strategyAave) {
  console.log("\n💰 Starting Deposit Flow...");

  await strategyAave.connect(deployer).updatePoolSupport(AAVE_POOL_ADDRESS, USDC_ADDRESS, true);
  await strategyAave.connect(deployer).updateTokenSupport(USDC_ADDRESS, true);
  await logState("Before Deposit", strategyAave);

  const depositAmount = ethers.parseUnits("100", 6);
  console.log(`💵 Preparing to deposit: ${ethers.formatUnits(depositAmount, 6)} USDC`);

  await usdc.connect(impersonatedSigner).approve(await strategyAave.getAddress(), depositAmount);
  console.log("✅ Whale approved StrategyAave to spend USDC");

  await usdc.connect(impersonatedSigner).transfer(deployer.address, depositAmount);
  console.log("🔁 Transferred USDC from whale to vault (deployer)");

  await usdc.connect(deployer).approve(await strategyAave.getAddress(), depositAmount);
  console.log("✅ Vault approved StrategyAave to spend USDC");

  const tx = await strategyAave.connect(deployer).deposit(USDC_ADDRESS, depositAmount);
  await tx.wait();
  console.log("📥 Deposit transaction executed successfully!");

  const aTokenAddress = await strategyAave.tokenToAToken(USDC_ADDRESS);
  const aToken = await ethers.getContractAt("IERC20", aTokenAddress);
  const aTokenBalance = await aToken.balanceOf(await strategyAave.getAddress());

  console.log(`🏦 aToken balance of Strategy: ${ethers.formatUnits(aTokenBalance, 6)} aUSDC\n`);
  console.log("🎯 Deposit flow completed.\n");
}

async function testWithdrawFlow(deployer, usdc, strategyAave) {
  console.log("\n💸 Starting Withdraw Flow...");

  const withdrawAmount = ethers.parseUnits("100", 6);
  const strategyAddress = await strategyAave.getAddress();

  const usdcBefore = await usdc.balanceOf(deployer.address);
  const aTokenAddress = await strategyAave.tokenToAToken(USDC_ADDRESS);
  const aToken = await ethers.getContractAt("IERC20", aTokenAddress);
  const aTokenBefore = await aToken.balanceOf(strategyAddress);

  console.log(`📦 USDC balance before withdraw: ${ethers.formatUnits(usdcBefore, 6)} USDC`);
  console.log(`🪙 aToken balance before withdraw (Strategy): ${ethers.formatUnits(aTokenBefore, 6)} aUSDC`);

  const tx = await strategyAave.connect(deployer).withdraw(USDC_ADDRESS, withdrawAmount);
  await tx.wait();
  console.log("✅ Withdrawal transaction executed");

  const usdcAfter = await usdc.balanceOf(deployer.address);
  const aTokenAfter = await aToken.balanceOf(strategyAddress);

  console.log(`📦 USDC balance after withdraw: ${ethers.formatUnits(usdcAfter, 6)} USDC`);
  console.log(`🪙 aToken balance after withdraw (Strategy): ${ethers.formatUnits(aTokenAfter, 6)} aUSDC\n`);
  console.log("🎯 Withdraw flow completed.\n");
}

async function runAaveStrategyTest() {
  console.log("🔁 Starting StrategyAave Test on Ethereum Mainnet Fork...\n");

  const { deployer, impersonatedSigner, usdc, strategyAave } = await setupEnvironment();

  const userBalance = await usdc.balanceOf(impersonatedSigner.address);
  console.log("=== 🧾 Initial Setup ===");
  console.log(`💰 USDC balance of whale: ${ethers.formatUnits(userBalance, 6)} USDC\n`);

  await testConfigurationFlow(deployer, strategyAave);
  await testDepositFlow(deployer, impersonatedSigner, usdc, strategyAave);
  await testWithdrawFlow(deployer, usdc, strategyAave);
}

async function main() {
  await runAaveStrategyTest();
}

main().catch((err) => {
  console.error("❌ Error:", err);
  process.exit(1);
});
