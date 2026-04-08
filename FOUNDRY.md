# Foundry 合約開發與部署

這個專案的鏈上架構分成兩個合約：

- `contract/MealVoteGovernance.sol`
- `contract/MealVoteOrderEscrow.sol`

## 1. 安裝 Foundry

```bash
curl -L https://foundry.paradigm.xyz | bash
foundryup
```

安裝完成後確認：

```bash
forge --version
cast --version
anvil --version
```

## 2. 安裝測試依賴

本 repo 的測試使用 `forge-std`：

```bash
forge install foundry-rs/forge-std
```

## 3. 準備環境變數

建議直接使用已加入 `.gitignore` 的本機檔案：

```bash
cp .env.foundry.example .env.foundry
```

至少要填：

- `SEPOLIA_RPC_URL`
- `ETHERSCAN_API_KEY`
- `DEPLOYER_PRIVATE_KEY`
- `PLATFORM_MAIN_WALLET`

如果我已經幫你建立了 `.env.foundry`，你也可以直接編輯那個檔案，不需要再複製一次。

## 4. 編譯合約

```bash
forge build
```

## 5. 執行測試

```bash
forge test -vv
```

## 6. 本地鏈測試

啟動本地鏈：

```bash
anvil
```

另一個終端執行：

```bash
forge script script/DeployMealVote.s.sol:DeployMealVote --rpc-url http://127.0.0.1:8545 --broadcast
```

## 7. 部署到 Sepolia

```bash
source .env.foundry
forge script script/DeployMealVote.s.sol:DeployMealVote \
  --rpc-url $SEPOLIA_RPC_URL \
  --broadcast \
  --verify
```

部署成功後：

- `deployments/sepolia.json` 會寫入部署結果
- `backend/.env.deployment` 會輸出合約地址給後端使用

## 8. 部署後要接回系統的地方

部署完成後，至少要把這些值回填或同步：

- `GOVERNANCE_CONTRACT_ADDRESS`
- `ORDER_ESCROW_CONTRACT_ADDRESS`
- `PLATFORM_TREASURY_ADDRESS`

前後端後續要改成以這兩個合約地址與 ABI 為主，不再只靠本地 fallback 邏輯。
