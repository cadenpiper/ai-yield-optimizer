// SPDX-License-Identifier: UNLICENSE
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract MigrateLiquidity is ReentrancyGuard, Ownable {
    using SafeERC20 for IERC20;

    mapping(address => bool) public supportedTokens;
    mapping(address => mapping(address => uint256)) public userShares;
    mapping(address => uint256) public totalShares;

    event Deposit(address indexed user, address indexed token, uint256 amount);
    event Withdraw(address indexed user, address indexed token, uint256 amount);
    event TokenSupportUpdated(address indexed token, bool status);

    constructor() Ownable(msg.sender) {}

    /**
     * @dev Allows users to deposit supported ERC20 tokens.
     * @param _token The token address.
     * @param _amount The amount to deposit.
     */
    function deposit(address _token, uint256 _amount) external nonReentrant {
        require(_amount > 0, "Deposit must be greater than 0.");
        require(supportedTokens[_token], "Token not supported.");

        uint256 poolBalance = IERC20(_token).balanceOf(address(this));
        uint256 sharesToMint;

        if (poolBalance == 0) {
            sharesToMint = _amount;
        } else {
            sharesToMint = (_amount * totalShares[_token]) / poolBalance;
        }

        userShares[msg.sender][_token] += sharesToMint;
        totalShares[_token] += sharesToMint;

        IERC20(_token).safeTransferFrom(msg.sender, address(this), _amount);

        emit Deposit(msg.sender, _token, _amount);
    }

    /**
     * @dev Allows users to withdraw a specific number of shares.
     * @param _token The token address to withdraw.
     * @param _shares The number of shares to redeem for tokens.
     */
    function withdraw(address _token, uint256 _shares) external nonReentrant {
        require(supportedTokens[_token], "Token not supported.");
        require(_shares > 0, "Must withdraw more than 0 shares.");
        
        uint256 userShare = userShares[msg.sender][_token];
        require(userShare >= _shares, "Insufficient shares.");

        uint256 vaultBalance = IERC20(_token).balanceOf(address(this));
        require(vaultBalance > 0, "Insufficient contract balance.");
        require(totalShares[_token] > 0, "No shares exist for this token.");

        uint256 amountToWithdraw = (_shares * vaultBalance) / totalShares[_token];

        userShares[msg.sender][_token] = userShare - _shares;
        totalShares[_token] -= _shares;

        if (totalShares[_token] == 0) {
            delete totalShares[_token]; // Gas-efficient reset
        }

        IERC20(_token).safeTransfer(msg.sender, amountToWithdraw);

        emit Withdraw(msg.sender, _token, amountToWithdraw);
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
