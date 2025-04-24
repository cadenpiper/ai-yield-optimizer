// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

import "./StrategyBase.sol";
import "./strategies/StrategyAave.sol";
import "./strategies/StrategyCompound.sol";
import { Errors } from "./libraries/Errors.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract StrategyCoordinator is Ownable, ReentrancyGuard {
    address public vault;
    StrategyAave public strategyAave;
    StrategyCompoundComet public strategyCompound;

    enum StrategyType {
        AAVE,
        COMPOUND
    }

    mapping(address => StrategyType) public tokenToStrategy;
    mapping(address => bool) public supportedTokens;

    event StrategyUpdated(address indexed token, StrategyType strategyType);
    event Deposit(address indexed token, uint256 amount, StrategyType strategyType);
    event Withdrawal(address indexed token, uint256 amount, StrategyType strategyType);

    constructor(
        address _strategyAave,
        address _strategyCompound
    ) Ownable(msg.sender) {
        if ( _strategyAave == address(0) || _strategyCompound == address(0)) 
            revert Errors.InvalidAddress();
        
        strategyAave = StrategyAave(_strategyAave);
        strategyCompound = StrategyCompoundComet(_strategyCompound);
    }

    modifier onlyVault() {
        if (msg.sender != vault) revert Errors.OnlyVault();
        _;
    }

    function updateVaultAddress(address _vault) external onlyOwner {
        if (_vault == address(0)) revert Errors.InvalidAddress();
        vault = _vault;
    }

    function setStrategyForToken(address _token, StrategyType _strategyType) external onlyOwner {
        if (_token == address(0)) revert Errors.InvalidAddress();
        
        // Check if the token is supported by the selected strategy
        if (_strategyType == StrategyType.AAVE) {
            if (!strategyAave.supportedTokens(_token)) revert Errors.UnsupportedToken();
        } else if (_strategyType == StrategyType.COMPOUND) {
            if (!strategyCompound.supportedTokens(_token)) revert Errors.UnsupportedToken();
        }

        supportedTokens[_token] = true;
        tokenToStrategy[_token] = _strategyType;
        emit StrategyUpdated(_token, _strategyType);
    }

    function deposit(address _token, uint256 _amount) external onlyVault nonReentrant {
        if (!supportedTokens[_token]) revert Errors.UnsupportedToken();
        if (_amount == 0) revert Errors.InvalidAmount();

        StrategyType strategyType = tokenToStrategy[_token];
        
        // Transfer tokens from vault to coordinator
        IERC20(_token).transferFrom(vault, address(this), _amount);

        // Approve and deposit to appropriate strategy
        if (strategyType == StrategyType.AAVE) {
            IERC20(_token).approve(address(strategyAave), _amount);
            strategyAave.deposit(_token, _amount);
        } else if (strategyType == StrategyType.COMPOUND) {
            IERC20(_token).approve(address(strategyCompound), _amount);
            strategyCompound.deposit(_token, _amount);
        }

        emit Deposit(_token, _amount, strategyType);
    }

    function withdraw(address _token, uint256 _amount) external onlyVault nonReentrant {
        if (!supportedTokens[_token]) revert Errors.UnsupportedToken();
        if (_amount == 0) revert Errors.InvalidAmount();

        StrategyType strategyType = tokenToStrategy[_token];
        
        // Withdraw from appropriate strategy
        if (strategyType == StrategyType.AAVE) {
            strategyAave.withdraw(_token, _amount);
        } else if (strategyType == StrategyType.COMPOUND) {
            strategyCompound.withdraw(_token, _amount);
        }

        // Transfer tokens to vault contract
        IERC20(_token).transfer(vault, _amount);

        emit Withdrawal(_token, _amount, strategyType);
    }

    function getStrategyBalance(address _token) external view returns (uint256) {
        if (!supportedTokens[_token]) return 0;

        StrategyType strategyType = tokenToStrategy[_token];
        
        if (strategyType == StrategyType.AAVE) {
            return strategyAave.balanceOf(_token);
        } else if (strategyType == StrategyType.COMPOUND) {
            return strategyCompound.balanceOf(_token);
        }
        
        return 0;
    }

    // Helper for minting shares and tracking total token balance across strategies
    function getTotalTokenBalance(address _token) external view returns (uint256) {
        uint256 total = 0;
        if (strategyAave.supportedTokens(_token)) {
            total += strategyAave.balanceOf(_token);
        }
        if (strategyCompound.supportedTokens(_token)) {
            total += strategyCompound.balanceOf(_token);
        }

        return total;
    }

    // Emergency functions
    function emergencyWithdraw(address _token) external onlyOwner {
        StrategyType strategyType = tokenToStrategy[_token];
        
        if (strategyType == StrategyType.AAVE) {
            uint256 balance = strategyAave.balanceOf(_token);
            strategyAave.withdraw(_token, balance);
        } else if (strategyType == StrategyType.COMPOUND) {
            uint256 balance = strategyCompound.balanceOf(_token);
            strategyCompound.withdraw(_token, balance);
        }
        
        uint256 tokenBalance = IERC20(_token).balanceOf(address(this));
        if (tokenBalance > 0) {
            IERC20(_token).transfer(vault, tokenBalance);
        }
    }
}
