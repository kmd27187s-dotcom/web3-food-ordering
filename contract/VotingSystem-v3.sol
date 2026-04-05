// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IERC20Lite {
    function totalSupply() external view returns (uint256);
    function balanceOf(address account) external view returns (uint256);
    function allowance(address owner, address spender) external view returns (uint256);
    function transfer(address to, uint256 amount) external returns (bool);
    function approve(address spender, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

contract MembershipToken is IERC20Lite {
    string public constant name = "MealVote Membership Token";
    string public constant symbol = "MEAL";
    uint8 public constant decimals = 18;

    uint256 public override totalSupply;
    address public owner;

    mapping(address => uint256) public override balanceOf;
    mapping(address => mapping(address => uint256)) public override allowance;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);

    modifier onlyOwner() {
        require(msg.sender == owner, "not owner");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    function mint(address to, uint256 amount) external onlyOwner {
        totalSupply += amount;
        balanceOf[to] += amount;
        emit Transfer(address(0), to, amount);
    }

    function transfer(address to, uint256 amount) external override returns (bool) {
        _transfer(msg.sender, to, amount);
        return true;
    }

    function approve(address spender, uint256 amount) external override returns (bool) {
        allowance[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external override returns (bool) {
        uint256 allowed = allowance[from][msg.sender];
        require(allowed >= amount, "allowance too low");
        allowance[from][msg.sender] = allowed - amount;
        _transfer(from, to, amount);
        emit Approval(from, msg.sender, allowance[from][msg.sender]);
        return true;
    }

    function _transfer(address from, address to, uint256 amount) internal {
        require(to != address(0), "zero address");
        require(balanceOf[from] >= amount, "balance too low");
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        emit Transfer(from, to, amount);
    }
}

contract VotingSystem {
    uint256 public constant OPTION_TOKEN_COST = 10 ether;
    uint256 public constant SUBSCRIPTION_TOKEN_COST = 99 ether;
    uint256 public constant SUBSCRIPTION_DURATION = 30 days;
    uint256 public constant LOSER_REFUND_BPS = 4000;
    uint256 public constant WINNER_REWARD_BPS = 6000;
    uint256 public constant ORDER_FEE_BPS = 300;

    IERC20Lite public immutable membershipToken;
    address public owner;
    address public signer;
    address public platformMainWallet;
    uint256 public treasuryTokenBalance;
    uint256 public treasuryNativeBalance;

    struct Proposal {
        string title;
        string description;
        string merchantGroup;
        address creator;
        uint256 proposalDeadline;
        uint256 voteDeadline;
        uint256 orderDeadline;
        uint256 winnerOptionIndex;
        uint256 optionTokenPool;
        uint256 voteTokenPool;
        uint256 orderPool;
        bool exists;
        bool voteFinalized;
        bool settled;
    }

    struct Option {
        string merchantId;
        string merchantName;
        address proposer;
        uint256 weightedVotes;
        uint256 tokenStake;
        bool active;
    }

    struct Order {
        bool placed;
        bool cancelled;
        uint256 amount;
        bytes32 orderHash;
        string note;
    }

    struct ProposalView {
        string title;
        string description;
        string merchantGroup;
        address creator;
        uint256 proposalDeadline;
        uint256 voteDeadline;
        uint256 orderDeadline;
        uint256 winnerOptionIndex;
        uint256 optionTokenPool;
        uint256 voteTokenPool;
        uint256 orderPool;
        bool exists;
        bool voteFinalized;
        bool settled;
    }

    mapping(uint256 => Proposal) public proposals;
    mapping(uint256 => Option[]) private proposalOptions;
    mapping(uint256 => mapping(address => uint256)) public memberVoteSpend;
    mapping(uint256 => mapping(address => Order)) public orders;
    mapping(bytes32 => bool) public usedOrderDigests;
    mapping(address => uint256) public claimableRewards;
    mapping(address => uint256) public subscriptionExpiry;

    uint256 public proposalCount;

    event ProposalCreated(uint256 indexed proposalId, address indexed creator, uint256 proposalDeadline, uint256 voteDeadline, uint256 orderDeadline);
    event OptionAdded(uint256 indexed proposalId, uint256 indexed optionIndex, string merchantId, address indexed proposer, uint256 cost);
    event Voted(uint256 indexed proposalId, uint256 indexed optionIndex, address indexed voter, uint256 tokenAmount, uint256 weight);
    event VoteFinalized(uint256 indexed proposalId, uint256 indexed winnerOptionIndex, string merchantId, uint256 weightedVotes);
    event OrderPlaced(uint256 indexed proposalId, address indexed member, bytes32 orderHash, uint256 amount);
    event OrderCancelled(uint256 indexed proposalId, address indexed member, uint256 refundAmount);
    event ProposalSettled(uint256 indexed proposalId, uint256 nativeFee, uint256 nativePayout, uint256 treasuryTokenGain);
    event RewardAllocated(uint256 indexed proposalId, address indexed member, uint256 amount, string rewardType);
    event SubscriptionPaid(address indexed member, uint256 amount, uint256 expiresAt);
    event RewardClaimed(address indexed member, uint256 amount);
    event SignerUpdated(address indexed newSigner);
    event PlatformMainWalletUpdated(address indexed newWallet);

    modifier onlyOwner() {
        require(msg.sender == owner, "not owner");
        _;
    }

    constructor(address token_, address signer_, address platformMainWallet_) {
        require(token_ != address(0) && signer_ != address(0) && platformMainWallet_ != address(0), "zero address");
        owner = msg.sender;
        membershipToken = IERC20Lite(token_);
        signer = signer_;
        platformMainWallet = platformMainWallet_;
    }

    function createProposal(
        string calldata title,
        string calldata description,
        string calldata merchantGroup,
        uint256 proposalDeadline,
        uint256 voteDeadline,
        uint256 orderDeadline
    ) external returns (uint256 proposalId) {
        require(bytes(title).length > 0, "empty title");
        require(proposalDeadline > block.timestamp, "proposal deadline");
        require(voteDeadline > proposalDeadline, "vote deadline");
        require(orderDeadline > voteDeadline, "order deadline");

        proposalId = proposalCount++;
        Proposal storage p = proposals[proposalId];
        p.title = title;
        p.description = description;
        p.merchantGroup = merchantGroup;
        p.creator = msg.sender;
        p.proposalDeadline = proposalDeadline;
        p.voteDeadline = voteDeadline;
        p.orderDeadline = orderDeadline;
        p.exists = true;

        emit ProposalCreated(proposalId, msg.sender, proposalDeadline, voteDeadline, orderDeadline);
    }

    function subscribeMonthly() external {
        require(membershipToken.transferFrom(msg.sender, address(this), SUBSCRIPTION_TOKEN_COST), "token transfer failed");

        uint256 base = subscriptionExpiry[msg.sender];
        if (base < block.timestamp) {
            base = block.timestamp;
        }
        uint256 expiresAt = base + SUBSCRIPTION_DURATION;
        subscriptionExpiry[msg.sender] = expiresAt;
        treasuryTokenBalance += SUBSCRIPTION_TOKEN_COST;

        emit SubscriptionPaid(msg.sender, SUBSCRIPTION_TOKEN_COST, expiresAt);
    }

    function addOption(uint256 proposalId, string calldata merchantId, string calldata merchantName) external {
        Proposal storage p = proposals[proposalId];
        require(p.exists, "proposal missing");
        require(block.timestamp <= p.proposalDeadline, "proposal window closed");
        require(!p.voteFinalized, "vote finalized");
        require(bytes(merchantId).length > 0, "merchant missing");
        require(membershipToken.transferFrom(msg.sender, address(this), OPTION_TOKEN_COST), "token transfer failed");

        proposalOptions[proposalId].push(Option({
            merchantId: merchantId,
            merchantName: merchantName,
            proposer: msg.sender,
            weightedVotes: 0,
            tokenStake: OPTION_TOKEN_COST,
            active: true
        }));
        p.optionTokenPool += OPTION_TOKEN_COST;

        emit OptionAdded(proposalId, proposalOptions[proposalId].length - 1, merchantId, msg.sender, OPTION_TOKEN_COST);
    }

    function vote(uint256 proposalId, uint256 optionIndex, uint256 tokenAmount) external {
        Proposal storage p = proposals[proposalId];
        require(p.exists, "proposal missing");
        require(block.timestamp > p.proposalDeadline, "proposal still active");
        require(block.timestamp <= p.voteDeadline, "vote window closed");
        require(tokenAmount > 0, "token amount");
        require(optionIndex < proposalOptions[proposalId].length, "option missing");
        Option storage option = proposalOptions[proposalId][optionIndex];
        require(option.active, "option inactive");
        require(membershipToken.transferFrom(msg.sender, address(this), tokenAmount), "token transfer failed");

        memberVoteSpend[proposalId][msg.sender] += tokenAmount;
        option.weightedVotes += tokenAmount;
        p.voteTokenPool += tokenAmount;

        emit Voted(proposalId, optionIndex, msg.sender, tokenAmount, tokenAmount);
    }

    function finalizeVote(uint256 proposalId) public {
        Proposal storage p = proposals[proposalId];
        require(p.exists, "proposal missing");
        require(block.timestamp > p.voteDeadline, "vote window open");
        require(!p.voteFinalized, "already finalized");
        require(proposalOptions[proposalId].length > 0, "no options");

        uint256 winnerIndex = _winnerIndex(proposalId);
        p.voteFinalized = true;
        p.winnerOptionIndex = winnerIndex;

        Option storage winner = proposalOptions[proposalId][winnerIndex];
        emit VoteFinalized(proposalId, winnerIndex, winner.merchantId, winner.weightedVotes);
    }

    function placeOrder(
        uint256 proposalId,
        bytes32 orderHash,
        string calldata note,
        uint256 amount,
        uint256 expiry,
        bytes calldata sig
    ) external payable {
        Proposal storage p = proposals[proposalId];
        require(p.exists, "proposal missing");
        require(p.voteFinalized, "winner not finalized");
        require(block.timestamp > p.voteDeadline, "vote still active");
        require(block.timestamp <= p.orderDeadline, "order window closed");
        require(!p.settled, "proposal settled");
        require(msg.value == amount, "incorrect value");
        require(block.timestamp <= expiry, "signature expired");

        bytes32 digest = keccak256(abi.encode(
            proposalId,
            msg.sender,
            orderHash,
            amount,
            expiry,
            address(this),
            block.chainid
        ));
        require(!usedOrderDigests[digest], "signature used");

        bytes32 ethSigned = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", digest));
        require(_recover(ethSigned, sig) == signer, "invalid signer");

        usedOrderDigests[digest] = true;

        Order storage existing = orders[proposalId][msg.sender];
        require(!existing.placed || existing.cancelled, "active order exists");
        if (existing.cancelled && existing.amount > 0) {
            p.orderPool -= existing.amount;
        }

        orders[proposalId][msg.sender] = Order({
            placed: true,
            cancelled: false,
            amount: amount,
            orderHash: orderHash,
            note: note
        });
        p.orderPool += amount;

        emit OrderPlaced(proposalId, msg.sender, orderHash, amount);
    }

    function cancelOrder(uint256 proposalId) external {
        Proposal storage p = proposals[proposalId];
        require(p.exists, "proposal missing");
        require(block.timestamp <= p.orderDeadline, "order window closed");

        Order storage order = orders[proposalId][msg.sender];
        require(order.placed && !order.cancelled, "order missing");
        order.cancelled = true;
        p.orderPool -= order.amount;

        (bool ok,) = msg.sender.call{value: order.amount}("");
        require(ok, "refund failed");

        emit OrderCancelled(proposalId, msg.sender, order.amount);
    }

    function settleProposal(uint256 proposalId) external {
        Proposal storage p = proposals[proposalId];
        require(p.exists, "proposal missing");
        require(block.timestamp > p.orderDeadline, "order window open");
        require(!p.settled, "already settled");
        if (!p.voteFinalized) {
            finalizeVote(proposalId);
        }
        p.settled = true;

        uint256 fee = p.orderPool * ORDER_FEE_BPS / 10000;
        uint256 payout = p.orderPool - fee;
        treasuryNativeBalance += fee;
        if (payout > 0) {
            (bool ok,) = platformMainWallet.call{value: payout}("");
            require(ok, "platform payout failed");
        }

        uint256 treasuryGain = p.voteTokenPool;
        uint256 optionDistributed = 0;
        for (uint256 i = 0; i < proposalOptions[proposalId].length; i++) {
            Option storage option = proposalOptions[proposalId][i];
            if (i == p.winnerOptionIndex) {
                uint256 reward = option.tokenStake * WINNER_REWARD_BPS / 10000;
                claimableRewards[option.proposer] += reward;
                optionDistributed += reward;
                emit RewardAllocated(proposalId, option.proposer, reward, "winner_proposer");
            } else {
                uint256 refund = option.tokenStake * LOSER_REFUND_BPS / 10000;
                claimableRewards[option.proposer] += refund;
                optionDistributed += refund;
                emit RewardAllocated(proposalId, option.proposer, refund, "loser_refund");
            }
        }

        if (p.optionTokenPool > optionDistributed) {
            treasuryGain += (p.optionTokenPool - optionDistributed);
        }
        treasuryTokenBalance += treasuryGain;
        emit ProposalSettled(proposalId, fee, payout, treasuryGain);
    }

    function claimReward() external {
        uint256 amount = claimableRewards[msg.sender];
        require(amount > 0, "no reward");
        claimableRewards[msg.sender] = 0;
        require(membershipToken.transfer(msg.sender, amount), "reward transfer failed");
        emit RewardClaimed(msg.sender, amount);
    }

    function withdrawTreasuryTokens(address to, uint256 amount) external onlyOwner {
        require(to != address(0), "zero address");
        require(amount <= treasuryTokenBalance, "amount too high");
        treasuryTokenBalance -= amount;
        require(membershipToken.transfer(to, amount), "token transfer failed");
    }

    function withdrawTreasuryNative(address to, uint256 amount) external onlyOwner {
        require(to != address(0), "zero address");
        require(amount <= treasuryNativeBalance, "amount too high");
        treasuryNativeBalance -= amount;
        (bool ok,) = to.call{value: amount}("");
        require(ok, "native transfer failed");
    }

    function setSigner(address newSigner) external onlyOwner {
        require(newSigner != address(0), "zero signer");
        signer = newSigner;
        emit SignerUpdated(newSigner);
    }

    function setPlatformMainWallet(address newWallet) external onlyOwner {
        require(newWallet != address(0), "zero wallet");
        platformMainWallet = newWallet;
        emit PlatformMainWalletUpdated(newWallet);
    }

    function getProposal(uint256 proposalId) external view returns (ProposalView memory viewData, Option[] memory options) {
        Proposal storage p = proposals[proposalId];
        require(p.exists, "proposal missing");
        viewData = ProposalView({
            title: p.title,
            description: p.description,
            merchantGroup: p.merchantGroup,
            creator: p.creator,
            proposalDeadline: p.proposalDeadline,
            voteDeadline: p.voteDeadline,
            orderDeadline: p.orderDeadline,
            winnerOptionIndex: p.winnerOptionIndex,
            optionTokenPool: p.optionTokenPool,
            voteTokenPool: p.voteTokenPool,
            orderPool: p.orderPool,
            exists: p.exists,
            voteFinalized: p.voteFinalized,
            settled: p.settled
        });
        options = proposalOptions[proposalId];
    }

    function getOrder(uint256 proposalId, address member) external view returns (Order memory) {
        return orders[proposalId][member];
    }

    function getOptionCount(uint256 proposalId) external view returns (uint256) {
        return proposalOptions[proposalId].length;
    }

    function _winnerIndex(uint256 proposalId) internal view returns (uint256) {
        uint256 maxVotes = 0;
        uint256 maxIndex = 0;
        for (uint256 i = 0; i < proposalOptions[proposalId].length; i++) {
            if (proposalOptions[proposalId][i].weightedVotes > maxVotes) {
                maxVotes = proposalOptions[proposalId][i].weightedVotes;
                maxIndex = i;
            }
        }
        return maxIndex;
    }

    function _recover(bytes32 digest, bytes calldata sig) internal pure returns (address) {
        require(sig.length == 65, "bad signature length");
        bytes32 r;
        bytes32 s;
        uint8 v;
        assembly {
            r := calldataload(sig.offset)
            s := calldataload(add(sig.offset, 32))
            v := byte(0, calldataload(add(sig.offset, 64)))
        }
        if (v < 27) {
            v += 27;
        }
        return ecrecover(digest, v, r, s);
    }
}
