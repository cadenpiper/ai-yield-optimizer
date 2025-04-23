// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

abstract contract StrategyBase {
    address public coordinator;

    modifier onlyCoordinator() {
        require(msg.sender == coordinator, "Only Coordinator");
        _;
    }

    function setCoordinator(address _coordinator) external virtual;
    function deposit(address _token, uint256 _amount) external virtual;
    function withdraw(address _token, uint256 _amount) external virtual;
    function balanceOf(address _token) external view virtual returns (uint256);
}
