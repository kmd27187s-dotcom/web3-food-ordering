# MealVote

群組式投票點餐系統。  
目前主線支援：

- 錢包簽名登入
- 月訂閱
- 群組管理
- 提案 / 投票 / 點餐
- 排行榜 / 使用紀錄
- Sepolia 合約互動

## Current Stack

- Frontend: Next.js 15 + React + Tailwind CSS + shadcn/ui
- Web3: wagmi + viem + MetaMask
- Backend: Go + Gin
- Database: PostgreSQL + GORM
- Contracts: Solidity 0.8.24
- Contract tooling: Hardhat + Foundry
- Chain: Sepolia (`11155111`)

主線前端：

- `/Users/user/Desktop/project/project-mealvoting/apps/web`

主線後端：

- `/Users/user/Desktop/project/project-mealvoting/backend`

## Main Routes

前端頁面：

- `/`：首頁 / 登入入口
- `/subscribe`：未訂閱開通頁
- `/member`：會員 / 群組 / 管理員菜單管理
- `/governance`：提案 / 投票 / 點餐
- `/leaderboard`：排行榜
- `/records`：使用紀錄

## Local Development

### 1. 啟動 PostgreSQL

```bash
docker compose up -d postgres
```

### 2. 啟動 backend

```bash
cd backend
DATABASE_URL='postgres://mealvote:mealvote@localhost:5432/mealvote?sslmode=disable' \
DB_AUTOMIGRATE=true \
go run .
```

### 3. 啟動 frontend

```bash
cd apps/web
npm install
npm run dev
```

本機預設網址：

- frontend: [http://localhost:3000](http://localhost:3000)
- backend: [http://localhost:8080](http://localhost:8080)
- backend health: [http://localhost:8080/health](http://localhost:8080/health)

## Docker Development

目前 `compose.yaml` 已調整成偏開發模式。

直接在專案根目錄執行：

```bash
docker compose up --build
```

啟動後：

- frontend: [http://localhost:3000](http://localhost:3000)
- backend: [http://localhost:8080](http://localhost:8080)
- postgres: `localhost:5432`

Docker 開發模式會：

- 用 `postgres:16` 當資料庫
- backend 透過 `backend/Dockerfile` build 後啟動 Gin API
- frontend 透過 `apps/web/Dockerfile.dev` build 後啟動 Next.js dev server
- frontend 掛載原始碼 volume，方便邊改邊開發

## Important Environment Variables

backend 常用：

- `DATABASE_URL`
- `DB_AUTOMIGRATE`
- `HTTP_ADDR`
- `CHAIN_ID`
- `RPC_URL`
- `ORDER_CONTRACT_ADDRESS`
- `MEMBERSHIP_TOKEN_ADDRESS`
- `PLATFORM_TREASURY_ADDRESS`
- `SIGNER_PRIVATE_KEY`

frontend 常用：

- `NEXT_PUBLIC_API_BASE`

## Wallet Auth Rules

- 系統主身份是 `walletAddress`
- 同一錢包再次簽名只會登入，不會重複建立會員
- 第一次建立會員必須填顯示名稱
- 註冊邀請碼為隨機生成，但生成後固定不變
- 重新整理後前端會回到未連結狀態，需要重新授權登入

## Subscription Rules

- 月訂閱費用：`99 Token`
- 有效期間：`30 天`
- 未訂閱使用者會被導到 `/subscribe`
- 已訂閱後才可進入完整系統頁面

## Governance Rules

- 建立 proposal round：消耗 token
- 提名店家：消耗 token 或提案券
- 投票：依 `tokenAmount` 加權
- 點餐：後端先算金額，再喚起 MetaMask 支付

## Admin Features

管理員在 `/member` 可看到：

- 手動新增店家
- 手動新增菜單品項
- CSV 批次匯入菜單

CSV 欄位：

```csv
merchant_id,merchant_name,merchant_group,payout_address,item_id,item_name,price_wei,description
```

## Contracts

主要合約檔案：

- `/Users/user/Desktop/project/project-mealvoting/contract/VotingSystem-v3.sol`

部署腳本：

- `/Users/user/Desktop/project/project-mealvoting/script/DeployMealVote.s.sol`

Sepolia 部署前常用：

```bash
export SEPOLIA_RPC_URL="..."
export DEPLOYER_PRIVATE_KEY="..."
export PLATFORM_MAIN_WALLET="0x..."
export BACKEND_SIGNER_ADDRESS="0x..."
```

## Notes

- 舊前端 `frontend/` 目前是 legacy 參考，不是主線
- 現在主線資料庫是 PostgreSQL，不再以 SQLite 為主
- backend 入口以 `backend/main.go` 的 Gin 啟動為主
