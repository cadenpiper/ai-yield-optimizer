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

    modifier onlyWhitelisted() {
        require(msg.sender == owner() || whitelistedAccounts[msg.sender], 'Not authorized.');
        _;
    }

    /**
     * @dev Updates the APY for a given pool.
     * @param _pool The pool address.
     * @param _newAPY The new APY value.
     */
    function updateAPY(address _pool, uint256 _newAPY) external onlyWhitelisted {
        APYData storage record = apyRecords[_pool];
        require(_newAPY != record.apy, 'APY has not changed');

        record.apy = _newAPY;
        record.lastUpdated = block.timestamp;
        emit APYUpdated(_pool, _newAPY, block.timestamp);
    }

    /**
     * @dev Returns the APY and last updated timestamp for a pool.
     */
    function getAPY(address _pool) external view returns (uint256, uint256) {
        APYData memory data = apyRecords[_pool];
        return (data.apy, data.lastUpdated);
    }

    /**
     * @dev Whitelists an account for APY updates.
     */
    function whitelistAccount(address _account) external onlyOwner {
        whitelistedAccounts[_account] = true;
    }

    /**
     * @dev Removes an account from the whitelist.
     */
    function removeWhitelist(address _account) external onlyOwner {
        delete whitelistedAccounts[_account]; // Gas optimized removal
    }
}
