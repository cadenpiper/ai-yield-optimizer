// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

abstract contract StrategyBase {
    address public immutable vault;

    constructor(address _vault) {
        require(_vault != address(0), "Invalid vault address");
        vault = _vault;
    }

    modifier onlyVault() {
        require(msg.sender == vault, "Only vault");
        _;
    }

    function deposit(address _token, uint256 _amount) external virtual;
    function withdraw(address _token, uint256 _amount) external virtual;
    function balanceOf(address _token) external view virtual returns (uint256);
}
