const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("APYStorage", function () {
  let apyStorage, owner;

  beforeEach(async () => {
    // Get signers
    [owner] = await ethers.getSigners();

    // Deploy contract
    const APYStorage = await ethers.getContractFactory("APYStorage");
    apyStorage = await APYStorage.deploy();
    await apyStorage.waitForDeployment();
  });

  describe("Deployment", function () {
    it("should have an address", async function () {
      expect(await apyStorage.getAddress()).to.be.properAddress;
    });

    it("has an owner", async function () {
      expect(await apyStorage.owner()).to.equal(await owner.getAddress())
    })
  });

  describe("UpdatingAPY", function () {
    let mockPoolAddress, mockAPYValue

      beforeEach (async () => {
        mockPoolAddress = '0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2'
        mockAPYValue = 10
        const updateAPY = await apyStorage.updateAPY(mockPoolAddress, mockAPYValue)
      })

      it("should update and store the APY value", async function () {
        const [apy, ] = await apyStorage.getAPY(mockPoolAddress)
        expect(await apy.toString()).to.equal("10")
      })
  
      it("should have a timestamp", async () => {
        const [, timestamp] = await apyStorage.getAPY(mockPoolAddress)
        expect(timestamp).to.be.gt(0)
      })
  })

  describe("Events", function () {
    it("Should emit an event on APY update", async function () {
      const mockPoolAddress = "0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2";
      const mockAPYValue = 600;

      await expect(apyStorage.updateAPY(mockPoolAddress, mockAPYValue))
        .to.emit(apyStorage, "APYUpdated")
        .withArgs(mockPoolAddress, mockAPYValue, await ethers.provider.getBlock("latest").then((block) => block.timestamp) + 1);
    });
  });

});
