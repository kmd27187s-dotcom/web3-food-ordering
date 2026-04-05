# MealVote

去中心化群組投票點餐系統。

目前主線功能：
- 錢包簽名登入
- 月訂閱
- 群組管理
- 提案 / 投票 / 點餐
- 排行榜 / 使用紀錄
- Sepolia 合約互動

## Tech Stack

- Frontend: Next.js 15 + React + Tailwind CSS + shadcn/ui
- Web3: wagmi + viem + MetaMask
- Backend: Go + Gin
- Database: PostgreSQL + GORM
- Contracts: Solidity 0.8.24
- Contract Tooling: Hardhat + Foundry
- Chain: Sepolia (`11155111`)

## Project Structure

- `apps/web`: 主線前端
- `backend`: API、資料庫、鏈上同步
- `contract`: Solidity 合約
- `script`: Foundry 部署腳本
- `scripts`: 合約設定同步腳本

## Main Routes

- `/`: 首頁 / 登入入口
- `/subscribe`: 訂閱開通頁
- `/member`: 會員 / 群組 / 管理員菜單管理
- `/governance`: 提案 / 投票 / 點餐
- `/leaderboard`: 排行榜
- `/records`: 使用紀錄

## Local Development

### 1. Start PostgreSQL

```bash
docker compose up -d postgres
```

### 2. Start backend

```bash
cd backend
DATABASE_URL='postgres://mealvote:mealvote@localhost:5432/mealvote?sslmode=disable' \
DB_AUTOMIGRATE=true \
go run .
```

### 3. Start frontend

```bash
npm run web:install
npm run web:dev
```

Default URLs:
- Frontend: [http://localhost:3000](http://localhost:3000)
- Backend: [http://localhost:8080](http://localhost:8080)
- Health: [http://localhost:8080/health](http://localhost:8080/health)

## Docker Development

Run everything with Docker:

```bash
docker compose up --build
```

After startup:
- Frontend: [http://localhost:3000](http://localhost:3000)
- Backend: [http://localhost:8080](http://localhost:8080)
- PostgreSQL: `localhost:5432`

## Environment Variables

Backend:
- `DATABASE_URL`
- `DB_AUTOMIGRATE`
- `HTTP_ADDR`
- `CHAIN_ID`
- `RPC_URL`
- `ORDER_CONTRACT_ADDRESS`
- `MEMBERSHIP_TOKEN_ADDRESS`
- `PLATFORM_TREASURY_ADDRESS`
- `SIGNER_PRIVATE_KEY`

Frontend:
- `NEXT_PUBLIC_API_BASE`
- `NEXT_PUBLIC_CHAIN_ID`
- `NEXT_PUBLIC_ORDER_CONTRACT_ADDRESS`
- `NEXT_PUBLIC_TOKEN_CONTRACT_ADDRESS`

## Product Rules

### Wallet Auth

- 主身份為 `walletAddress`
- 同一錢包再次簽名只會登入，不會重複建立會員
- 第一次建立會員必須填顯示名稱
- 註冊邀請碼為隨機生成，生成後固定

### Subscription

- 月訂閱費用：`99 Token`
- 有效期間：`30 天`
- 未訂閱使用者導向 `/subscribe`
- 已訂閱後才可進入完整系統頁面

### Governance

- 建立 proposal round：消耗 token
- 提名店家：消耗 token 或提案券
- 投票：依 `tokenAmount` 加權
- 點餐：後端先算金額，再喚起 MetaMask 支付

## Admin Features

管理員可在 `/member`：
- 手動新增店家
- 手動新增菜單品項
- CSV 匯入菜單

CSV 欄位格式：

```csv
merchant_id,merchant_name,merchant_group,payout_address,item_id,item_name,price_wei,description
```

## Contracts

Main contract:
- `contract/VotingSystem-v3.sol`

Deploy script:
- `script/DeployMealVote.s.sol`

Sepolia deploy example:

```bash
export SEPOLIA_RPC_URL="..."
export DEPLOYER_PRIVATE_KEY="..."
export PLATFORM_MAIN_WALLET="0x..."
export BACKEND_SIGNER_ADDRESS="0x..."

npm run deploy:sepolia
npm run export:contracts
```

## Notes

- `frontend/` 是 legacy 前端，不是主線
- 主線資料庫為 PostgreSQL
- 建議用 Docker 跑前後端與資料庫
