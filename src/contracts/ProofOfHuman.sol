// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {SelfVerificationRoot} from "@selfxyz/contracts/contracts/abstract/SelfVerificationRoot.sol";
import {ISelfVerificationRoot} from "@selfxyz/contracts/contracts/interfaces/ISelfVerificationRoot.sol";
import {SelfStructs} from "@selfxyz/contracts/contracts/libraries/SelfStructs.sol";
import {SelfUtils} from "@selfxyz/contracts/contracts/libraries/SelfUtils.sol";
import {IIdentityVerificationHubV2} from "@selfxyz/contracts/contracts/interfaces/IIdentityVerificationHubV2.sol";

/// @title ProofOfHuman
/// @notice Requires a verified proof that the user is at least 18,
///         not on the OFAC list, and optionally stores that they passed.
contract ProofOfHuman is SelfVerificationRoot {
    // ---------------------------------
    // Config
    // ---------------------------------
    /// @notice The formatted verification configuration stored in this contract
    SelfStructs.VerificationConfigV2 public verificationConfig;

    /// @notice The hash/id returned by the Hub for this configuration
    bytes32 public verificationConfigId;

    // ---------------------------------
    // Persistent verification state
    // ---------------------------------
    /// @notice Tracks which addresses have successfully verified at least once
    mapping(address => bool) public verifiedUsers;

    /// @dev Emitted whenever a user successfully verifies
    event VerificationCompleted(
        address indexed user,
        ISelfVerificationRoot.GenericDiscloseOutputV2 output,
        bytes userData
    );

    /// @param hubV2      Address of Self’s IdentityVerificationHubV2 on the target chain
    /// @param scopeSeed  A short seed string for deriving scope (e.g. "proof-of-human")
    /// @param rawCfg     The unformatted config (age, OFAC, etc.)
    constructor(
        address hubV2,
        string memory scopeSeed,
        SelfUtils.UnformattedVerificationConfigV2 memory rawCfg
    )
        SelfVerificationRoot(hubV2, scopeSeed)    // set hub + scope
    {
        // Format and store config
        verificationConfig = SelfUtils.formatVerificationConfigV2(rawCfg);

        // Register config with the hub to obtain configId
        verificationConfigId =
            IIdentityVerificationHubV2(hubV2).setVerificationConfigV2(verificationConfig);
    }

    /// @dev Called by the hub after a successful proof.
    ///      This is where we persist the fact that the user is verified.
    function customVerificationHook(
        ISelfVerificationRoot.GenericDiscloseOutputV2 memory output,
        bytes memory userData
    ) internal override {
        // Mark the caller as verified
        verifiedUsers[address(uint160(uint256(output.userIdentifier)))] = true;

        emit VerificationCompleted(msg.sender, output, userData);
    }

    /// @dev Returns the verificationConfigId to the hub
    function getConfigId(
        bytes32 /*destinationChainId*/,
        bytes32 /*userIdentifier*/,
        bytes memory /*userDefinedData*/
    ) public view override returns (bytes32) {
        return verificationConfigId;
    }

    /// @notice Simple view helper for dapps
    function isVerified(address user) external view returns (bool) {
        return verifiedUsers[user];
    }
}
