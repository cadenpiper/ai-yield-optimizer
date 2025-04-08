// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

import "../StrategyBase.sol";
import "../interfaces/IComet.sol";
import { Errors } from "../libraries/Errors.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract StrategyCompoundComet is StrategyBase, ReentrancyGuard {
    using SafeERC20 for IERC20;

    mapping(address => bool) public supportedTokens;
    mapping(address => bool) public supportedMarkets; // Comet markets
    mapping(address => IComet) public tokenToComet;    // token => market (Comet contract)

    event TokenSupportUpdated(address indexed token, bool status);
    event MarketSupportUpdated(address indexed market, bool status, address indexed token);

    constructor(address _vault) StrategyBase(_vault) {}

    function updateTokenSupport(address _token, bool _status) external onlyVault {
        if (_token == address(0)) revert Errors.InvalidAddress();
        if (supportedTokens[_token] == _status) revert Errors.TokenSupportUnchanged();
        if (_status && address(tokenToComet[_token]) == address(0)) revert Errors.NoPoolForToken();

        supportedTokens[_token] = _status;

        if (!_status) {
            delete tokenToComet[_token];
        }

        emit TokenSupportUpdated(_token, _status);
    }

    function updateMarketSupport(address _market, address _token, bool _status) external onlyVault {
        if (_market == address(0) || _token == address(0)) revert Errors.InvalidAddress();
        if (supportedMarkets[_market] == _status) revert Errors.PoolSupportUnchanged();

        supportedMarkets[_market] = _status;

        if (_status) {
            IComet comet = IComet(_market);
            address base = comet.baseToken();
            if (base != _token) revert Errors.UnsupportedTokenForPool();

            tokenToComet[_token] = comet;
        } else {
            delete tokenToComet[_token];
        }

        emit MarketSupportUpdated(_market, _status, _token);
    }

    function deposit(address _token, uint256 _amount) external override onlyVault nonReentrant {
        if (!supportedTokens[_token]) revert Errors.UnsupportedToken();
        if (_amount == 0) revert Errors.InvalidAmount();
        IComet comet = tokenToComet[_token];
        if (address(comet) == address(0)) revert Errors.NoPoolForToken();

        IERC20(_token).safeTransferFrom(vault, address(this), _amount);
        IERC20(_token).approve(address(comet), _amount);
        comet.supply(_token, _amount); // supply base token
    }

    function withdraw(address _token, uint256 _amount) external override onlyVault nonReentrant {
        if (!supportedTokens[_token]) revert Errors.UnsupportedToken();
        if (_amount == 0) revert Errors.InvalidAmount();
        IComet comet = tokenToComet[_token];
        if (address(comet) == address(0)) revert Errors.NoPoolForToken();

        // Track before/after balances
        uint256 before = IERC20(_token).balanceOf(address(this));
        comet.withdraw(_token, _amount);
        uint256 afterBal = IERC20(_token).balanceOf(address(this));
        uint256 received = afterBal - before;

        IERC20(_token).safeTransfer(vault, received);
    }

    function balanceOf(address _token) external view override returns (uint256) {
        IComet comet = tokenToComet[_token];
        return comet.balanceOf(address(this));
    }
}
