import fs from "node:fs";
import path from "node:path";

function readLatestDeployment() {
  const deploymentsDir = path.resolve("deployments");
  if (!fs.existsSync(deploymentsDir)) {
    throw new Error("deployments directory not found");
  }
  const files = fs.readdirSync(deploymentsDir).filter((name) => name.endsWith(".json"));
  if (files.length === 0) {
    throw new Error("no deployment files found");
  }
  const latest = files
    .map((name) => ({ name, mtimeMs: fs.statSync(path.join(deploymentsDir, name)).mtimeMs }))
    .sort((a, b) => b.mtimeMs - a.mtimeMs)[0];
  return JSON.parse(fs.readFileSync(path.join(deploymentsDir, latest.name), "utf8"));
}

function writeJSON(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`);
}

function main() {
  const deployment = readLatestDeployment();

  const frontendConfig = {
    network: deployment.network,
    chainId: deployment.chainId,
    governanceContract: deployment.contracts.governance,
    orderEscrowContract: deployment.contracts.orderEscrow,
    orderContract: deployment.contracts.orderEscrow,
    platformTreasury: deployment.platformWallet
  };

  const backendEnv = [
    `CHAIN_ID=${deployment.chainId}`,
    `GOVERNANCE_CONTRACT_ADDRESS=${deployment.contracts.governance}`,
    `ORDER_ESCROW_CONTRACT_ADDRESS=${deployment.contracts.orderEscrow}`,
    `ORDER_CONTRACT_ADDRESS=${deployment.contracts.orderEscrow}`,
    `PLATFORM_TREASURY_ADDRESS=${deployment.platformWallet}`,
    `SIGNER_PRIVATE_KEY=`,
    `RPC_URL=`
  ].join("\n");

  const webEnv = [
    `NEXT_PUBLIC_API_BASE=http://localhost:8080`,
    `NEXT_PUBLIC_SEPOLIA_RPC_URL=`,
    `NEXT_PUBLIC_CHAIN_ID=${deployment.chainId}`,
    `NEXT_PUBLIC_GOVERNANCE_CONTRACT_ADDRESS=${deployment.contracts.governance}`,
    `NEXT_PUBLIC_ORDER_ESCROW_CONTRACT_ADDRESS=${deployment.contracts.orderEscrow}`,
    `NEXT_PUBLIC_ORDER_CONTRACT_ADDRESS=${deployment.contracts.orderEscrow}`,
    `NEXT_PUBLIC_PLATFORM_TREASURY_ADDRESS=${deployment.platformWallet}`
  ].join("\n");

  writeJSON(path.resolve("frontend/src/generated/contracts.json"), frontendConfig);
  writeJSON(path.resolve("apps/web/src/generated/contracts.json"), frontendConfig);
  fs.mkdirSync(path.resolve("backend"), { recursive: true });
  fs.writeFileSync(path.resolve("backend/.env.deployment"), `${backendEnv}\n`);
  fs.mkdirSync(path.resolve("apps/web"), { recursive: true });
  fs.writeFileSync(path.resolve("apps/web/.env.deployment"), `${webEnv}\n`);

  console.log("Wrote frontend/src/generated/contracts.json");
  console.log("Wrote apps/web/src/generated/contracts.json");
  console.log("Wrote backend/.env.deployment");
  console.log("Wrote apps/web/.env.deployment");
}

main();
