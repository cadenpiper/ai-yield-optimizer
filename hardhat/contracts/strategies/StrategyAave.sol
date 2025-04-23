// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

import "../StrategyBase.sol";
import { Errors } from "../libraries/Errors.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@aave/core-v3/contracts/interfaces/IPool.sol";
import "@aave/core-v3/contracts/protocol/libraries/types/DataTypes.sol";

contract StrategyAave is StrategyBase, ReentrancyGuard, Ownable {
    using SafeERC20 for IERC20;

    mapping(address => bool) public supportedTokens;
    mapping(address => bool) public supportedPools;
    mapping(address => address) public tokenToAToken; // token => aToken
    mapping(address => IPool) public tokenToPool;     // token => Aave pool

    event TokenSupportUpdated(address indexed token, bool status);
    event PoolSupportUpdated(address indexed pool, bool status, address indexed token);
    event CoordinatorUpdated(address indexed coordinator);

    constructor() StrategyBase() Ownable(msg.sender) {}

    function setCoordinator(address _coordinator) external override onlyOwner {
        if (_coordinator == address(0)) revert Errors.InvalidAddress();
        if (_coordinator == coordinator) revert Errors.SameCoordinator();

        coordinator = _coordinator;

        emit CoordinatorUpdated(_coordinator);
    }

    function updateTokenSupport(address _token, bool _status) external onlyOwner {
        if (_token == address(0)) revert Errors.InvalidAddress();
        if (supportedTokens[_token] == _status) revert Errors.TokenSupportUnchanged();
        if (_status && tokenToPool[_token] == IPool(address(0))) revert Errors.NoPoolForToken();

        supportedTokens[_token] = _status;

        if (!_status) {
            delete tokenToPool[_token];
            delete tokenToAToken[_token];
        }

        emit TokenSupportUpdated(_token, _status);
    }

    function updatePoolSupport(address _pool, address _token, bool _status) external onlyOwner {
        if (_pool == address(0) || _token == address(0)) revert Errors.InvalidAddress();
        if (supportedPools[_pool] == _status) revert Errors.PoolSupportUnchanged();

        supportedPools[_pool] = _status;

        if (_status) {
            DataTypes.ReserveData memory data = IPool(_pool).getReserveData(_token);
            if (data.aTokenAddress == address(0)) revert Errors.UnsupportedTokenForPool();
            tokenToPool[_token] = IPool(_pool);
            tokenToAToken[_token] = data.aTokenAddress;
        } else {
            delete tokenToPool[_token];
            delete tokenToAToken[_token];
        }

        emit PoolSupportUpdated(_pool, _status, _token);
    }

    function deposit(address _token, uint256 _amount) external override onlyCoordinator nonReentrant {
        if (!supportedTokens[_token]) revert Errors.UnsupportedToken();
        if (_amount == 0) revert Errors.InvalidAmount();
        IPool pool = tokenToPool[_token];
        if (address(pool) == address(0)) revert Errors.NoPoolForToken();

        IERC20(_token).safeTransferFrom(coordinator, address(this), _amount);
        IERC20(_token).approve(address(pool), _amount);
        pool.supply(_token, _amount, address(this), 0); // aTokens go to StrategyAave, not vault
    }

    function withdraw(address _token, uint256 _amount) external override onlyCoordinator nonReentrant {
        if (!supportedTokens[_token]) revert Errors.UnsupportedToken();
        if (_amount == 0) revert Errors.InvalidAmount();
        IPool pool = tokenToPool[_token];
        if (address(pool) == address(0)) revert Errors.NoPoolForToken();

        uint256 withdrawn = pool.withdraw(_token, _amount, coordinator); // Sends USDC back to vault
        if (withdrawn < _amount) revert("Insufficient withdrawal");
    }

    function balanceOf(address _token) external view override returns (uint256) {
        address aToken = tokenToAToken[_token];
        return IERC20(aToken).balanceOf(address(this));
    }
}
