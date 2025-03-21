// SPDX-License-Identifier: UNLICENSE
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@aave/core-v3/contracts/interfaces/IPool.sol";

contract LiquidityManager is ReentrancyGuard, Ownable {
    using SafeERC20 for IERC20;

    mapping(address => bool) public supportedTokens;
    mapping(address => bool) public supportedPools;
    mapping(address => uint256) public poolBalances;
    mapping(address => address) public poolRewardTokens;

    mapping(address => mapping(address => uint256)) public userShares;
    mapping(address => uint256) public totalShares;
    mapping(address => uint256) public totalLiquidity;

    event SharesMinted(address indexed user, address indexed token, uint256 amount, uint256 shares);
    event TokenSupportUpdated(address indexed token, bool status);

    constructor() Ownable(msg.sender) {}

    /**
     * @dev Allows users to deposit supported ERC20 tokens.
     * @param _token The token address.
     * @param _amount The amount to deposit.
     */
    function deposit(address _token, uint256 _amount) external nonReentrant {
        require(_amount > 0 && supportedTokens[_token], "Invalid deposit amount or token.");

        uint256 vaultLiquidity = totalLiquidity[_token];

        uint256 sharesToMint = (totalShares[_token] == 0)
            ? _amount
            : (_amount * totalShares[_token]) / vaultLiquidity;

        IERC20(_token).safeTransferFrom(msg.sender, address(this), _amount);

        userShares[msg.sender][_token] += sharesToMint;
        totalShares[_token] += sharesToMint;
        totalLiquidity[_token] += _amount;

        emit SharesMinted(msg.sender, _token, _amount, sharesToMint);
    }

    /**
     * @dev Allows the owner to add or remove supported tokens.
     * @param _token The token address.
     * @param _status True to support the token, false to remove support.
     */
    function updateSupportedTokens(address _token, bool _status) external onlyOwner {
        require(supportedTokens[_token] != _status, "Token status unchanged.");

        supportedTokens[_token] = _status;
        emit TokenSupportUpdated(_token, _status);
    }
}
