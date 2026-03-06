# On-chain Voting DApp — 鏈上投票系統

Solidity 智能合約 + Go Backend + React Frontend 的全端區塊鏈投票應用。  
使用 Docker Compose 一鍵啟動，連接 Sepolia 測試網。

**線上 Demo：** https://dist-rose-three-60.vercel.app  
**Sepolia 合約：** [0x19368a5a89eFAb84bFf2712a6B7FFAf58af6b009](https://sepolia.etherscan.io/address/0x19368a5a89eFAb84bFf2712a6B7FFAf58af6b009)

---

## 系統架構

```
┌─────────────────┐      寫入 (transaction)      ┌──────────────────┐
│  React Frontend │ ───────────────────────────► │                  │
│  (ethers.js)    │ ◄─────── 讀取 (call) ─────── │  Sepolia 測試網   │
└────────┬────────┘                              │                  │
         │ 讀取 (REST API)                        └────────┬─────────┘
         ▼                                                │
┌─────────────────┐      讀取 (JSON-RPC)                  │
│  Go Backend     │ ◄─────────────────────────────────────┘
│  REST API       │
└─────────────────┘
         ▲
         │  Docker Compose 管理
         ▼
┌─────────────────┐
│  docker compose  │
│  up --build      │
└─────────────────┘
```

| 操作 | 路徑 | 說明 |
|------|------|------|
| 寫入（建立提案、投票） | Frontend → MetaMask → Sepolia | 需要使用者錢包簽名 |
| 讀取（查詢提案、投票狀態） | Frontend → Go Backend → Sepolia | 不需簽名，透過 Alchemy RPC |

---

## 前置需求

| 工具 | 版本 | 用途 | 安裝連結 |
|------|------|------|----------|
| [Docker Desktop](https://www.docker.com/products/docker-desktop/) | >= 24 | 容器化執行前後端 | https://www.docker.com/ |
| [Node.js](https://nodejs.org/) | >= 18 | 合約編譯、測試、部署 | https://nodejs.org/ |
| [MetaMask](https://metamask.io/) | 最新版 | 瀏覽器錢包擴充套件 | https://metamask.io/ |
| [Alchemy](https://www.alchemy.com/) 帳號 | 免費方案 | Sepolia RPC 端點 | https://www.alchemy.com/ |

---

## 專案結構

```
web3/
├── contracts/                  # Hardhat 智能合約專案
│   ├── contracts/
│   │   └── VotingSystem.sol    #   Solidity 合約
│   ├── scripts/
│   │   └── deploy.js           #   部署腳本
│   ├── test/
│   │   └── VotingSystem.test.js#   合約測試（12 個案例）
│   ├── deployments/            #   部署記錄（自動產生）
│   ├── hardhat.config.js
│   ├── package.json
│   └── .env                    #   Alchemy URL + 私鑰（不上傳）
├── backend/                    # Go REST API
│   ├── main.go                 #   入口（路由 + CORS + 啟動）
│   ├── blockchain/
│   │   └── client.go           #   go-ethereum 鏈上資料讀取
│   ├── config/
│   │   └── config.go           #   環境變數載入
│   ├── handlers/
│   │   └── handlers.go         #   API handler
│   ├── Dockerfile              #   Go 多階段建置
│   └── go.mod / go.sum
├── frontend/                   # React + Vite 前端
│   ├── src/
│   │   ├── App.jsx             #   主頁面邏輯
│   │   ├── App.css             #   深色主題樣式
│   │   ├── main.jsx            #   React 入口
│   │   ├── abi/
│   │   │   └── VotingSystem.json#  合約 ABI
│   │   └── components/
│   │       ├── ConnectWallet.jsx#  錢包連接元件
│   │       ├── CreateProposal.jsx# 建立提案表單
│   │       └── ProposalCard.jsx #  提案卡片（投票 + 倒數）
│   ├── Dockerfile              #   Node build + Nginx
│   ├── nginx.conf              #   Nginx 設定（含 API 反向代理）
│   ├── index.html
│   ├── vite.config.js
│   └── package.json
├── docker-compose.yml          # 一鍵啟動前後端
├── .env.example                # 環境變數範本
├── SPEC.md                     # 作業規格書
└── README.md
```

---

## 快速開始（6 步）

### Step 1：設定 MetaMask

#### 1-1. 安裝 MetaMask

1. 前往 https://metamask.io/ 安裝瀏覽器擴充套件
2. 開啟 MetaMask，點 **「Create a new wallet」**
3. 設定密碼（自己記住即可）
4. 記下 12 個助記詞
5. 完成建立

#### 1-2. 切換到 Sepolia 測試網

MetaMask 內建 Sepolia 網路，不需手動新增：

1. 點 MetaMask 左上角的**網路選擇器**（預設顯示「Ethereum Mainnet」）
2. 找到 **「Sepolia」** 點擊切換
3. 如果找不到，把篩選從 **「All popular networks」** 改成 **「Testnets」** 就會出現

#### 1-3. 複製你的錢包地址

點 MetaMask 帳號名稱下方的地址，自動複製到剪貼簿。後面領測試幣和部署合約都需要。

---

### Step 2：申請 Alchemy API Key

1. 前往 https://www.alchemy.com/ 註冊帳號（免費）
2. 登入後點 **「Create new app」**
3. 設定：
   - Name：`voting-dapp`
   - Chain：**Ethereum**
   - Network：**Sepolia**
4. 建好後進入 App
5. 將 **Network** 下拉選單確認是 **「Ethereum Sepolia」**（不是 Mainnet）
6. 複製 **Endpoint URL**，格式如下：

```
https://eth-sepolia.g.alchemy.com/v2/你的KEY...
```

---

### Step 3：領取 Sepolia 測試幣

需要 Sepolia ETH 來支付 gas fee（部署合約 + 建立提案 + 投票）。

| Faucet | 網址 | 備註 |
|--------|------|------|
| Alchemy（推薦） | https://www.alchemy.com/faucets/ethereum-sepolia | 需 Alchemy 帳號，直接給 ETH |
| Google Cloud | https://cloud.google.com/application/web3/faucet/ethereum/sepolia | 預設給 PYUSD 不是 ETH，要注意 |

1. 打開 Faucet 網站
2. 貼上你的 MetaMask 錢包地址
3. 點領取
4. 等 10-20 秒，MetaMask 中會看到餘額更新

至少需要 **0.01 Sepolia ETH**。

---

### Step 4：編譯 & 部署合約到 Sepolia

```bash
cd contracts
npm install
npx hardhat compile
```

建立環境變數：

```bash
copy .env.example .env
```

編輯 `contracts/.env`：

```
ALCHEMY_URL=https://eth-sepolia.g.alchemy.com/v2/你的KEY
PRIVATE_KEY=你的MetaMask私鑰
```

> **取得私鑰方法：** MetaMask → 點帳號旁 **⋮** → **「帳戶詳情」** → **「顯示私鑰」** → 輸入密碼 → 複製。  
> **注意：** 私鑰只放在本機 `.env`，絕對不要上傳 GitHub。

部署合約：

```bash
npx hardhat run scripts/deploy.js --network sepolia
```

成功輸出：

```
VotingSystem deployed to: 0x19368a5a89eFAb84bFf2712a6B7FFAf58af6b009
Deployment info saved to deployments/sepolia.json
```

記下合約地址。可在 Etherscan 查看：`https://sepolia.etherscan.io/address/你的合約地址`

---

### Step 5：Docker 啟動前後端

回到專案根目錄，建立環境變數：

```bash
copy .env.example .env
```

編輯根目錄 `.env`：

```
RPC_URL=https://eth-sepolia.g.alchemy.com/v2/你的KEY
CONTRACT_ADDRESS=0x你部署的合約地址
```

一鍵啟動：

```bash
docker compose up --build
```

啟動後：

| 服務 | 網址 | 說明 |
|------|------|------|
| 前端頁面 | http://localhost | Nginx 提供靜態頁面 |
| Backend API | http://localhost:8080 | Go REST API |
| 前端 `/api/*` | 自動轉發到 Backend | Nginx 反向代理 |

驗證 Backend 正常：

```bash
curl http://localhost:8080/api/health
# {"status":"ok"}

curl http://localhost:8080/api/contract
# {"address":"0x...","owner":"0x...","proposalCount":0,...}
```

停止服務：

```bash
docker compose down
```

---

### Step 6：連接 & 測試

1. 開啟 http://localhost
2. 確認 MetaMask 在 **Sepolia** 網路
3. 點 **Connect Wallet**，MetaMask 跳出授權，按確認
4. 右上角會顯示 **Sepolia** + 你的錢包地址

#### 測試操作

1. **建立提案** — 輸入標題、描述、持續時間 → 點 Submit Proposal → MetaMask 確認（花 0.001 ETH + gas）
2. **等待確認** — Sepolia 交易需要約 10-15 秒確認
3. **查看交易** — 會顯示 transaction hash，點擊可跳轉到 Sepolia Etherscan
4. **投票** — 對提案點 Vote Yes 或 Vote No → MetaMask 確認
5. **驗證防重複** — 同一帳號再次投票會被拒絕

#### 切換帳號（模擬多人投票）

在 MetaMask 切換帳號後，新帳號需要**單獨授權**連接網站：

1. 點 MetaMask 左上角切換到另一個帳號
2. 如果網頁沒更新，點帳號旁 **⋮** → **「連結至網站」** → 選 `localhost`
3. 網頁會自動更新為新帳號
4. 新帳號也需要有 Sepolia ETH 才能操作

---

## 跑合約測試

```bash
cd contracts
npx hardhat test
```

測試在 Hardhat 內建環境執行（不需連 Sepolia），會跑 12 個測試案例。

---

## 部署前端到 Vercel（讓別人遠端測試）

如果想讓其他人不用在自己電腦跑 Docker 也能測試前端：

```bash
cd frontend
npm install
npm run build
npx vercel login          # 第一次需在瀏覽器授權
npx vercel deploy --prod ./dist --yes
```

部署完成後得到公開網址，分享給測試者。

**測試者只需要：**

1. 安裝 MetaMask
2. 建立錢包
3. 切到 Sepolia 網路
4. 領 Sepolia 測試幣
5. 打開 Vercel 網址 → Connect Wallet

---

## Go Backend API 
| Method | Path | 說明 | 回傳範例 |
|--------|------|------|----------|
| GET | `/api/health` | 健康檢查 | `{"status":"ok"}` |
| GET | `/api/contract` | 合約資訊 | `{"address","owner","proposalCount","balanceWei","balanceETH"}` |
| GET | `/api/proposals` | 所有提案 | `[{id,title,description,creator,yesVotes,noVotes,deadline,exists}]` |
| GET | `/api/proposals/:id` | 單一提案 | `{id,title,description,...}` |
| GET | `/api/proposals/:id/voted?voter=0x...` | 是否已投票 | `{"hasVoted":true}` |

---

## 常見問題

### MetaMask 切換帳號後網頁沒更新？

新帳號需要單獨授權連接網站。在 MetaMask 中點帳號旁的 **⋮** → **「連結至網站」** → 選取當前網站。

### 部署到 Sepolia 失敗？

- 確認 `contracts/.env` 的 `ALCHEMY_URL` 和 `PRIVATE_KEY` 填寫正確
- 確認錢包有足夠的 Sepolia ETH（至少 0.01）
- 確認 Alchemy App 的 Network 選的是 **Sepolia**（不是 Mainnet）

### Docker 啟動後前端連不到 Backend？

確認 `docker compose up --build` 兩個服務都正常啟動。查看 log：

```bash
docker compose logs backend
docker compose logs frontend
```

### 交易一直 pending？

Sepolia 測試網偶爾較慢，通常 10-30 秒會確認。如果超過 1 分鐘，可能是 gas 設定問題，在 MetaMask 中可以嘗試加速交易。

### Google Faucet 領到 PYUSD 不是 ETH？

Google Cloud Faucet 預設給 PYUSD（穩定幣）。請改用 Alchemy Faucet（https://www.alchemy.com/faucets/ethereum-sepolia），確保領到的是 Sepolia ETH。
