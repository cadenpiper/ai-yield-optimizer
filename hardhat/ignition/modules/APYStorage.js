const { buildModule } = require("@nomicfoundation/hardhat-ignition/modules");

module.exports = buildModule("APYStorageModule", (m) => {
    const apyStorage = m.contract("APYStorage")

    return { apyStorage }
})