const { ethers } = require("hardhat");

const USDC_ADDRESS = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
const COMET_MARKET_ADDRESS = "0xc3d688B66703497DAA19211EEdff47f25384cdc3";
const AAVE_POOL_ADDRESS = "0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2";
const USDC_WHALE = "0xaD354CfBAa4A8572DD6Df021514a3931A8329Ef5";
const DEPOSIT_AMOUNT = ethers.parseUnits("1000", 6);

async function setupEnvironment() {
  const [deployer] = await ethers.getSigners();
  const impersonatedSigner = await ethers.getImpersonatedSigner(USDC_WHALE);
  await deployer.sendTransaction({
    to: impersonatedSigner.address,
    value: ethers.parseEther("1"),
  });

  const usdc = await ethers.getContractAt("IERC20", USDC_ADDRESS);

  const LiquidityManager = await ethers.getContractFactory("LiquidityManager");
  const liquidityManager = await LiquidityManager.deploy();
  await liquidityManager.waitForDeployment();

  console.log(`📦 Deployed LiquidityManager at: ${await liquidityManager.getAddress()}`);
  return { impersonatedSigner, usdc, liquidityManager };
}

async function runTest(protocol) {
  const { impersonatedSigner, usdc, liquidityManager } = await setupEnvironment();

  const userBalance = await usdc.balanceOf(impersonatedSigner.address);
  console.log(`💰 USDC balance of signer: ${ethers.formatUnits(userBalance, 6)} USDC`);

  // Configure supported token and pool
  await liquidityManager.updateSupportedTokens(USDC_ADDRESS, true);

  if (protocol === "compound") {
    await liquidityManager.updateSupportedCometMarkets(COMET_MARKET_ADDRESS, true);
    console.log("🔧 Enabled USDC + Compound market");
  } else {
    await liquidityManager.updateSupportedAavePools(AAVE_POOL_ADDRESS, true);
    console.log("🔧 Enabled USDC + Aave pool");
  }

  // Approve and deposit USDC
  await usdc.connect(impersonatedSigner).approve(await liquidityManager.getAddress(), DEPOSIT_AMOUNT);
  console.log("🟢 Approved LiquidityManager to spend USDC");

  await liquidityManager.connect(impersonatedSigner).deposit(USDC_ADDRESS, DEPOSIT_AMOUNT);
  console.log(`✅ Deposited ${ethers.formatUnits(DEPOSIT_AMOUNT, 6)} USDC`);

  // Supply to pool
  const pool = protocol === "compound" ? COMET_MARKET_ADDRESS : AAVE_POOL_ADDRESS;
  const marketType = protocol === "compound" ? 1 : 0;
  await liquidityManager.supply(USDC_ADDRESS, pool, DEPOSIT_AMOUNT, marketType);
  console.log(`✅ Supplied USDC to ${protocol.charAt(0).toUpperCase() + protocol.slice(1)}`);

  // Log user shares
  const userShares = await liquidityManager.userShares(impersonatedSigner.address, USDC_ADDRESS);
  console.log(`📊 User shares: ${ethers.formatUnits(userShares, 6)}\n`);

  // Withdraw from pool
  if (protocol === "compound") {
    await liquidityManager.connect(impersonatedSigner).withdraw(USDC_ADDRESS, COMET_MARKET_ADDRESS, userShares, marketType);
  } else {
    await liquidityManager.connect(impersonatedSigner).withdraw(USDC_ADDRESS, AAVE_POOL_ADDRESS, userShares, marketType);
  }

  const userSharesAfter = await liquidityManager.userShares(impersonatedSigner.address, USDC_ADDRESS);
  console.log(`📉 User shares after withdrawal: ${ethers.formatUnits(userSharesAfter, 6)}`);
  console.log(`✅ Withdrew from ${protocol.charAt(0).toUpperCase() + protocol.slice(1)} successfully\n`);
}

async function main() {
  console.log("🔁 Starting Compound Flow...");
  await runTest("compound");

  console.log("\n🔁 Starting Aave Flow...");
  await runTest("aave");
}

main().catch((err) => {
  console.error("❌ Error:", err);
  process.exit(1);
});
