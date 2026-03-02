# 作業規格書 — Sepolia 鏈上投票系統（On-chain Voting DApp）

## 作業概述

學生將拿到一個**已建好架構但缺少部分功能**的全端區塊鏈投票 DApp，包含：

- **Smart Contract** — Solidity + Hardhat
- **Go Backend** — REST API，使用 go-ethereum 讀取鏈上資料
- **React Frontend** — ethers.js + MetaMask 錢包互動
- **Docker Compose** — 一鍵啟動前後端

所有操作統一使用 **Sepolia 測試網**，前後端統一以 **Docker** 啟動。

學生需要在既有架構上：

1. 補齊缺少的合約功能
2. 補齊 Go Backend 的 API 端點
3. 補齊 React Frontend 的 UI 元件
4. 撰寫合約測試
5. 部署合約到 Sepolia 測試網
6. 使用 `docker compose up --build` 啟動並驗證功能

---

## 技術棧

| 項目 | 技術 | 版本 |
|------|------|------|
| 智能合約 | Solidity | ^0.8.20 |
| 合約開發工具 | Hardhat | ^2.22 |
| 後端 | Go (net/http + go-ethereum) | >= 1.22 |
| 前端 | React + Vite + ethers.js | React 18 / ethers v6 |
| 容器化 | Docker Compose | >= 2.0 |
| 測試網 | Sepolia | - |
| RPC 服務 | Alchemy | 免費方案 |
| 錢包 | MetaMask | 最新版 |

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
         │  Docker Compose
         ▼
┌─────────────────┐
│  docker compose  │
│  up --build      │
└─────────────────┘
```

| 操作類型 | 路徑 | 原因 |
|----------|------|------|
| 寫入（建立提案、投票、提款） | Frontend → MetaMask → Sepolia | 需要使用者私鑰簽名 |
| 讀取（查詢提案、投票狀態） | Frontend → Go Backend → Sepolia | 不需簽名，Backend 透過 Alchemy RPC |

---

## 學習目標

| # | 概念 | 在本作業中如何體現 |
|---|------|-------------------|
| 1 | testnet vs mainnet | 部署到 Sepolia 測試網，體驗真實區塊鏈環境 |
| 2 | gas fee | 每筆交易消耗 gas（即使是測試幣） |
| 3 | `call` vs `transaction` | 讀取提案（免費）vs 建立提案/投票（花 gas） |
| 4 | `payable` | 建立提案需附帶 0.001 ETH |
| 5 | `mapping` + 巢狀 mapping | 提案儲存、防重複投票記錄 |
| 6 | `modifier` | `onlyOwner` 存取控制 |
| 7 | `event` + `emit` | 鏈上日誌、前端可監聽 |
| 8 | `block.timestamp` | 投票截止時間判斷 |
| 9 | wallet signature | MetaMask 簽名每筆交易 |
| 10 | Go + 區塊鏈整合 | go-ethereum 的 ABI 編碼/解碼、ethclient |
| 11 | 前後端分離 | React 呼叫 Go API + 直接發鏈上交易 |
| 12 | 容器化部署 | Docker Compose 一鍵啟動前後端 |
| 13 | 鏈上不可竄改 | 投票記錄永久保存在區塊鏈上 |

---

## Part 1：Smart Contract

### 資料結構

```solidity
struct Proposal {
    string title;           // 提案標題
    string description;     // 提案描述
    address creator;        // 建立者地址
    uint256 yesVotes;       // 贊成票數
    uint256 noVotes;        // 反對票數
    uint256 deadline;       // 投票截止時間 (unix timestamp)
    bool exists;            // 提案是否存在
}
```

### 狀態變數

```solidity
mapping(uint256 => Proposal) public proposals;
mapping(uint256 => mapping(address => bool)) public voted;
uint256 public proposalCount;
address public owner;
```

### 必須實作的函式

| # | 函式 | 說明 | 重點 |
|---|------|------|------|
| 1 | `createProposal(title, description, durationInMinutes)` | 建立新提案 | `payable`，需付 >= 0.001 ETH |
| 2 | `vote(proposalId, support)` | 投贊成或反對 | 防重複投票 + 檢查 deadline |
| 3 | `getProposal(proposalId)` | 查詢單一提案 | `view` 函式 |
| 4 | `getAllProposals()` | 查詢所有提案 | 回傳 Proposal[] |
| 5 | `hasVoted(proposalId, voter)` | 查詢是否已投票 | `view` 函式 |
| 6 | `withdraw()` | 提領合約餘額 | 僅 owner 可呼叫 |

### Events

```solidity
event ProposalCreated(uint256 indexed proposalId, address indexed creator, string title, uint256 deadline);
event Voted(uint256 indexed proposalId, address indexed voter, bool support);
```

### 合約驗證規則

| 函式 | require 條件 |
|------|-------------|
| `createProposal` | `msg.value >= 0.001 ether` |
| `createProposal` | `bytes(title).length > 0`（標題不為空） |
| `createProposal` | `durationInMinutes > 0` |
| `vote` | `proposals[id].exists == true` |
| `vote` | `block.timestamp < deadline` |
| `vote` | `voted[id][msg.sender] == false` |
| `withdraw` | `msg.sender == owner` |

---

## Part 2：Go Backend

### API 端點規格

| Method | Path | 說明 | 回傳格式 |
|--------|------|------|----------|
| GET | `/api/health` | 健康檢查 | `{"status": "ok"}` |
| GET | `/api/contract` | 合約資訊 | `{"address", "owner", "proposalCount", "balanceWei", "balanceETH"}` |
| GET | `/api/proposals` | 所有提案 | `[{id, title, description, creator, yesVotes, noVotes, deadline, exists}]` |
| GET | `/api/proposals/:id` | 單一提案 | `{id, title, description, creator, yesVotes, noVotes, deadline, exists}` |
| GET | `/api/proposals/:id/voted?voter=0x...` | 是否已投票 | `{"hasVoted": true/false}` |

### 技術要點

- 使用 `go-ethereum/ethclient` 連接 Alchemy Sepolia RPC
- 使用 `go-ethereum/accounts/abi` 編碼/解碼合約呼叫
- 使用 Go 1.22+ 的 `net/http` 路由（`HandleFunc("GET /path", handler)`）
- 使用 `rs/cors` 處理跨域請求
- 使用 `joho/godotenv` 載入環境變數
- 透過 Dockerfile 多階段建置為最小 Alpine 映像

---

## Part 3：React Frontend

### 必須功能

| # | 功能 | 說明 |
|---|------|------|
| 1 | 連接 MetaMask | 呼叫 `eth_requestAccounts` 取得帳號 |
| 2 | 顯示錢包地址 | 截斷顯示如 `0x1234...5678` |
| 3 | 顯示當前網路 | 顯示 `Sepolia` |
| 4 | 網路檢查 | 非 Sepolia 時顯示警告，提示切換 |
| 5 | 建立提案表單 | 輸入標題、描述、持續時間，附帶 0.001 ETH |
| 6 | 提案列表 | 顯示所有鏈上提案 |
| 7 | 投票功能 | 贊成/反對按鈕 |
| 8 | 已投票狀態 | 已投票則禁用按鈕，顯示「已投票」 |
| 9 | 投票進度條 | 視覺化顯示贊成/反對比例 |
| 10 | 倒數計時 | 顯示每個提案的投票剩餘時間 |
| 11 | Transaction Hash | 交易後顯示 tx hash + Sepolia Etherscan 連結 |
| 12 | Loading 狀態 | 交易 pending 時顯示等待提示 |
| 13 | 合約餘額 | 顯示合約累積的 ETH |
| 14 | 帳號切換 | 偵測 MetaMask 帳號變更，自動更新 |

### 關鍵程式碼模式

**連接錢包：**

```javascript
const provider = new ethers.BrowserProvider(window.ethereum);
const signer = await provider.getSigner();
const address = await signer.getAddress();
```

**發送交易（寫入）：**

```javascript
const tx = await contract.createProposal(title, description, duration, {
  value: ethers.parseEther("0.001"),
});
const receipt = await tx.wait(); // 等待 Sepolia 區塊確認（約 10-15 秒）
```

**讀取資料（免費）：**

```javascript
const proposals = await contract.getAllProposals();
```

---

## Part 4：環境設定指南

### 4-1. MetaMask 設定

#### 安裝與建立錢包

1. 前往 https://metamask.io/ 安裝瀏覽器擴充套件
2. 點 **「Create a new wallet」**
3. 設定密碼 → 記下 12 個助記詞 → 完成建立

#### 切換到 Sepolia 測試網

MetaMask 內建 Sepolia 網路，不需手動新增：

1. 點 MetaMask 左上角的**網路選擇器**
2. 找到 **「Sepolia」** 點擊切換
3. 如果找不到，把篩選從 **「All popular networks」** 改成 **「Testnets」**

#### 切換帳號注意事項

MetaMask 新版本中，每個帳號需要**單獨授權**連接網站：

1. 切換到新帳號
2. 如果網頁沒更新，點帳號旁 **⋮** → **「連結至網站」**
3. 選取當前網站（`localhost`），授權連接
4. 網頁自動更新為新帳號

### 4-2. Alchemy 設定

1. 前往 https://www.alchemy.com/ 註冊帳號（免費）
2. 建立新 App：Name 隨意，Chain 選 **Ethereum**，Network 選 **Sepolia**
3. 進入 App，確認 Network 下拉選單是 **「Ethereum Sepolia」**（不是 Mainnet）
4. 複製 Endpoint URL：`https://eth-sepolia.g.alchemy.com/v2/你的KEY`

### 4-3. 領取 Sepolia 測試幣

| Faucet | 網址 | 備註 |
|--------|------|------|
| Alchemy（推薦） | https://www.alchemy.com/faucets/ethereum-sepolia | 需 Alchemy 帳號，直接給 ETH |
| Google Cloud | https://cloud.google.com/application/web3/faucet/ethereum/sepolia | 預設給 PYUSD 不是 ETH，要注意 |

至少需要 **0.01 Sepolia ETH**（部署合約 + 建立提案 + 投票的 gas）。

### 4-4. 取得 MetaMask 私鑰（部署合約用）

1. MetaMask 點帳號旁 **⋮** → **「帳戶詳情」** → **「顯示私鑰」**
2. 輸入 MetaMask 密碼
3. 複製私鑰

> **重要：** 私鑰只放在本機 `.env` 檔案中，`.gitignore` 已設定不上傳。

---

## Part 5：部署 & 啟動流程

### 5-1. 編譯 & 部署合約到 Sepolia

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

部署：

```bash
npx hardhat run scripts/deploy.js --network sepolia
```

記下輸出的**合約地址**。可在 Etherscan 查看：

```
https://sepolia.etherscan.io/address/你的合約地址
```

### 5-2. Docker 啟動前後端

回到專案根目錄：

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

| 服務 | 網址 | 說明 |
|------|------|------|
| 前端頁面 | http://localhost | Nginx 提供靜態頁面 |
| Backend API | http://localhost:8080 | Go REST API |
| 前端 `/api/*` | 自動轉發 | Nginx 反向代理到 Backend |

### 5-3. 連接測試

1. 開啟 http://localhost
2. 確認 MetaMask 在 **Sepolia** 網路
3. 點 **Connect Wallet** → MetaMask 授權
4. 建立提案、投票、查看 Etherscan 交易

停止服務：

```bash
docker compose down
```

---

## Part 6：合約測試

```bash
cd contracts
npx hardhat test
```

| # | 測試項目 | 預期結果 |
|---|----------|----------|
| 1 | 建立提案 — 合法參數 + 0.001 ETH | 成功，proposalCount++ |
| 2 | 建立提案 — ETH 不足 | revert "Need 0.001 ETH" |
| 3 | 建立提案 — 空標題 | revert "Title cannot be empty" |
| 4 | 建立提案 — duration 為 0 | revert "Duration must be > 0" |
| 5 | 建立提案 — emit ProposalCreated | event 被觸發 |
| 6 | 投票 — 贊成 | yesVotes++ |
| 7 | 投票 — 反對 | noVotes++ |
| 8 | 投票 — 重複投票 | revert "Already voted" |
| 9 | 投票 — 已過期 | revert "Voting has ended" |
| 10 | 投票 — emit Voted | event 被觸發 |
| 11 | 提款 — owner 呼叫 | 餘額轉出 |
| 12 | 提款 — 非 owner | revert "Not owner" |

---

## Part 7：Vercel 前端部署（選做）

讓外部測試者無需 Docker，直接用瀏覽器 + MetaMask 測試：

```bash
cd frontend
npm install
npm run build
npx vercel login       # 第一次需在瀏覽器授權
npx vercel deploy --prod ./dist --yes
```

**測試者只需要：** 安裝 MetaMask → 建立錢包 → 切到 Sepolia → 領測試幣 → 打開網址

---

## 驗收方式

| # | 繳交項目 | 說明 |
|---|----------|------|
| 1 | GitHub Repository | 包含完整合約、測試、後端、前端、Docker 設定 |
| 2 | Sepolia 合約地址 | 已部署，可在 Etherscan 查到 |
| 3 | 部署交易 Hash | 部署合約的那筆交易 |
| 4 | 測試截圖 | `npx hardhat test` 全部 PASS |
| 5 | Docker 啟動截圖 | `docker compose up --build` 正常執行 |
| 6 | Demo 截圖 | 連接錢包、建立提案、投票、顯示 tx hash |
| 7 | Demo 影片 | 30-60 秒完整操作影片 |

---

## 評分標準

| 項目 | 比例 | 說明 |
|------|------|------|
| 合約正確性 | 20% | 所有函式邏輯正確 |
| 合約測試 | 10% | 至少 12 個測試案例全部 PASS |
| Go Backend | 15% | API 端點正確回傳 Sepolia 鏈上資料 |
| 部署到 Sepolia | 15% | 合約成功部署，Etherscan 可查 |
| 前端功能 | 20% | 連接 MetaMask、建立提案、投票、顯示結果 |
| Docker 正常啟動 | 10% | `docker compose up --build` 一鍵可用 |
| 程式碼品質 | 10% | 命名合理、錯誤處理、結構清晰 |

### Bonus（最多 +15%）

| 項目 | 加分 |
|------|------|
| Event 即時監聽更新 UI | +5% |
| Backend Event 索引/快取 | +5% |
| Gas 預估顯示 | +2% |
| 響應式設計（RWD） | +3% |

---

## 出題建議（給教師）

### 難度等級

| 等級 | 策略 | 學生需完成 |
|------|------|-----------|
| Easy | 提供完整合約 + Backend | 只需補齊 2 個前端元件 |
| Medium | 合約少 2 函式 + Backend 少 2 端點 | 補合約 + 補 API + 補前端 |
| Hard | 合約有 3 個 Bug + Backend 不完整 | 找 Bug + 補功能 + 前端串接 |
| Expert | 只給 SPEC + 空資料夾結構 | 從零實作所有部分 |

### 建議移除/留空的功能

**合約（讓學生實作）：**

| 移除項目 | 學習重點 |
|----------|----------|
| `vote()` 函式 | mapping 操作、require 檢查、event emit |
| `withdraw()` + `onlyOwner` modifier | 存取控制、modifier 用法 |

**Backend（讓學生實作）：**

| 移除項目 | 學習重點 |
|----------|----------|
| `GetProposal` handler | 路由參數解析、ABI 編碼 |
| `HasVoted` handler | Query parameter 處理、多參數合約呼叫 |

**Frontend（讓學生實作）：**

| 移除項目 | 學習重點 |
|----------|----------|
| `ProposalCard` 元件 | 投票互動、倒數計時、條件渲染 |
| Event 監聯 | `contract.on("Voted", callback)` 的用法 |

### 建議 Bug 題目（Hard 難度用）

| Bug | 位置 | 學生要找出什麼 |
|-----|------|---------------|
| `createProposal` 少了 `payable` | 合約 | 函式無法接收 ETH |
| `require(msg.value <= 0.001 ether)` | 合約 | 比較方向寫反 |
| `voted[proposalId][msg.sender] = false` | 合約 | 永遠不會標記為已投票 |

---

## 延伸挑戰（選做）

1. 在 Sepolia Etherscan 上驗證合約原始碼（`npx hardhat verify`）
2. 擴展為多選項投票（不只贊成/反對）
3. 加入投票權重（根據 ETH 餘額或 token 數量）
4. Go Backend 加入 WebSocket，即時推送新投票到前端
5. 部署前端到 Vercel，提供可公開存取的 URL
6. 加入 ERC-20 token 作為投票門檻
