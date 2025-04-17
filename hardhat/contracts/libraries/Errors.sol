// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

library Errors {
  error InvalidAddress();
  error TokenSupportUnchanged();
  error PoolSupportUnchanged();
  error NoPoolForToken();
  error InvalidAmount();
  error UnsupportedToken();
  error UnsupportedTokenForPool();
  error InsufficientWithdrawal();
  error OnlyVault();
  error StrategyAlreadyActive();
  error StrategyNotActive();
  error InvalidStrategyPair();
}
