// SPDX-License-Identifier: UNLICENSE
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title USDCMigration
 * @dev This is a **template** for migrating USDC liquidity between Aave & Morpho Blue.
 * @notice This implementation may not be correct. Refer to Aave & Morpho Blue documentation
 * for the correct function calls and integrations before using in production.
 */

// **NOTE:** Replace these with the correct interfaces for Aave & Morpho Blue.
interface IAavePool {
    function supply(address asset, uint256 amount, address onBehalfOf, uint16 referralCode) external;
    function withdraw(address asset, uint256 amount, address to) external returns (uint256);
}

interface IMorphoBlue {
    function supply(address poolToken, uint256 amount, address onBehalfOf) external;
    function withdraw(address poolToken, uint256 amount, address to) external;
}

contract MigrateLiquidity is ReentrancyGuard {
    address public owner;
    IERC20 public usdc;

    IAavePool public aavePool;
    IMorphoBlue public morphoBlue;

    event LiquidityMigrated(address indexed user, uint256 amount, string fromProtocol, string toProtocol);

    modifier onlyOwner() {
        require(msg.sender == owner, "Not authorized");
        _;
    }

    /**
     * @dev Constructor sets the initial contract owner and lending pool addresses.
     * @notice Ensure that `_aavePool` and `_morphoBlue` are set to the correct Base addresses.
     */
    constructor(address _aavePool, address _morphoBlue, address _usdcAddress) {
        owner = msg.sender;
        aavePool = IAavePool(_aavePool);
        morphoBlue = IMorphoBlue(_morphoBlue);
        usdc = IERC20(_usdcAddress);
    }

    /**
     * @dev Deposit USDC into Aave lending pool.
     * @notice Check Aave's official docs for the correct function calls.
     */
    function depositToAave(uint256 amount) external nonReentrant {
        usdc.transferFrom(msg.sender, address(this), amount);
        usdc.approve(address(aavePool), amount);
        aavePool.supply(address(usdc), amount, msg.sender, 0);
    }

    /**
     * @dev Deposit USDC into Morpho Blue lending pool.
     * @notice Check Morpho Blue's official docs for the correct function calls.
     */
    function depositToMorpho(uint256 amount) external nonReentrant {
        usdc.transferFrom(msg.sender, address(this), amount);
        usdc.approve(address(morphoBlue), amount);
        morphoBlue.supply(address(usdc), amount, msg.sender);
    }

    /**
     * @dev Migrate liquidity from Aave to Morpho Blue, or vice versa.
     * @param amount The amount of USDC to migrate.
     * @param fromAaveToMorpho If true, migrate from Aave → Morpho Blue. Otherwise, migrate from Morpho Blue → Aave.
     * @notice This function requires the correct Aave & Morpho Blue function calls. Verify before deploying.
     */
    function migrateLiquidity(uint256 amount, bool fromAaveToMorpho) external nonReentrant onlyOwner {
        if (fromAaveToMorpho) {
            // **Withdraw from Aave and deposit into Morpho Blue**
            uint256 withdrawnAmount = aavePool.withdraw(address(usdc), amount, address(this));
            usdc.approve(address(morphoBlue), withdrawnAmount);
            morphoBlue.supply(address(usdc), withdrawnAmount, msg.sender);
            emit LiquidityMigrated(msg.sender, withdrawnAmount, "Aave", "MorphoBlue");
        } else {
            // **Withdraw from Morpho Blue and deposit into Aave**
            morphoBlue.withdraw(address(usdc), amount, address(this));
            usdc.approve(address(aavePool), amount);
            aavePool.supply(address(usdc), amount, msg.sender, 0);
            emit LiquidityMigrated(msg.sender, amount, "MorphoBlue", "Aave");
        }
    }

    /**
     * @dev Withdraw USDC from Aave.
     */
    function withdrawFromAave(uint256 amount) external nonReentrant {
        aavePool.withdraw(address(usdc), amount, msg.sender);
    }

    /**
     * @dev Withdraw USDC from Morpho Blue.
     */
    function withdrawFromMorpho(uint256 amount) external nonReentrant {
        morphoBlue.withdraw(address(usdc), amount, msg.sender);
    }

    /**
     * @dev Update the Aave pool address.
     * @notice This should only be done if necessary and with correct verification.
     */
    function setAavePool(address _aavePool) external onlyOwner {
        aavePool = IAavePool(_aavePool);
    }

    /**
     * @dev Update the Morpho Blue pool address.
     * @notice This should only be done if necessary and with correct verification.
     */
    function setMorphoBlue(address _morphoBlue) external onlyOwner {
        morphoBlue = IMorphoBlue(_morphoBlue);
    }
}
