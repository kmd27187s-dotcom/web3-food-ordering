// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract VotingSystem {

    struct Proposal {
        string title;
        string description;
        address creator;
        uint256 yesVotes;
        uint256 noVotes;
        uint256 deadline;
        bool exists;
    }

    mapping(uint256 => Proposal) public proposals;
    mapping(uint256 => mapping(address => bool)) public voted;
    uint256 public proposalCount;
    address public owner;

    event ProposalCreated(
        uint256 indexed proposalId,
        address indexed creator,
        string title,
        uint256 deadline
    );

    event Voted(
        uint256 indexed proposalId,
        address indexed voter,
        bool support
    );

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    function createProposal(
        string memory title,
        string memory description,
        uint256 durationInMinutes
    ) public payable {
        require(msg.value >= 0.001 ether, "Need 0.001 ETH to create proposal");
        require(bytes(title).length > 0, "Title cannot be empty");
        require(durationInMinutes > 0, "Duration must be > 0");

        uint256 id = proposalCount;
        proposals[id] = Proposal({
            title: title,
            description: description,
            creator: msg.sender,
            yesVotes: 0,
            noVotes: 0,
            deadline: block.timestamp + (durationInMinutes * 1 minutes),
            exists: true
        });

        proposalCount++;
        emit ProposalCreated(id, msg.sender, title, proposals[id].deadline);
    }

    // TODO: 實作投票功能
    // 需求：
    //   1. 提案必須存在 (exists == true)
    //   2. 投票時間必須在 deadline 之前
    //   3. 同一地址對同一提案只能投一次（用 voted mapping 記錄）
    //   4. support == true 則 yesVotes++，false 則 noVotes++
    //   5. emit Voted event
    function vote(uint256 proposalId, bool support) public {
        // 請在這裡實作
        revert("Not implemented yet");
    }

    function getProposal(uint256 proposalId) public view returns (Proposal memory) {
        require(proposals[proposalId].exists, "Proposal does not exist");
        return proposals[proposalId];
    }

    function getAllProposals() public view returns (Proposal[] memory) {
        Proposal[] memory allProposals = new Proposal[](proposalCount);
        for (uint256 i = 0; i < proposalCount; i++) {
            allProposals[i] = proposals[i];
        }
        return allProposals;
    }

    function hasVoted(uint256 proposalId, address voter) public view returns (bool) {
        return voted[proposalId][voter];
    }

    // TODO: 實作提款功能
    // 需求：
    //   1. 只有 owner 可以呼叫（使用 onlyOwner modifier）
    //   2. 將合約所有餘額轉給 owner
    function withdraw() public {
        // 請在這裡實作
        revert("Not implemented yet");
    }
}
