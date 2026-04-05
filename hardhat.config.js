import "dotenv/config";
import "@nomicfoundation/hardhat-ethers";

const accounts = process.env.DEPLOYER_PRIVATE_KEY ? [process.env.DEPLOYER_PRIVATE_KEY] : [];

export default {
  solidity: {
    version: "0.8.24",
    settings: {
      viaIR: true,
      optimizer: {
        enabled: true,
        runs: 200
      }
    }
  },
  paths: {
    sources: "./contract",
    cache: "./.hardhat/cache",
    artifacts: "./.hardhat/artifacts"
  },
  networks: {
    sepolia: {
      url: process.env.SEPOLIA_RPC_URL || "",
      accounts
    }
  }
};
