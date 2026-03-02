import { useState, useEffect, useCallback } from "react";
import { ethers } from "ethers";
import ABI from "./abi/VotingSystem.json";
import ConnectWallet from "./components/ConnectWallet";
import CreateProposal from "./components/CreateProposal";
import ProposalCard from "./components/ProposalCard";

const CONTRACT_ADDRESS = import.meta.env.VITE_CONTRACT_ADDRESS || "";
const HARDHAT_CHAIN_ID = 31337;
const SEPOLIA_CHAIN_ID = 11155111;
const ALLOWED_CHAINS = [HARDHAT_CHAIN_ID, SEPOLIA_CHAIN_ID];

function getExplorerUrl(chainId) {
  if (chainId === SEPOLIA_CHAIN_ID) return "https://sepolia.etherscan.io";
  return null;
}

export default function App() {
  const [account, setAccount] = useState(null);
  const [chainId, setChainId] = useState(null);
  const [contract, setContract] = useState(null);
  const [proposals, setProposals] = useState([]);
  const [contractBalance, setContractBalance] = useState("0");
  const [loading, setLoading] = useState(false);
  const [txHash, setTxHash] = useState(null);

  const wrongNetwork = chainId && !ALLOWED_CHAINS.includes(chainId);
  const explorerUrl = getExplorerUrl(chainId);

  const loadProposals = useCallback(async (ctr) => {
    try {
      const all = await ctr.getAllProposals();
      const parsed = all.map((p, i) => ({
        id: i,
        title: p.title,
        description: p.description,
        creator: p.creator,
        yesVotes: Number(p.yesVotes),
        noVotes: Number(p.noVotes),
        deadline: Number(p.deadline),
        exists: p.exists,
      }));
      setProposals(parsed);
    } catch (err) {
      console.error("loadProposals:", err);
    }
  }, []);

  const loadBalance = useCallback(async (provider, addr) => {
    try {
      const bal = await provider.getBalance(addr);
      setContractBalance(ethers.formatEther(bal));
    } catch (err) {
      console.error("loadBalance:", err);
    }
  }, []);

  const connectWallet = useCallback(async () => {
    if (!window.ethereum) {
      alert("Please install MetaMask");
      return;
    }

    const provider = new ethers.BrowserProvider(window.ethereum);
    const accounts = await provider.send("eth_requestAccounts", []);
    const signer = await provider.getSigner();
    const network = await provider.getNetwork();
    const cid = Number(network.chainId);

    setAccount(accounts[0]);
    setChainId(cid);

    if (ALLOWED_CHAINS.includes(cid) && CONTRACT_ADDRESS) {
      const ctr = new ethers.Contract(CONTRACT_ADDRESS, ABI, signer);
      setContract(ctr);
      await loadProposals(ctr);
      await loadBalance(provider, CONTRACT_ADDRESS);
    }
  }, [loadProposals, loadBalance]);

  useEffect(() => {
    if (!window.ethereum) return;

    const handleAccountsChanged = (accounts) => {
      if (accounts.length === 0) {
        setAccount(null);
        setContract(null);
      } else {
        connectWallet();
      }
    };

    const handleChainChanged = () => {
      window.location.reload();
    };

    window.ethereum.on("accountsChanged", handleAccountsChanged);
    window.ethereum.on("chainChanged", handleChainChanged);

    return () => {
      window.ethereum.removeListener("accountsChanged", handleAccountsChanged);
      window.ethereum.removeListener("chainChanged", handleChainChanged);
    };
  }, [connectWallet]);

  const refreshData = useCallback(async () => {
    if (!contract) return;
    await loadProposals(contract);
    const provider = new ethers.BrowserProvider(window.ethereum);
    await loadBalance(provider, CONTRACT_ADDRESS);
  }, [contract, loadProposals, loadBalance]);

  const handleCreateProposal = async (title, description, duration) => {
    if (!contract) return;
    setLoading(true);
    setTxHash(null);
    try {
      const tx = await contract.createProposal(title, description, duration, {
        value: ethers.parseEther("0.001"),
      });
      setTxHash(tx.hash);
      await tx.wait();
      await refreshData();
    } catch (err) {
      console.error("createProposal:", err);
      alert(err.reason || err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleVote = async (proposalId, support) => {
    if (!contract) return;
    setLoading(true);
    setTxHash(null);
    try {
      const tx = await contract.vote(proposalId, support);
      setTxHash(tx.hash);
      await tx.wait();
      await refreshData();
    } catch (err) {
      console.error("vote:", err);
      alert(err.reason || err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app">
      <header>
        <h1>On-chain Voting DApp</h1>
        <ConnectWallet
          account={account}
          chainId={chainId}
          onConnect={connectWallet}
        />
      </header>

      {wrongNetwork && (
        <div className="banner error">
          Please switch to Sepolia or Hardhat Local network.
        </div>
      )}

      {!CONTRACT_ADDRESS && (
        <div className="banner error">
          VITE_CONTRACT_ADDRESS not set. Create a <code>.env</code> file in
          frontend/.
        </div>
      )}

      {txHash && (
        <div className="banner success">
          Tx: {" "}
          {explorerUrl ? (
            <a href={`${explorerUrl}/tx/${txHash}`} target="_blank" rel="noreferrer">
              {txHash.slice(0, 10)}...{txHash.slice(-8)}
            </a>
          ) : (
            <code>{txHash.slice(0, 10)}...{txHash.slice(-8)}</code>
          )}
        </div>
      )}

      {loading && <div className="banner loading">Transaction pending...</div>}

      {account && !wrongNetwork && CONTRACT_ADDRESS && (
        <>
          <div className="stats">
            <span>Contract Balance: {contractBalance} ETH</span>
            <span>Proposals: {proposals.length}</span>
          </div>

          <CreateProposal onSubmit={handleCreateProposal} disabled={loading} />

          <section className="proposals">
            <h2>Proposals</h2>
            {proposals.length === 0 ? (
              <p className="empty">No proposals yet. Create the first one!</p>
            ) : (
              proposals.map((p) => (
                <ProposalCard
                  key={p.id}
                  proposal={p}
                  account={account}
                  contract={contract}
                  onVote={handleVote}
                  disabled={loading}
                />
              ))
            )}
          </section>
        </>
      )}
    </div>
  );
}
