const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("PlatypusYield", function () {
    let owner, usdc, migrateLiquidity;

    beforeEach(async () => {
        // Get signers
        [owner, user] = await ethers.getSigners();
        
        // Deploy Mock USDC token contract
        const MockUSDC = await ethers.getContractFactory("MockUSDC");
        usdc = await MockUSDC.deploy();
        await usdc.waitForDeployment();

        // Deploy MigrateLiquidity.sol contract
        const MigrateLiquidity = await ethers.getContractFactory("MigrateLiquidity");
        migrateLiquidity = await MigrateLiquidity.deploy();
        await migrateLiquidity.waitForDeployment();

        // Add MockUSDC as a supported token
        await migrateLiquidity.updateSupportedTokens(usdc.getAddress(), true);
    });

    describe("MockUSDC", function () {
        describe("Deployment", function () {
            it("should mint 1,000,000 USDC to deployer", async function () {
                const ownerBalance = await usdc.balanceOf(owner.address);
                expect(ownerBalance).to.equal(ethers.parseUnits("1000000", 6));
            });
        });
    });

    describe("MigrateLiquidity", function () {
        describe("Deployment", function () {
            it("should have an owner", async function () {
                expect(await migrateLiquidity.owner()).to.equal(await owner.getAddress());
            });
        });

        describe("Depositing", function () {
            it("should deposit USDC and update shares", async function () {
                const depositAmount = ethers.parseUnits("1000", 6);

                // Transfer USDC to user for testing
                await usdc.transfer(user.address, depositAmount);

                // User approves MigrateLiquidity.sol to spend USDC
                await usdc.connect(user).approve(await migrateLiquidity.getAddress(), depositAmount);

                // Get the inital contract balance
                const initialBalance = await usdc.balanceOf(await migrateLiquidity.getAddress());

                // Perform deposit
                await migrateLiquidity.connect(user).deposit(usdc.getAddress(), depositAmount);

                // Check contract balance
                const newBalance = await usdc.balanceOf(await migrateLiquidity.getAddress());
                expect(newBalance).to.equal(initialBalance + depositAmount);
                
                // Check if shares updated
                const userShares = await migrateLiquidity.userShares(user.address, usdc.getAddress());
                expect(userShares).to.be.gt(0);
                expect(userShares).to.equal(depositAmount);
            });

            it("should revert !supported tokens", async function () {
                const depositAmount = ethers.parseUnits("1000", 6);

                await expect(
                    migrateLiquidity.connect(user).deposit(ethers.ZeroAddress, depositAmount)
                ).to.be.revertedWith("Token not supported.");
            })

            it("should revert if deposit amount is 0", async function () {
                await expect(
                    migrateLiquidity.connect(user).deposit(usdc.getAddress(), 0)
                ).to.be.revertedWith("Deposit must be greater than 0.");
            })
        });
    });
});