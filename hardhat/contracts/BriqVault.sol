// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

import "./StrategyCoordinator.sol";
import "./BriqShares.sol";
import { Errors } from "./libraries/Errors.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract BriqVault is Ownable, ReentrancyGuard {
    StrategyCoordinator public strategyCoordinator;
    BriqShares public briqShares;

    event UserDeposited(address indexed user, address indexed token, uint256 amount, uint256 shares);

    constructor(address _coordinator, address _briqShares) Ownable(msg.sender) {
        if (_coordinator == address(0) || _briqShares == address(0)) revert Errors.InvalidAddress();

        strategyCoordinator = StrategyCoordinator(_coordinator);
        briqShares = BriqShares(_briqShares);
    }

    // onlyRupert modifier

    // Deposit
    function deposit(address _token, uint256 _amount) external nonReentrant {
        if (_amount == 0) revert Errors.InvalidAmount();

        // Transfer tokens from user to vault
        IERC20(_token).transferFrom(msg.sender, address(this), _amount);

        // Approve and deposit tokens to StrategyCoordinator.sol
        IERC20(_token).approve(address(strategyCoordinator), _amount);
        strategyCoordinator.deposit(_token, _amount);

        // Calculate total token balance across all strategies
        uint256 totalBalance = strategyCoordinator.getTotalTokenBalance(_token);
        uint256 totalShares = briqShares.totalSupply();

        // Calculate shares to mint
        uint256 sharesToMint = (totalShares == 0 || totalBalance == 0)
            ? _amount * 1e12
            : (_amount * totalShares) / (totalBalance - _amount);

        // Mint shares to user
        briqShares.mint(msg.sender, sharesToMint);

        emit UserDeposited(msg.sender, _token, _amount, sharesToMint);
    }

    // Withdraw
}