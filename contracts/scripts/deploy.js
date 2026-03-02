const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const VotingSystem = await hre.ethers.getContractFactory("VotingSystem");
  const voting = await VotingSystem.deploy();
  await voting.waitForDeployment();

  const address = await voting.getAddress();
  console.log("VotingSystem deployed to:", address);

  const deployInfo = {
    address: address,
    network: hre.network.name,
    deployedAt: new Date().toISOString(),
  };

  const outDir = path.join(__dirname, "..", "deployments");
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }
  fs.writeFileSync(
    path.join(outDir, `${hre.network.name}.json`),
    JSON.stringify(deployInfo, null, 2)
  );
  console.log(`Deployment info saved to deployments/${hre.network.name}.json`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
