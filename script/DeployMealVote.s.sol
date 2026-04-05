// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "../contract/VotingSystem-v3.sol";

interface Vm {
    function envAddress(string calldata name) external returns (address value);
    function envUint(string calldata name) external returns (uint256 value);
    function envOr(string calldata name, address defaultValue) external returns (address value);
    function envOr(string calldata name, uint256 defaultValue) external returns (uint256 value);
    function projectRoot() external view returns (string memory);
    function writeFile(string calldata path, string calldata data) external;
    function toString(address value) external pure returns (string memory);
    function toString(uint256 value) external pure returns (string memory);
    function startBroadcast(uint256 privateKey) external;
    function stopBroadcast() external;
}

contract DeployMealVote {
    Vm internal constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));

    function run() external returns (MembershipToken token, VotingSystem votingSystem) {
        address platformMainWallet = vm.envAddress("PLATFORM_MAIN_WALLET");
        address backendSignerAddress = vm.envAddress("BACKEND_SIGNER_ADDRESS");
        uint256 deployerPrivateKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address mintTo = vm.envOr("MEMBERSHIP_MINT_TO", platformMainWallet);
        uint256 mintAmount = vm.envOr("MEMBERSHIP_MINT_AMOUNT", uint256(1_000_000));

        vm.startBroadcast(deployerPrivateKey);

        token = new MembershipToken();
        votingSystem = new VotingSystem(address(token), backendSignerAddress, platformMainWallet);
        token.mint(mintTo, mintAmount * 1 ether);

        vm.stopBroadcast();

        string memory networkName = chainName(block.chainid);
        string memory deploymentJson = deploymentDocument(networkName, token, votingSystem, platformMainWallet, backendSignerAddress, mintTo, mintAmount);
        string memory root = vm.projectRoot();

        vm.writeFile(
            string.concat(root, "/deployments/", networkName, ".json"),
            deploymentJson
        );
        vm.writeFile(
            string.concat(root, "/backend/.env.deployment"),
            backendEnvDocument(token, votingSystem, platformMainWallet)
        );
    }

    function chainName(uint256 chainId) internal pure returns (string memory) {
        if (chainId == 11155111) return "sepolia";
        return string.concat("chain-", uintToString(chainId));
    }

    function deploymentDocument(
        string memory networkName,
        MembershipToken token,
        VotingSystem votingSystem,
        address platformMainWallet,
        address backendSignerAddress,
        address mintTo,
        uint256 mintAmount
    ) internal view returns (string memory) {
        return string.concat(
            "{\n",
            '  "network": "', networkName, '",\n',
            '  "chainId": ', uintToString(block.chainid), ",\n",
            '  "contracts": {\n',
            '    "membershipToken": "', vm.toString(address(token)), '",\n',
            '    "votingSystem": "', vm.toString(address(votingSystem)), '"\n',
            "  },\n",
            '  "config": {\n',
            '    "platformMainWallet": "', vm.toString(platformMainWallet), '",\n',
            '    "backendSignerAddress": "', vm.toString(backendSignerAddress), '",\n',
            '    "mintTo": "', vm.toString(mintTo), '",\n',
            '    "mintAmount": "', uintToString(mintAmount), '"\n',
            "  }\n",
            "}\n"
        );
    }

    function backendEnvDocument(
        MembershipToken token,
        VotingSystem votingSystem,
        address platformMainWallet
    ) internal view returns (string memory) {
        return string.concat(
            "CHAIN_ID=", uintToString(block.chainid), "\n",
            "ORDER_CONTRACT_ADDRESS=", vm.toString(address(votingSystem)), "\n",
            "MEMBERSHIP_TOKEN_ADDRESS=", vm.toString(address(token)), "\n",
            "PLATFORM_TREASURY_ADDRESS=", vm.toString(platformMainWallet), "\n"
        );
    }

    function uintToString(uint256 value) internal pure returns (string memory) {
        if (value == 0) {
            return "0";
        }

        uint256 temp = value;
        uint256 digits;
        while (temp != 0) {
            digits++;
            temp /= 10;
        }

        bytes memory buffer = new bytes(digits);
        while (value != 0) {
            digits -= 1;
            buffer[digits] = bytes1(uint8(48 + uint256(value % 10)));
            value /= 10;
        }
        return string(buffer);
    }
}
