# 團購系統

總公司、分店、LINE Bot 與客戶下單網站共用的團購管理系統。

## 目前狀態

### 已完成

- Next.js、React、TypeScript 與 Tailwind CSS 專案基礎。
- 管理端登入畫面與暫時首頁。
- Supabase 開發資料庫與 PostgreSQL 連線。
- Prisma 7 設定、資料模型、第一版 migration 與 Prisma Client。
- 核心資料表：`User`、`Store`、`Customer`、`GroupBuy`、`GroupBuyStore`、`Order`。
- 核心 enum：使用者角色、團購狀態、訂單狀態。
- 共用 Prisma Client 基礎，供後端 API 使用。
- 管理員帳密雜湊登入、HttpOnly Cookie session、登出端點與受保護的管理端首頁。
- 開發用總公司／分店管理員 seed 腳本。
- 總公司專用的門市管理：列表、新增、編輯、啟用／停用與受保護的 Store API。
- 管理端共用 Layout 與導覽列：首頁、門市列表與門市編輯頁使用相同的背景、內容寬度與導覽列。
- 總公司團購管理：建立草稿、選擇參與門市、查看／編輯一團一商品資料與各門市取貨時間。
- 團購狀態管理：總公司可發布、暫停或結束團購；目前發布只更新系統狀態，尚未串接 LINE 發送。
- 團購權限：總公司可查看與管理全部總公司團；分店目前僅能查看指派給自己門市的團購與取貨時間。
- 分店取貨時間管理：分店可查看被指派團購，並只修改自己門市的取貨開始／結束時間。
- 分店自開團：分店可建立、完整編輯、發布、暫停與結束只屬於自己門市的團購；總公司仍可管理全部團購。

### 尚未完成

- 客戶下單、訂單管理、取貨與付款流程。
- 各 API 的完整總公司／分店授權規則與帳號管理畫面。
- LINE Messaging API 與通知。
- 客戶下單、取貨、取消、逾期未取、報表與 Excel 匯出。

> 使用登入功能前，必須先設定 `AUTH_SECRET` 並透過 seed 建立管理員帳號；不可在程式碼中寫死帳密。

## 技術架構

- Next.js 16、React 19、TypeScript、Tailwind CSS
- PostgreSQL：核心關聯式資料庫
- Supabase：代管 PostgreSQL 與後續商品圖片儲存
- Prisma 7：資料模型、migration 與型別安全的資料庫存取
- bcryptjs：密碼雜湊與驗證
- jose：簽署與驗證管理員 session
- @line/liff：LIFF 前端初始化與取得 LINE ID Token

## 加入專案前的環境準備

請先安裝：

- Git
- Node.js 24 LTS 與 npm
- Visual Studio Code（建議）
- GitHub repository 與 Supabase 專案的存取權限

建議 VS Code 擴充功能：

- ESLint
- Tailwind CSS IntelliSense
- Prisma
- Prettier - Code formatter

使用 Supabase 開發時，不需要在本機另行安裝 PostgreSQL。

## 第一次啟動

```powershell
git clone <repository-url>
cd group_buying
npm ci
Copy-Item .env.example .env.local
npm run dev
```

接著依 Supabase 專案的 **Connect → ORM → Prisma** 資訊，填入 `.env.local` 的 `DATABASE_URL` 與 `DIRECT_URL`。`.env.local` 不可提交到 GitHub。

開啟 [http://localhost:3000](http://localhost:3000)。

## 常用指令

```powershell
npm run dev
npm run lint
npm run build
npx prisma format
npx prisma validate
npx prisma generate
npx prisma migrate dev --name <migration-name>
npx prisma migrate status
npx prisma studio
npm run db:seed
```

`npm install` 與 `npm ci` 完成後會自動執行 `prisma generate`。`generated/` 是自動產生的 Prisma Client，已被 Git 忽略，不需提交。

## 環境變數

請從 `.env.example` 建立自己的 `.env.local`。目前實際使用：

```text
DATABASE_URL=
DIRECT_URL=
```

登入與 LIFF 客戶驗證使用：

```text
NEXT_PUBLIC_APP_URL=
AUTH_SECRET=
LINE_CHANNEL_ID=
NEXT_PUBLIC_LIFF_ID=
```

`NEXT_PUBLIC_APP_URL` 是目前網站公開網址；本機 LIFF 測試時填 Cloudflare Tunnel 的 HTTPS 網址。`LINE_CHANNEL_SECRET` 與 `LINE_CHANNEL_ACCESS_TOKEN` 尚未被目前功能使用，保留給日後 LINE Messaging API 或其他授權流程。

本機以 Cloudflare Tunnel 測試 LIFF 時，`next.config.ts` 會自動從 `NEXT_PUBLIC_APP_URL` 取出 Tunnel 網域，加入 Next.js 的開發模式允許來源；每次 Tunnel 網址變更後，更新 `.env.local` 並重新啟動 `npm run dev` 即可。

資料庫密碼、Supabase 金鑰、LINE Secret、Access Token 都不可寫入程式碼、README 或 Git。

## 初始管理員帳號

先在 `.env.local` 設定 `AUTH_SECRET`。可在 PowerShell 產生一組安全值：

```powershell
$bytes = New-Object byte[] 32
[System.Security.Cryptography.RandomNumberGenerator]::Fill($bytes)
[Convert]::ToBase64String($bytes)
```

接著填寫 `.env.local` 中全部 `SEED_` 開頭的欄位，再執行：

```powershell
npm run db:seed
```

此腳本會建立一個總公司管理員、一間測試分店與一個分店管理員；如果同名帳號或分店已存在，腳本不會覆寫原有資料或密碼。

## 資料庫原則

- 所有 schema 變更必須透過 Prisma migration。
- 第一版採「一團一商品」；商品資料直接保存於 `GroupBuy`。
- `GroupBuyStore` 表示參與團購的分店與該店取貨時間。
- `GroupBuy.source` 區分總公司團（`HQ`）與分店自建團（`STORE`）；分店自建團以 `ownerStoreId` 固定歸屬門市。
- 訂單連到 `GroupBuyStore`，確保訂單只能屬於有參與該團的門市。
- 訂單保存商品名稱、單價、單位、數量與金額快照。
- 總公司、分店與客戶的權限必須在伺服器端驗證。

## 門市管理

- 路徑 `/stores` 僅供總公司管理員使用；未登入者會回登入頁，分店管理員會回管理端首頁。
- 總公司可新增、查看、編輯、啟用與停用門市；第一版不提供刪除門市，避免破壞既有團購與訂單資料。
- 門市欄位包含名稱、地址、電話、LINE 群組 ID 與啟用狀態。
- Store API 同樣在伺服器端檢查總公司角色：`GET /api/stores`、`POST /api/stores`、`PATCH /api/stores/[id]`。

## 團購管理

- `/group-buys`：總公司可查看全部團購並建立新團；分店可查看總公司指派團與本店自建團。
- `/group-buys/new`：總公司建立一團一商品的草稿團並選擇參與門市；分店建立時不選門市，系統自動綁定本店。
- `/group-buys/[id]`：總公司查看完整團購資料；分店只可查看指派給本店的團購與本店取貨時間。
- `/group-buys/[id]/edit`：總公司可修改全部團購；分店僅可修改自己建立的本店團。
- `/group-buys/[id]/pickup-time`：分店只可修改自己門市的取貨時間。
- `GET`、`POST /api/group-buys`：依角色讀取團購資料；總公司建立多門市團，分店建立時由伺服器自動綁定自己的門市。
- `PATCH /api/group-buys/[id]`：總公司可更新任一團購及參與門市設定；分店僅可更新自己建立的本店團。若參與門市已有訂單，系統會阻止總公司直接移除該門市。
- `POST /api/group-buys/[id]/status`：總公司可操作全部團；分店僅可發布、暫停或結束自己建立的本店團。發布前必須至少選擇一家參與門市。
- `PATCH /api/group-buys/[id]/pickup-time`：僅分店管理員可更新自己門市的 `GroupBuyStore` 取貨時間。

目前團購狀態包含草稿、已發布、暫停、已結束。第一版的發布動作尚未發送 LINE 卡片，LINE 串接會在後續功能實作。

## 目錄結構

```text
app/
  (admin)/             已登入管理端 Route Group；不會出現在網址中
    layout.tsx          共用導覽列、登入檢查與內容版型
    group-buys/          團購列表、建立、詳情與編輯頁（網址 /group-buys）
    home/               管理端首頁（網址 /home）
    stores/             總公司門市列表、新增與編輯頁（網址 /stores）
  api/                 登入、登出、客戶 LINE 身分、門市與團購 API 路由
  Navbar/nav.tsx       共用管理端導覽列與登出操作
  lib/prisma.ts        共用 Prisma Client（只限伺服器端）
  page.tsx             登入頁
  liff/page.tsx        客戶 LINE LIFF 身分辨識與首次手機補填頁

prisma/
  schema.prisma        Prisma 資料模型
  migrations/          已核准的資料庫結構歷程

public/                公開靜態素材
.env.example           環境變數範本
```

## 開發流程

1. 從 `main` 拉取最新程式並建立功能分支。
2. 設定自己的 `.env.local`。
3. 完成功能後執行 `npm run lint` 與 `npm run build`。
4. 若 schema 有變更，建立 Prisma migration 並一併提交。
5. 建立 Pull Request，確認後再合併。

## 開發順序

1. 帳號管理畫面與各功能的完整角色授權。
2. 總公司與分店開團。
3. LINE 客戶身分辨識與下單。
4. 到貨、取貨付款、取消與逾期未取。
5. LINE 通知、報表與 Excel 匯出。

## 安全規則

- 不提交 `.env.local`、Token、密碼或正式客戶資料。
- 不在測試環境使用真實客戶個資。
- 不使用寫死帳密作為正式登入機制。
- 正式上線前確認資料庫備份、權限規則與 LINE 金鑰管理方式。
- 客戶識別只傳送 LIFF 取得的原始 ID Token；伺服器端向 LINE 驗證後，才使用回傳的 LINE User ID 查找或建立 Customer。
