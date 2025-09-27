// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import "forge-std/Script.sol";
import {ProofOfHuman} from "../src/contracts/ProofOfHuman.sol";
import {SelfUtils} from "@selfxyz/contracts/contracts/libraries/SelfUtils.sol";

contract Deploy is Script {
    // Celo Sepolia hub for testing
    address constant HUB_CELO_SEPOLIA = 0x16ECBA51e18a4a7e61fdC417f0d47AFEeDfbed74;

    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");

        // Build rules: require 18+, enable OFAC, no country exclusions
        SelfUtils.UnformattedVerificationConfigV2 memory rawCfg =
            SelfUtils.UnformattedVerificationConfigV2({
                olderThan: 18,
                forbiddenCountries: new string[](1), // <-- fixed here
                ofacEnabled: true
            });

        rawCfg.forbiddenCountries[0] = "USA";

        vm.startBroadcast(pk);
        ProofOfHuman c = new ProofOfHuman(
            HUB_CELO_SEPOLIA,
            "proof-of-human-nomis",
            rawCfg
        );
        vm.stopBroadcast();

        console2.log("Deployed at:", address(c));
        console2.logBytes32(c.verificationConfigId());
        console2.logUint(c.scope());
    }
}
