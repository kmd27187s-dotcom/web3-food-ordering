const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("VotingSystem", function () {
  let voting, owner, user1, user2;
  const COST = ethers.parseEther("0.001");

  beforeEach(async function () {
    [owner, user1, user2] = await ethers.getSigners();
    const VotingSystem = await ethers.getContractFactory("VotingSystem");
    voting = await VotingSystem.deploy();
  });

  describe("createProposal", function () {
    it("should create a proposal with valid params", async function () {
      await voting
        .connect(user1)
        .createProposal("Title", "Desc", 60, { value: COST });

      const p = await voting.getProposal(0);
      expect(p.title).to.equal("Title");
      expect(p.description).to.equal("Desc");
      expect(p.creator).to.equal(user1.address);
      expect(p.yesVotes).to.equal(0);
      expect(p.noVotes).to.equal(0);
      expect(p.exists).to.be.true;
    });

    it("should increment proposalCount", async function () {
      await voting
        .connect(user1)
        .createProposal("A", "B", 10, { value: COST });
      await voting
        .connect(user2)
        .createProposal("C", "D", 10, { value: COST });
      expect(await voting.proposalCount()).to.equal(2);
    });

    it("should revert if ETH is insufficient", async function () {
      await expect(
        voting.connect(user1).createProposal("T", "D", 60, {
          value: ethers.parseEther("0.0001"),
        })
      ).to.be.revertedWith("Need 0.001 ETH to create proposal");
    });

    it("should revert if title is empty", async function () {
      await expect(
        voting.connect(user1).createProposal("", "D", 60, { value: COST })
      ).to.be.revertedWith("Title cannot be empty");
    });

    it("should revert if duration is 0", async function () {
      await expect(
        voting.connect(user1).createProposal("T", "D", 0, { value: COST })
      ).to.be.revertedWith("Duration must be > 0");
    });

    it("should emit ProposalCreated event", async function () {
      await expect(
        voting.connect(user1).createProposal("T", "D", 60, { value: COST })
      ).to.emit(voting, "ProposalCreated");
    });
  });

  // TODO: 實作 vote 測試
  // 完成合約的 vote() 後，取消下方測試的註解並確認通過
  describe("vote", function () {
    beforeEach(async function () {
      await voting
        .connect(user1)
        .createProposal("Vote Test", "Desc", 60, { value: COST });
    });

    it("should allow voting yes", async function () {
      // TODO: 呼叫 vote(0, true)，檢查 yesVotes == 1
    });

    it("should allow voting no", async function () {
      // TODO: 呼叫 vote(0, false)，檢查 noVotes == 1
    });

    it("should mark voter as voted", async function () {
      // TODO: 投票後呼叫 hasVoted()，檢查回傳 true
    });

    it("should revert on double voting", async function () {
      // TODO: 同一地址投兩次，第二次應該 revert "Already voted"
    });

    it("should revert if proposal does not exist", async function () {
      // TODO: 對不存在的提案投票，應該 revert "Proposal does not exist"
    });

    it("should revert if voting has ended", async function () {
      // TODO: 使用 time.increase(3601) 快轉時間，投票應 revert "Voting has ended"
    });

    it("should emit Voted event", async function () {
      // TODO: 投票後檢查 emit Voted event，參數為 (0, user2.address, true)
    });
  });

  describe("getAllProposals", function () {
    it("should return all proposals", async function () {
      await voting
        .connect(user1)
        .createProposal("A", "1", 60, { value: COST });
      await voting
        .connect(user2)
        .createProposal("B", "2", 30, { value: COST });

      const all = await voting.getAllProposals();
      expect(all.length).to.equal(2);
      expect(all[0].title).to.equal("A");
      expect(all[1].title).to.equal("B");
    });

    it("should return empty array when no proposals", async function () {
      const all = await voting.getAllProposals();
      expect(all.length).to.equal(0);
    });
  });

  // TODO: 實作 withdraw 測試
  // 完成合約的 withdraw() 後，取消下方測試的註解並確認通過
  describe("withdraw", function () {
    beforeEach(async function () {
      await voting
        .connect(user1)
        .createProposal("Fund", "D", 60, { value: COST });
    });

    it("should allow owner to withdraw", async function () {
      // TODO: owner 呼叫 withdraw()，檢查餘額正確轉出
    });

    it("should revert if non-owner calls", async function () {
      // TODO: 非 owner 呼叫 withdraw()，應該 revert "Not owner"
    });
  });
});
