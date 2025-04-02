const { ethers } = require("hardhat");

const USDC_ADDRESS = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"; // Mainnet USDC
const COMET_MARKET_ADDRESS = "0xc3d688B66703497DAA19211EEdff47f25384cdc3"; // Compound Comet (USDC)
const AAVE_POOL_ADDRESS = "0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2"; // Aave V3 Pool
const USDC_WHALE = "0xaD354CfBAa4A8572DD6Df021514a3931A8329Ef5"; // USDC whale
const DEPOSIT_AMOUNT = ethers.parseUnits("150", 6); // 150 USDC (6 decimals)
const SUPPLY_TO_AAVE = ethers.parseUnits("100", 6); // 100 USDC to Aave
const SUPPLY_TO_COMPOUND = ethers.parseUnits("50", 6); // 50 USDC to Compound
const WITHDRAW_SHARES_FROM_AAVE = ethers.parseUnits("50", 6); // 50 shares from Aave
const WITHDRAW_SHARES_FROM_COMPOUND = ethers.parseUnits("25", 6); // 25 shares from Compound

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

  console.log(`📦 Deployed LiquidityManager at: ${await liquidityManager.getAddress()}\n`);
  return { impersonatedSigner, usdc, liquidityManager };
}

async function runMultiMarketTest() {
  const { impersonatedSigner, usdc, liquidityManager } = await setupEnvironment();

  // Initial balance
  const userBalance = await usdc.balanceOf(impersonatedSigner.address);
  console.log("=== Initial Setup ===");
  console.log(`💰 USDC balance of signer: ${ethers.formatUnits(userBalance, 6)} USDC\n`);

  // Configure supported token and markets
  await liquidityManager.updateTokenSupport(USDC_ADDRESS, true);
  await liquidityManager.updateMarketSupport(AAVE_POOL_ADDRESS, true);
  await liquidityManager.updateMarketSupport(COMET_MARKET_ADDRESS, true);

  await liquidityManager.setCometAddress(USDC_ADDRESS, COMET_MARKET_ADDRESS);

  console.log("🔧 Enabled USDC, Aave, and Compound markets, and registered Comet\n");

  // Approve and deposit
  await usdc.connect(impersonatedSigner).approve(await liquidityManager.getAddress(), DEPOSIT_AMOUNT);
  console.log("🟢 Approved LiquidityManager to spend 150 USDC");

  await liquidityManager.connect(impersonatedSigner).deposit(USDC_ADDRESS, DEPOSIT_AMOUNT);
  console.log(`✅ Deposited ${ethers.formatUnits(DEPOSIT_AMOUNT, 6)} USDC\n`);

  // Log initial state
  let userShares = await liquidityManager.userShares(impersonatedSigner.address, USDC_ADDRESS);
  let totalShares = await liquidityManager.totalShares(USDC_ADDRESS);
  let totalLiquidity = await liquidityManager.totalLiquidity(USDC_ADDRESS);
  console.log("=== State After Deposit ===");
  console.log(`  User shares:    ${ethers.formatUnits(userShares, 6)}`);
  console.log(`  Total shares:   ${ethers.formatUnits(totalShares, 6)}`);
  console.log(`  Total liquidity:${ethers.formatUnits(totalLiquidity, 6)} USDC\n`);

  // Supply to Aave
  await liquidityManager.supply(USDC_ADDRESS, AAVE_POOL_ADDRESS, SUPPLY_TO_AAVE, 0);
  console.log(`✅ Supplied ${ethers.formatUnits(SUPPLY_TO_AAVE, 6)} USDC to Aave`);

  // Supply to Compound
  await liquidityManager.supply(USDC_ADDRESS, COMET_MARKET_ADDRESS, SUPPLY_TO_COMPOUND, 1);
  console.log(`✅ Supplied ${ethers.formatUnits(SUPPLY_TO_COMPOUND, 6)} USDC to Compound\n`);

  // Log market liquidity
  let aaveLiquidity = await liquidityManager.marketLiquidity(USDC_ADDRESS, AAVE_POOL_ADDRESS);
  let compoundLiquidity = await liquidityManager.marketLiquidity(USDC_ADDRESS, COMET_MARKET_ADDRESS);
  console.log("=== State After Supply ===");
  console.log(`  Aave liquidity:    ${ethers.formatUnits(aaveLiquidity, 6)} USDC`);
  console.log(`  Compound liquidity:${ethers.formatUnits(compoundLiquidity, 6)} USDC`);
  console.log(`  Total liquidity:   ${ethers.formatUnits(totalLiquidity, 6)} USDC\n`);

  // Partial withdrawal from Aave
  await liquidityManager.connect(impersonatedSigner).withdraw(USDC_ADDRESS, AAVE_POOL_ADDRESS, WITHDRAW_SHARES_FROM_AAVE, 0);
  console.log(`✅ Withdrew ${ethers.formatUnits(WITHDRAW_SHARES_FROM_AAVE, 6)} shares from Aave\n`);

  // Log state after Aave withdrawal
  userShares = await liquidityManager.userShares(impersonatedSigner.address, USDC_ADDRESS);
  totalShares = await liquidityManager.totalShares(USDC_ADDRESS);
  totalLiquidity = await liquidityManager.totalLiquidity(USDC_ADDRESS);
  aaveLiquidity = await liquidityManager.marketLiquidity(USDC_ADDRESS, AAVE_POOL_ADDRESS);
  compoundLiquidity = await liquidityManager.marketLiquidity(USDC_ADDRESS, COMET_MARKET_ADDRESS);
  console.log("=== State After Aave Withdrawal ===");
  console.log(`  User shares:       ${ethers.formatUnits(userShares, 6)}`);
  console.log(`  Total shares:      ${ethers.formatUnits(totalShares, 6)}`);
  console.log(`  Total liquidity:   ${ethers.formatUnits(totalLiquidity, 6)} USDC`);
  console.log(`  Aave liquidity:    ${ethers.formatUnits(aaveLiquidity, 6)} USDC`);
  console.log(`  Compound liquidity:${ethers.formatUnits(compoundLiquidity, 6)} USDC\n`);

  // Partial withdrawal from Compound
  await liquidityManager.connect(impersonatedSigner).withdraw(USDC_ADDRESS, COMET_MARKET_ADDRESS, WITHDRAW_SHARES_FROM_COMPOUND, 1);
  console.log(`✅ Withdrew ${ethers.formatUnits(WITHDRAW_SHARES_FROM_COMPOUND, 6)} shares from Compound\n`);

  // Log final state
  userShares = await liquidityManager.userShares(impersonatedSigner.address, USDC_ADDRESS);
  totalShares = await liquidityManager.totalShares(USDC_ADDRESS);
  totalLiquidity = await liquidityManager.totalLiquidity(USDC_ADDRESS);
  aaveLiquidity = await liquidityManager.marketLiquidity(USDC_ADDRESS, AAVE_POOL_ADDRESS);
  compoundLiquidity = await liquidityManager.marketLiquidity(USDC_ADDRESS, COMET_MARKET_ADDRESS);
  console.log("=== Final State ===");
  console.log(`  User shares:       ${ethers.formatUnits(userShares, 6)}`);
  console.log(`  Total shares:      ${ethers.formatUnits(totalShares, 6)}`);
  console.log(`  Total liquidity:   ${ethers.formatUnits(totalLiquidity, 6)} USDC`);
  console.log(`  Aave liquidity:    ${ethers.formatUnits(aaveLiquidity, 6)} USDC`);
  console.log(`  Compound liquidity:${ethers.formatUnits(compoundLiquidity, 6)} USDC\n`);
}

async function main() {
  console.log("🔁 Starting Multi-Market Test Flow...\n");
  await runMultiMarketTest();
}

main().catch((err) => {
  console.error("❌ Error:", err);
  process.exit(1);
});
