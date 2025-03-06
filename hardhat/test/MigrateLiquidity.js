const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("MigrateLiquidity", function () {
    let owner, user, usdc, migrateLiquidity;

    beforeEach(async () => {
        // Get signers
        [owner, user] = await ethers.getSigners();
        
        // Deploy Mock USDC token contract
        const MockUSDC = await ethers.getContractFactory("MockUSDC");
        usdc = await MockUSDC.deploy();
        await usdc.waitForDeployment();

        // Deploy MigrateLiquidity contract
        const MigrateLiquidity = await ethers.getContractFactory("MigrateLiquidity");
        migrateLiquidity = await MigrateLiquidity.deploy();
        await migrateLiquidity.waitForDeployment();

        // Add MockUSDC as a supported token
        await migrateLiquidity.updateSupportedTokens(usdc.getAddress(), true);
    });

    describe("Deployment", function () {
        it("should set the correct owner", async function () {
            expect(await migrateLiquidity.owner()).to.equal(owner.address);
        });
    });

    describe("updateSupportedTokens", function () {
        it("should allow owner to add supported token", async function () {
            const newToken = ethers.Wallet.createRandom().address;
            await expect(migrateLiquidity.updateSupportedTokens(newToken, true))
                .to.emit(migrateLiquidity, "TokenSupportUpdated")
                .withArgs(newToken, true);
            expect(await migrateLiquidity.supportedTokens(newToken)).to.be.true;
        });

        it("should allow owner to remove supported token", async function () {
            await expect(migrateLiquidity.updateSupportedTokens(usdc.getAddress(), false))
                .to.emit(migrateLiquidity, "TokenSupportUpdated")
                .withArgs(usdc.getAddress(), false);
            expect(await migrateLiquidity.supportedTokens(usdc.getAddress())).to.be.false;
        });

        it("should not update if token status is unchanged", async function () {
            await expect(migrateLiquidity.updateSupportedTokens(usdc.getAddress(), true))
                .to.be.revertedWith("Token status unchanged.");
        });
    });

    describe("Deposits", function () {
        it("should deposit USDC and update shares correctly", async function () {
            const depositAmount = ethers.parseUnits("1000", 6);

            // Transfer USDC to user for testing
            await usdc.transfer(user.address, depositAmount);

            // User approves contract to spend USDC
            await usdc.connect(user).approve(migrateLiquidity.getAddress(), depositAmount);

            // Perform deposit
            await expect(migrateLiquidity.connect(user).deposit(usdc.getAddress(), depositAmount))
                .to.emit(migrateLiquidity, "Deposit")
                .withArgs(user.address, usdc.getAddress(), depositAmount);

            // Check contract balance and shares
            const newBalance = await usdc.balanceOf(migrateLiquidity.getAddress());
            const userShares = await migrateLiquidity.userShares(user.address, usdc.getAddress());

            expect(newBalance).to.equal(depositAmount);
            expect(userShares).to.equal(depositAmount);
        });

        it("should revert if depositing unsupported token", async function () {
            const depositAmount = ethers.parseUnits("1000", 6);
            const unsupportedToken = ethers.Wallet.createRandom().address;

            await expect(migrateLiquidity.connect(user).deposit(unsupportedToken, depositAmount))
                .to.be.revertedWith("Token not supported.");
        });

        it("should revert if depositing 0 amount", async function () {
            await expect(migrateLiquidity.connect(user).deposit(usdc.getAddress(), 0))
                .to.be.revertedWith("Deposit must be greater than 0.");
        });
    });

    describe("Withdrawals", function () {
        let amount;

        beforeEach(async function () {
            amount = ethers.parseUnits("1000", 6);

            // Fund user with USDC
            await usdc.transfer(user.address, amount);

            // Approve & deposit 1,000 USDC
            await usdc.connect(user).approve(migrateLiquidity.getAddress(), amount);
            await migrateLiquidity.connect(user).deposit(usdc.getAddress(), amount);
        });

        it("should allow partial withdrawals and update shares", async function () {
            const sharesToWithdraw = ethers.parseUnits("500", 6);
            
            // Get initial balances
            let initialContractBalance = await usdc.balanceOf(migrateLiquidity.getAddress());
            let initialUserBalance = await usdc.balanceOf(user.address);

            // Withdraw and check event
            await expect(migrateLiquidity.connect(user).withdraw(usdc.getAddress(), sharesToWithdraw))
                .to.emit(migrateLiquidity, "Withdraw")
                .withArgs(user.address, usdc.getAddress(), sharesToWithdraw);

            // Get updated balances
            let updatedContractBalance = await usdc.balanceOf(migrateLiquidity.getAddress());
            let updatedUserBalance = await usdc.balanceOf(user.address);
            let remainingShares = await migrateLiquidity.userShares(user.address, usdc.getAddress());

            expect(updatedContractBalance).to.equal(initialContractBalance - sharesToWithdraw);
            expect(updatedUserBalance).to.equal(initialUserBalance + sharesToWithdraw);
            expect(remainingShares).to.equal(ethers.parseUnits("500", 6));
        });

        it("should allow full withdrawal and reset user shares", async function () {
            const sharesToWithdraw = ethers.parseUnits("1000", 6);

            await expect(migrateLiquidity.connect(user).withdraw(usdc.getAddress(), sharesToWithdraw))
                .to.emit(migrateLiquidity, "Withdraw")
                .withArgs(user.address, usdc.getAddress(), sharesToWithdraw);

            const userSharesAfter = await migrateLiquidity.userShares(user.address, usdc.getAddress());
            expect(userSharesAfter).to.equal(0);
        });

        it("should revert if user tries to withdraw more than they own", async function () {
            await expect(
                migrateLiquidity.connect(user).withdraw(usdc.getAddress(), ethers.parseUnits("2000", 6))
            ).to.be.revertedWith("Insufficient shares.");
        });

        it("should revert if withdrawing unsupported token", async function () {
            await expect(
                migrateLiquidity.connect(user).withdraw(ethers.ZeroAddress, ethers.parseUnits("500", 6))
            ).to.be.revertedWith("Token not supported.");
        });

        it("should revert if withdrawing 0 shares", async function () {
            await expect(
                migrateLiquidity.connect(user).withdraw(usdc.getAddress(), 0)
            ).to.be.revertedWith("Must withdraw more than 0 shares.");
        });

        it("should revert if contract has insufficient balance", async function () {
            await migrateLiquidity.connect(user).withdraw(usdc.getAddress(), amount);

            await expect(
                migrateLiquidity.connect(user).withdraw(usdc.getAddress(), ethers.parseUnits("1", 6))
            ).to.be.revertedWith("Insufficient shares.");
        });
    });
});
