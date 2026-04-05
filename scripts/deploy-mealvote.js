import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { ethers, network } from "hardhat";

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env: ${name}`);
  }
  return value;
}

function toTokenUnits(amount) {
  return ethers.parseUnits(String(amount), 18);
}

async function main() {
  const platformMainWallet = requiredEnv("PLATFORM_MAIN_WALLET");
  const backendSignerAddress = requiredEnv("BACKEND_SIGNER_ADDRESS");
  const mintTo = process.env.MEMBERSHIP_MINT_TO || platformMainWallet;
  const mintAmount = process.env.MEMBERSHIP_MINT_AMOUNT || "1000000";

  const [deployer] = await ethers.getSigners();
  console.log(`Deploying with ${deployer.address} on ${network.name}`);

  const membershipTokenFactory = await ethers.getContractFactory("MembershipToken");
  const membershipToken = await membershipTokenFactory.deploy();
  await membershipToken.waitForDeployment();
  console.log(`MembershipToken: ${await membershipToken.getAddress()}`);

  const votingSystemFactory = await ethers.getContractFactory("VotingSystem");
  const votingSystem = await votingSystemFactory.deploy(
    await membershipToken.getAddress(),
    backendSignerAddress,
    platformMainWallet
  );
  await votingSystem.waitForDeployment();
  console.log(`VotingSystem: ${await votingSystem.getAddress()}`);

  const mintTx = await membershipToken.mint(mintTo, toTokenUnits(mintAmount));
  await mintTx.wait();
  console.log(`Minted ${mintAmount} MEAL to ${mintTo}`);

  const deployment = {
    network: network.name,
    chainId: Number((await ethers.provider.getNetwork()).chainId),
    deployedAt: new Date().toISOString(),
    deployer: deployer.address,
    contracts: {
      membershipToken: await membershipToken.getAddress(),
      votingSystem: await votingSystem.getAddress()
    },
    config: {
      platformMainWallet,
      backendSignerAddress,
      mintTo,
      mintAmount
    }
  };

  const deploymentsDir = path.resolve("deployments");
  fs.mkdirSync(deploymentsDir, { recursive: true });
  const outputPath = path.join(deploymentsDir, `${network.name}.json`);
  fs.writeFileSync(outputPath, `${JSON.stringify(deployment, null, 2)}\n`);
  console.log(`Deployment written to ${outputPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
