// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/EIP712.sol";

/**
 * @title MockUSDC
 * @notice Mock USDC with EIP-3009 (transferWithAuthorization) for x402 settlement.
 *         6 decimals like real USDC. Anyone can mint — testnet only.
 *
 * @dev Implements EIP-3009 which allows gasless transfers via signed authorizations.
 *      The facilitator calls transferWithAuthorization with the agent's signature,
 *      executing the USDC transfer without the agent needing to submit a tx.
 */
contract MockUSDC is ERC20, EIP712 {
    using ECDSA for bytes32;

    uint8 private constant _DECIMALS = 6;

    // EIP-3009 typehash
    bytes32 public constant TRANSFER_WITH_AUTHORIZATION_TYPEHASH =
        keccak256("TransferWithAuthorization(address from,address to,uint256 value,uint256 validAfter,uint256 validBefore,bytes32 nonce)");

    // Tracks used authorization nonces: authorizer => nonce => used
    mapping(address => mapping(bytes32 => bool)) private _authorizationStates;

    event AuthorizationUsed(address indexed authorizer, bytes32 indexed nonce);

    constructor() ERC20("USD Coin", "USDC") EIP712("USD Coin", "2") {}

    function decimals() public pure override returns (uint8) {
        return _DECIMALS;
    }

    /**
     * @notice Mint tokens to any address. No access control — testnet only.
     */
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    /**
     * @notice Check if an authorization nonce has been used.
     * @param authorizer The address that signed the authorization
     * @param nonce The authorization nonce
     * @return true if the nonce has been used
     */
    function authorizationState(address authorizer, bytes32 nonce) external view returns (bool) {
        return _authorizationStates[authorizer][nonce];
    }

    /**
     * @notice Execute a transfer with a signed authorization (EIP-3009).
     * @dev Anyone can call this (typically the facilitator). The transfer is
     *      authorized by the `from` address via an EIP-712 signature.
     *
     * @param from     Payer address (must have signed the authorization)
     * @param to       Recipient address
     * @param value    Transfer amount
     * @param validAfter  Unix timestamp — authorization is valid after this time
     * @param validBefore Unix timestamp — authorization expires at this time
     * @param nonce    Unique nonce (bytes32) — can only be used once per authorizer
     * @param v        Signature v component
     * @param r        Signature r component
     * @param s        Signature s component
     */
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
    ) external {
        require(block.timestamp > validAfter, "Authorization not yet valid");
        require(block.timestamp < validBefore, "Authorization expired");
        require(!_authorizationStates[from][nonce], "Authorization already used");

        // Verify EIP-712 signature
        bytes32 structHash = keccak256(
            abi.encode(
                TRANSFER_WITH_AUTHORIZATION_TYPEHASH,
                from,
                to,
                value,
                validAfter,
                validBefore,
                nonce
            )
        );

        bytes32 digest = _hashTypedDataV4(structHash);
        address signer = ECDSA.recover(digest, v, r, s);
        require(signer == from, "Invalid signature");

        // Mark nonce as used
        _authorizationStates[from][nonce] = true;
        emit AuthorizationUsed(from, nonce);

        // Execute transfer
        _transfer(from, to, value);
    }

    /**
     * @notice Returns the EIP-712 domain separator.
     */
    function DOMAIN_SEPARATOR() external view returns (bytes32) {
        return _domainSeparatorV4();
    }
}
