const { ethers } = require("hardhat");

const USDC_ADDRESS = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';
const AAVE_POOL_ADDRESS = '0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2';

async function main() {
    // Impersonate Eth mainnet USDC whale
    const impersonatedSigner = await ethers.getImpersonatedSigner("0xaD354CfBAa4A8572DD6Df021514a3931A8329Ef5");
    const usdc = await ethers.getContractAt("IERC20", USDC_ADDRESS);

    // Fund impersonated account with ETH for gas
    const [deployer] = await ethers.getSigners();
    await deployer.sendTransaction({
        to: impersonatedSigner.address,
        value: ethers.parseEther("1"),
    });
    console.log("\nFunded impersonated signer with ETH for gas.");

    const usdcBalance = await usdc.balanceOf(impersonatedSigner.address);
    console.log(`Impersonated Signer USDC balance: ${ethers.formatUnits(usdcBalance, 6)} USDC.`);

    // Deploy LiquidityManager contract
    const LiquidityManager = await ethers.getContractFactory("LiquidityManager");
    const liquidityManager = await LiquidityManager.deploy();
    await liquidityManager.waitForDeployment();
    console.log(`\nLiquidityManager.sol deployed at: ${await liquidityManager.getAddress()}`);

    // Set supported token and pool
    await liquidityManager.updateSupportedTokens(USDC_ADDRESS, true);
    await liquidityManager.updateSupportedPools(AAVE_POOL_ADDRESS, true);
    console.log('USDC and AAVE pool supported.');

    // Approve contract to spend USDC
    const amount = ethers.parseUnits("1000", 6);
    await usdc.connect(impersonatedSigner).approve(await liquidityManager.getAddress(), amount);
    console.log("Approved LiquidityManager.sol to spend USDC.");

    // Deposit USDC into LiquidityManager.sol
    await liquidityManager.connect(impersonatedSigner).deposit(USDC_ADDRESS, amount);
    console.log("Deposited USDC into LiquidityManager.sol");

    // Supply to Aave via LiquidityManager.sol
    await liquidityManager.supplyToAave(USDC_ADDRESS, AAVE_POOL_ADDRESS, amount);
    console.log("Supplied USDC to Aave via LiquidityManager.sol\n");
}

main()
