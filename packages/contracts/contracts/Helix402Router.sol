// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title Helix402Router
 * @notice Atomic settlement + fee split for x402 payments.
 *
 * Flow (single tx):
 *   1. Agent signs transferWithAuthorization(from=agent, to=router, value=gross)
 *   2. Gateway calls router.settle(...)
 *   3. Router pulls USDC from agent via transferWithAuthorization
 *   4. Router sends net amount to merchant
 *   5. Router sends fee to facilitator
 *
 * All in one atomic transaction — no race conditions, no stuck funds.
 */

interface IUSDC {
    function transferWithAuthorization(
        address from,
        address to,
        uint256 value,
        uint256 validAfter,
        uint256 validBefore,
        bytes32 nonce,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external;
}

contract Helix402Router {
    address public immutable usdc;
    address public immutable facilitator;
    address public immutable owner;

    uint256 public feeBps; // basis points (100 = 1%)

    event Settlement(
        address indexed from,
        address indexed merchant,
        uint256 grossAmount,
        uint256 netAmount,
        uint256 feeAmount,
        bytes32 nonce
    );

    event FeeUpdated(uint256 oldBps, uint256 newBps);

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    constructor(address _usdc, address _facilitator, uint256 _feeBps) {
        require(_usdc != address(0), "Invalid USDC");
        require(_facilitator != address(0), "Invalid facilitator");
        require(_feeBps <= 1000, "Fee too high"); // max 10%

        usdc = _usdc;
        facilitator = _facilitator;
        owner = msg.sender;
        feeBps = _feeBps;
    }

    /**
     * @notice Settle a payment atomically: pull USDC from agent, split to merchant + facilitator.
     *
     * @param from         Agent wallet (signed the authorization)
     * @param merchant     Merchant wallet (receives net amount)
     * @param value        Gross payment amount
     * @param validAfter   Auth validity start
     * @param validBefore  Auth validity end
     * @param nonce        Unique nonce (bytes32)
     * @param v            Signature v
     * @param r            Signature r
     * @param s            Signature s
     */
    function settle(
        address from,
        address merchant,
        uint256 value,
        uint256 validAfter,
        uint256 validBefore,
        bytes32 nonce,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external {
        require(merchant != address(0), "Invalid merchant");
        require(value > 0, "Zero amount");

        // 1. Pull USDC from agent to this contract
        IUSDC(usdc).transferWithAuthorization(
            from,
            address(this),
            value,
            validAfter,
            validBefore,
            nonce,
            v, r, s
        );

        // 2. Calculate fee split
        uint256 fee = (value * feeBps) / 10000;
        uint256 net = value - fee;

        // 3. Atomic transfers
        if (net > 0) {
            require(IERC20(usdc).transfer(merchant, net), "Merchant transfer failed");
        }
        if (fee > 0) {
            require(IERC20(usdc).transfer(facilitator, fee), "Fee transfer failed");
        }

        emit Settlement(from, merchant, value, net, fee, nonce);
    }

    /**
     * @notice Update fee basis points. Only owner.
     */
    function setFeeBps(uint256 _feeBps) external onlyOwner {
        require(_feeBps <= 1000, "Fee too high");
        emit FeeUpdated(feeBps, _feeBps);
        feeBps = _feeBps;
    }

    /**
     * @notice Rescue stuck tokens. Only owner.
     */
    function rescue(address token, address to, uint256 amount) external onlyOwner {
        require(IERC20(token).transfer(to, amount), "Rescue failed");
    }
}
