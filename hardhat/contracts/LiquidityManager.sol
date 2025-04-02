// SPDX-License-Identifier: UNLICENSE
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@aave/core-v3/contracts/interfaces/IPool.sol";
import "./interfaces/IComet.sol";

contract LiquidityManager is ReentrancyGuard, Ownable {
    using SafeERC20 for IERC20;

    mapping(address => bool) public supportedTokens;
    mapping(address => bool) public supportedMarkets;
    mapping(address => mapping(address => uint256)) public userShares; // user => token => shares
    mapping(address => uint256) public totalShares; // token => total shares
    mapping(address => uint256) public totalLiquidity; // token => total liquidity across all markets
    mapping(address => mapping(address => uint256)) public marketLiquidity; // token => market => liquidity
    mapping(address => address) public tokenToComet;

    enum Protocol { Aave, Compound }
    
    event SharesMinted(address indexed user, address indexed token, uint256 amount, uint256 shares);
    event SharesBurned(address indexed user, address indexed token, uint256 amount, uint256 shares);
    event Supplied(address indexed token, address indexed destination, uint256 amount, Protocol protocol);
    event TokenSupportUpdated(address indexed token, bool status);
    event MarketSupportUpdated(address indexed market, bool status);
    event CometAddressSet(address indexed token, address indexed comet);

    error InvalidTokenOrAmount();
    error InvalidDestination();
    error UnsupportedProtocol();
    error InsufficientShares();
    error WithdrawalFailed();
    error TokenSupportUnchanged();
    error MarketSupportUnchanged();
    error InvalidAddress();

    constructor() Ownable(msg.sender) {}

    function deposit(address _token, uint256 _amount) external nonReentrant {
        if (!supportedTokens[_token] || _amount == 0) revert InvalidTokenOrAmount();

        uint256 shares = totalLiquidity[_token] == 0 
            ? _amount 
            : (_amount * totalShares[_token]) / totalLiquidity[_token];

        userShares[msg.sender][_token] += shares;
        totalShares[_token] += shares;
        totalLiquidity[_token] += _amount;

        IERC20(_token).safeTransferFrom(msg.sender, address(this), _amount);

        emit SharesMinted(msg.sender, _token, _amount, shares);
    }

    function supply(address _token, address _destination, uint256 _amount, Protocol _protocol) external nonReentrant {
        if (!supportedTokens[_token] || _amount == 0) revert InvalidTokenOrAmount();
        
        if (_protocol == Protocol.Aave) {
            if (!supportedMarkets[_destination]) revert InvalidDestination();
            IERC20(_token).forceApprove(_destination, _amount);
            IPool(_destination).supply(_token, _amount, address(this), 0);
        } else if (_protocol == Protocol.Compound) {
            address cometAddr = tokenToComet[_token];
            if (cometAddr == address(0)) revert InvalidDestination();
            IERC20(_token).forceApprove(cometAddr, _amount);
            IComet(cometAddr).supply(_token, _amount);
        } else {
            revert UnsupportedProtocol();
        }

        marketLiquidity[_token][_destination] += _amount;
        emit Supplied(_token, _destination, _amount, _protocol);
    }

    function withdraw(address _token, address _destination, uint256 _shares, Protocol _protocol) external nonReentrant {
        if (!supportedTokens[_token] || _shares == 0) revert InvalidTokenOrAmount();
        if (userShares[msg.sender][_token] < _shares) revert InsufficientShares();

        bool isAave = _protocol == Protocol.Aave;
        if (!supportedMarkets[_destination]) revert InvalidDestination();

        uint256 marketTotal = marketLiquidity[_token][_destination];
        if (marketTotal == 0) revert WithdrawalFailed();
        uint256 amountToWithdraw = (_shares * marketTotal) / totalShares[_token];
        uint256 withdrawnAmount;

        if (isAave) {
            DataTypes.ReserveData memory reserveData = IPool(_destination).getReserveData(_token);
            address aToken = reserveData.aTokenAddress;
            if (aToken == address(0)) revert InvalidDestination();

            uint256 aTokenBalance = IERC20(aToken).balanceOf(address(this));
            if (aTokenBalance < amountToWithdraw) revert WithdrawalFailed();

            IERC20(aToken).forceApprove(_destination, amountToWithdraw);
            withdrawnAmount = IPool(_destination).withdraw(_token, amountToWithdraw, address(this));
        } else {
            address cometAddr = tokenToComet[_token];
            if (cometAddr == address(0)) revert InvalidDestination();
            uint256 balanceBefore = IERC20(_token).balanceOf(address(this));
            IComet(cometAddr).withdraw(_token, amountToWithdraw);
            withdrawnAmount = IERC20(_token).balanceOf(address(this)) - balanceBefore;
        }

        if (withdrawnAmount == 0) revert WithdrawalFailed();

        userShares[msg.sender][_token] -= _shares;
        totalShares[_token] -= _shares;
        totalLiquidity[_token] -= withdrawnAmount;
        marketLiquidity[_token][_destination] -= withdrawnAmount;

        IERC20(_token).safeTransfer(msg.sender, withdrawnAmount);

        emit SharesBurned(msg.sender, _token, withdrawnAmount, _shares);
    }

    function updateTokenSupport(address _token, bool _status) external onlyOwner {
        if (supportedTokens[_token] == _status) revert TokenSupportUnchanged();
        if (_token == address(0)) revert InvalidAddress();
        supportedTokens[_token] = _status;
        emit TokenSupportUpdated(_token, _status);
    }
    
    function updateMarketSupport(address _market, bool _status) external onlyOwner {
        if (supportedMarkets[_market] == _status) revert MarketSupportUnchanged();
        if (_market == address(0)) revert InvalidAddress();
        supportedMarkets[_market] = _status;
        emit MarketSupportUpdated(_market, _status);
    }

    function setCometAddress(address _token, address _comet) external onlyOwner {
        if (_token == address(0) || _comet == address(0)) revert InvalidAddress();
        tokenToComet[_token] = _comet;
        emit CometAddressSet(_token, _comet);
    }
}
