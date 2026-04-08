// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "../contract/MealVoteGovernance.sol";
import "../contract/MealVoteOrderEscrow.sol";

interface Vm {
    function envAddress(string calldata name) external returns (address value);
    function envUint(string calldata name) external returns (uint256 value);
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

    function run() external returns (MealVoteGovernance governance, MealVoteOrderEscrow escrow) {
        address platformWallet = vm.envAddress("PLATFORM_MAIN_WALLET");
        uint256 deployerPrivateKey = vm.envUint("DEPLOYER_PRIVATE_KEY");

        MealVoteGovernance.GovernanceParams memory governanceParams = MealVoteGovernance.GovernanceParams({
            createFeeWei: vm.envOr("CREATE_FEE_WEI", uint256(1000000000000000)),
            proposalFeeWei: vm.envOr("PROPOSAL_FEE_WEI", uint256(500000000000000)),
            voteFeeWei: vm.envOr("VOTE_FEE_WEI", uint256(200000000000000)),
            winnerProposalRefundBps: uint16(vm.envOr("WINNER_PROPOSAL_REFUND_BPS", uint256(9000))),
            loserProposalRefundBps: uint16(vm.envOr("LOSER_PROPOSAL_REFUND_BPS", uint256(8000))),
            voteRefundBps: uint16(vm.envOr("VOTE_REFUND_BPS", uint256(5000))),
            winnerBonusBps: uint16(vm.envOr("WINNER_BONUS_BPS", uint256(1000))),
            loserBonusBps: uint16(vm.envOr("LOSER_BONUS_BPS", uint256(500))),
            winnerProposalPoints: uint16(vm.envOr("WINNER_PROPOSAL_POINTS", uint256(5))),
            winnerVotePointsPerVote: uint16(vm.envOr("WINNER_VOTE_POINTS_PER_VOTE", uint256(2))),
            proposalDurationMinutes: uint32(vm.envOr("PROPOSAL_DURATION_MINUTES", uint256(10))),
            voteDurationMinutes: uint32(vm.envOr("VOTE_DURATION_MINUTES", uint256(10))),
            orderingDurationMinutes: uint32(vm.envOr("ORDERING_DURATION_MINUTES", uint256(10))),
            dailyCreateCouponCount: uint16(vm.envOr("DAILY_CREATE_COUPON_COUNT", uint256(1))),
            dailyProposalCouponCount: uint16(vm.envOr("DAILY_PROPOSAL_COUPON_COUNT", uint256(1))),
            dailyVoteCouponCount: uint16(vm.envOr("DAILY_VOTE_COUPON_COUNT", uint256(1))),
            governanceClaimTimeoutMins: uint32(vm.envOr("GOVERNANCE_CLAIM_TIMEOUT_MINS", uint256(43200)))
        });

        MealVoteOrderEscrow.EscrowParams memory escrowParams = MealVoteOrderEscrow.EscrowParams({
            platformEscrowFeeBps: uint16(vm.envOr("PLATFORM_ESCROW_FEE_BPS", uint256(0))),
            merchantAcceptTimeoutMins: uint32(vm.envOr("MERCHANT_ACCEPT_TIMEOUT_MINS", uint256(1440))),
            merchantCompleteTimeoutMins: uint32(vm.envOr("MERCHANT_COMPLETE_TIMEOUT_MINS", uint256(10080))),
            memberConfirmTimeoutMins: uint32(vm.envOr("MEMBER_CONFIRM_TIMEOUT_MINS", uint256(10080))),
            escrowClaimTimeoutMins: uint32(vm.envOr("ESCROW_CLAIM_TIMEOUT_MINS", uint256(43200)))
        });

        vm.startBroadcast(deployerPrivateKey);
        governance = new MealVoteGovernance(platformWallet, governanceParams);
        escrow = new MealVoteOrderEscrow(platformWallet, escrowParams);
        vm.stopBroadcast();

        string memory networkName = chainName(block.chainid);
        string memory root = vm.projectRoot();
        vm.writeFile(
            string.concat(root, "/deployments/", networkName, ".json"),
            deploymentDocument(networkName, governance, escrow, platformWallet, governanceParams, escrowParams)
        );
        vm.writeFile(
            string.concat(root, "/backend/.env.deployment"),
            backendEnvDocument(governance, escrow, platformWallet)
        );
    }

    function chainName(uint256 chainId) internal pure returns (string memory) {
        if (chainId == 11155111) return "sepolia";
        return string.concat("chain-", uintToString(chainId));
    }

    function deploymentDocument(
        string memory networkName,
        MealVoteGovernance governance,
        MealVoteOrderEscrow escrow,
        address platformWallet,
        MealVoteGovernance.GovernanceParams memory governanceParams,
        MealVoteOrderEscrow.EscrowParams memory escrowParams
    ) internal view returns (string memory) {
        return string.concat(
            "{\n",
            '  "network": "', networkName, '",\n',
            '  "chainId": ', uintToString(block.chainid), ",\n",
            '  "contracts": {\n',
            '    "governance": "', vm.toString(address(governance)), '",\n',
            '    "orderEscrow": "', vm.toString(address(escrow)), '"\n',
            "  },\n",
            '  "platformWallet": "', vm.toString(platformWallet), '",\n',
            '  "governanceParams": {\n',
            '    "createFeeWei": "', uintToString(governanceParams.createFeeWei), '",\n',
            '    "proposalFeeWei": "', uintToString(governanceParams.proposalFeeWei), '",\n',
            '    "voteFeeWei": "', uintToString(governanceParams.voteFeeWei), '"\n',
            "  },\n",
            '  "escrowParams": {\n',
            '    "platformEscrowFeeBps": "', uintToString(escrowParams.platformEscrowFeeBps), '",\n',
            '    "merchantAcceptTimeoutMins": "', uintToString(escrowParams.merchantAcceptTimeoutMins), '"\n',
            "  }\n",
            "}\n"
        );
    }

    function backendEnvDocument(
        MealVoteGovernance governance,
        MealVoteOrderEscrow escrow,
        address platformWallet
    ) internal view returns (string memory) {
        return string.concat(
            "CHAIN_ID=", uintToString(block.chainid), "\n",
            "GOVERNANCE_CONTRACT_ADDRESS=", vm.toString(address(governance)), "\n",
            "ORDER_ESCROW_CONTRACT_ADDRESS=", vm.toString(address(escrow)), "\n",
            "ORDER_CONTRACT_ADDRESS=", vm.toString(address(escrow)), "\n",
            "PLATFORM_TREASURY_ADDRESS=", vm.toString(platformWallet), "\n"
        );
    }

    function uintToString(uint256 value) internal pure returns (string memory) {
        if (value == 0) return "0";
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
