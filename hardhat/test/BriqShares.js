const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("BriqShares", function () {
    let owner, vault, user, briqShares

    beforeEach(async () => {
        // Get signers
        [owner, vault, user] = await ethers.getSigners();

        // Deploy BriqShares.sol
        const BriqShares = await ethers.getContractFactory("BriqShares");
        briqShares = await BriqShares.deploy("Briq", "BRIQ");
        await briqShares.waitForDeployment();
    });

    describe("Deployment", function () {
        it("has correct name & symbol", async function () {
            expect(await briqShares.name()).to.equal("Briq");
            expect(await briqShares.symbol()).to.equal("BRIQ");
        });

        it("has an owner", async function () {
            expect(await briqShares.owner()).to.equal(owner.address);
        });
    });

    describe("Transferring Ownership to Vault", function () {

        // Set vault address
        beforeEach(async function () {
            await briqShares.connect(owner).setVault(vault.address);
        });

        it("sets vault & transfers ownership", async function () {
            expect(await briqShares.owner()).to.equal(vault.address);
        });

        it("mints & burns correct amount of shares to/from user", async function () {
            await briqShares.connect(vault).mint(user.address, 1000);
            expect(await briqShares.balanceOf(user.address)).to.equal(1000);

            await briqShares.connect(vault).burn(user.address, 1000);
            expect(await briqShares.balanceOf(user.address)).to.equal(0);
        });

        it("reverts unauthorized users", async function () {
            await expect(briqShares.connect(owner).mint(user.address, 1000)).to.be.revertedWith("Only vault can mint");
            await expect(briqShares.connect(owner).burn(user.address, 1000)).to.be.revertedWith("Only vault can burn");
        });
    });
});
