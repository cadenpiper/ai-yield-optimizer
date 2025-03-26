const { expect } = require("chai");
const { ethers, userConfig } = require("hardhat");

describe("MigrateLiquidity", function () {
    let owner, user, user2, usdc, liquidityManager;

    beforeEach(async () => {
        // Get signers
        [owner, user, user2] = await ethers.getSigners();
        
        // Deploy Mock USDC token contract
        const MockUSDC = await ethers.getContractFactory("MockUSDC");
        usdc = await MockUSDC.deploy();
        await usdc.waitForDeployment();

        // Deploy MigrateLiquidity contract
        const LiquidityManager = await ethers.getContractFactory("LiquidityManager");
        liquidityManager = await LiquidityManager.deploy();
        await liquidityManager.waitForDeployment();

        // Add MockUSDC as a supported token
        await liquidityManager.updateTokenSupport(usdc.getAddress(), true);
    });

    describe("Deployment", function () {
        it("should set the correct owner", async function () {
            expect(await liquidityManager.owner()).to.equal(owner.address);
        });
    });

    describe("Deposits", function () {
        it("should deposit USDC and update shares correctly", async function () {
            const depositAmount = ethers.parseUnits("1000", 6); // 1000 USDC

            // mint USDC to user
            await usdc.mint(user.address, depositAmount);

            // user approves liquidityManager to spend USDC
            await usdc.connect(user).approve(await liquidityManager.getAddress(), depositAmount);

            // user deposits liquidity
            await expect(liquidityManager.connect(user).deposit(await usdc.getAddress(), depositAmount))
                .to.emit(liquidityManager, "SharesMinted")
                .withArgs(user.address, await usdc.getAddress(), depositAmount, depositAmount);

            // check contract balance
            const vaultBalance = await usdc.balanceOf(await liquidityManager.getAddress());
            expect(vaultBalance).to.equal(depositAmount);

            // check user shares
            const userShares = await liquidityManager.userShares(user.address, await usdc.getAddress());
            expect(userShares).to.equal(depositAmount);

            // check total liquidity
            const totalLiquidity = await liquidityManager.totalLiquidity(await usdc.getAddress());
            expect(totalLiquidity).to.equal(depositAmount);
        });

        it("should deposit multiple times and issue shares accordingly", async function () {
            const depositAmount1 = ethers.parseUnits("1000", 6); // 1000 USDC
            const depositAmount2 = ethers.parseUnits("500", 6); // 500 USDC

            // mint and approve for first deposit
            await usdc.mint(user.address, depositAmount1);
            await usdc.connect(user).approve(await liquidityManager.getAddress(), depositAmount1);

            // first deposit
            await liquidityManager.connect(user).deposit(await usdc.getAddress(), depositAmount1);

            // mint and approve for second deposit
            await usdc.mint(user.address, depositAmount2);
            await usdc.connect(user).approve(await liquidityManager.getAddress(), depositAmount2);

            // second deposit
            await liquidityManager.connect(user).deposit(await usdc.getAddress(), depositAmount2);

            // check user shares
            const userShares = await liquidityManager.userShares(user.address, await usdc.getAddress());
            expect(userShares).to.equal(depositAmount1 + depositAmount2);

            // check total shares
            const totalShares = await liquidityManager.totalShares(await usdc.getAddress());
            expect(totalShares).to.equal(depositAmount1 + depositAmount2);

            // check total liquidity
            const totalLiquidity = await liquidityManager.totalLiquidity(await usdc.getAddress());
            expect(totalLiquidity).to.equal(depositAmount1 + depositAmount2);
        });

        it("should allow multiple users to deposit and issue shares accordingly", async function () {
            const depositAmount1 = ethers.parseUnits("1000", 6); // 1000 USDC
            const depositAmount2 = ethers.parseUnits("600", 6); // 600 USDC

            // mint and approve USDC for both users
            await usdc.mint(user.address, depositAmount1);
            await usdc.mint(user2.address, depositAmount2);
            await usdc.connect(user).approve(await liquidityManager.getAddress(), depositAmount1);
            await usdc.connect(user2).approve(await liquidityManager.getAddress(), depositAmount2);

            // users deposit separately
            await liquidityManager.connect(user).deposit(await usdc.getAddress(), depositAmount1);
            await liquidityManager.connect(user2).deposit(await usdc.getAddress(), depositAmount2);

            // check user share balances
            expect(await liquidityManager.userShares(user.address, await usdc.getAddress())).to.equal(depositAmount1);
            expect(await liquidityManager.userShares(user2.address, await usdc.getAddress())).to.equal(depositAmount2);

            // check total shares
            expect(await liquidityManager.totalShares(await usdc.getAddress())).to.equal(depositAmount1 + depositAmount2);

            // check total liquidity
            expect(await liquidityManager.totalLiquidity(await usdc.getAddress())).to.equal(depositAmount1 + depositAmount2);
        });

        it("should revert if depositing unsupported token", async function () {
            const depositAmount = ethers.parseUnits("1000", 6);
            const unsupportedToken = ethers.Wallet.createRandom().address;

            await expect(liquidityManager.connect(user).deposit(unsupportedToken, depositAmount))
                .to.be.revertedWithCustomError(liquidityManager, "InvalidTokenOrAmount");
        });

        it("should revert if depositing 0 amount", async function () {
            await expect(liquidityManager.connect(user).deposit(usdc.getAddress(), 0))
                .to.be.revertedWithCustomError(liquidityManager, "InvalidTokenOrAmount");
        });
    });

    describe("Update Supported Tokens", function () {
        it("should allow owner to add supported token", async function () {
            const newToken = ethers.Wallet.createRandom().address;
            await expect(liquidityManager.updateTokenSupport(newToken, true))
                .to.emit(liquidityManager, "TokenSupportUpdated")
                .withArgs(newToken, true);
            expect(await liquidityManager.supportedTokens(newToken)).to.be.true;
        });

        it("should allow owner to remove supported token", async function () {
            await expect(liquidityManager.updateTokenSupport(usdc.getAddress(), false))
                .to.emit(liquidityManager, "TokenSupportUpdated")
                .withArgs(usdc.getAddress(), false);
            expect(await liquidityManager.supportedTokens(usdc.getAddress())).to.be.false;
        });

        it("should revert if token status is unchanged", async function () {
            await expect(liquidityManager.updateTokenSupport(usdc.getAddress(), true))
                .to.be.revertedWithCustomError(liquidityManager, "TokenSupportUnchanged");
        });
    });

    describe("Update Supported Markets", function () {
        it("should allow owner to add and remove supported markets", async function () {
            const newMarket = ethers.Wallet.createRandom().address;

            // Add support for market
            await expect(liquidityManager.updateMarketSupport(newMarket, true))
                .to.emit(liquidityManager, "MarketSupportUpdated")
                .withArgs(newMarket, true);
            expect(await liquidityManager.supportedMarkets(newMarket)).to.be.true;

            // Remove support for market
            await expect(liquidityManager.updateMarketSupport(newMarket, false))
                .to.emit(liquidityManager, "MarketSupportUpdated")
                .withArgs(newMarket, false);
            expect(await liquidityManager.supportedMarkets(newMarket)).to.be.false;

            // Ensure transaction reverts if status is unchanged
            await expect(liquidityManager.updateMarketSupport(newMarket, false))
                .to.be.revertedWithCustomError(liquidityManager, "MarketSupportUnchanged");
        });
    });
});
