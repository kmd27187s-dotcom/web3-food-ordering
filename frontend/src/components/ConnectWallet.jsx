import { useMemo } from "react";

const CHAIN_NAMES = {
  1: "Ethereum Mainnet",
  11155111: "Sepolia",
  31337: "Hardhat Local",
};

export default function ConnectWallet({ account, chainId, onConnect }) {
  const chainName = useMemo(
    () => CHAIN_NAMES[chainId] || `Chain ${chainId}`,
    [chainId]
  );

  if (!account) {
    return (
      <button className="btn connect-btn" onClick={onConnect}>
        Connect Wallet
      </button>
    );
  }

  return (
    <div className="wallet-info">
      <span className="chain-badge">{chainName}</span>
      <span className="address">
        {account.slice(0, 6)}...{account.slice(-4)}
      </span>
    </div>
  );
}
