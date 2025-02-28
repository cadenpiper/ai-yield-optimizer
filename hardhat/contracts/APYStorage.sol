// SPDX-License-Identifier: UNLICENSE
pragma solidity ^0.8.28;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract APYStorage is Ownable {

    struct APYData {
        uint256 apy;
        uint256 lastUpdated;
    }

    mapping(address => APYData) public apyRecords;
    mapping(address => bool) public whitelistedAccounts;

    event APYUpdated(address indexed pool, uint256 apy, uint256 timestamp);

    constructor() Ownable(msg.sender) {}

    function updateAPY(address _pool, uint256 _newAPY) external {
        require(msg.sender == owner() || whitelistedAccounts[msg.sender], 'Not authorized to update APY');
        require(_newAPY != apyRecords[_pool].apy, 'APY Has not changed, already set');
        require(_newAPY > 0, "APY cannot be negative");

        apyRecords[_pool] = APYData(_newAPY, block.timestamp);
        emit APYUpdated(_pool, _newAPY, block.timestamp);
    }

    function getAPY(address _pool) external view returns (uint256, uint256) {
        APYData memory data = apyRecords[_pool];
        return (data.apy, data.lastUpdated);
    }

    function whitelistAccount(address _account) external onlyOwner {
        whitelistedAccounts[_account] = true;
    }

    function removeWhitelist(address _account) external onlyOwner {
        whitelistedAccounts[_account] = false;
    }
}
