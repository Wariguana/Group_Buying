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

### 尚未完成

- 正式帳號登入、密碼雜湊、session 與總公司／分店權限。
- 門市、團購、訂單與客戶管理功能。
- LINE Login、LIFF、Messaging API 與通知。
- 客戶下單、取貨、取消、逾期未取、報表與 Excel 匯出。

> 目前登入 API 仍使用暫時示範帳密，絕不可部署到正式環境。

## 技術架構

- Next.js 16、React 19、TypeScript、Tailwind CSS
- PostgreSQL：核心關聯式資料庫
- Supabase：代管 PostgreSQL 與後續商品圖片儲存
- Prisma 7：資料模型、migration 與型別安全的資料庫存取

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
```

`npm install` 與 `npm ci` 完成後會自動執行 `prisma generate`。`generated/` 是自動產生的 Prisma Client，已被 Git 忽略，不需提交。

## 環境變數

請從 `.env.example` 建立自己的 `.env.local`。目前實際使用：

```text
DATABASE_URL=
DIRECT_URL=
```

未來可能加入：

```text
NEXT_PUBLIC_APP_URL=
AUTH_SECRET=
LINE_CHANNEL_ID=
LINE_CHANNEL_SECRET=
LINE_CHANNEL_ACCESS_TOKEN=
NEXT_PUBLIC_LIFF_ID=
```

資料庫密碼、Supabase 金鑰、LINE Secret、Access Token 都不可寫入程式碼、README 或 Git。

## 資料庫原則

- 所有 schema 變更必須透過 Prisma migration。
- 第一版採「一團一商品」；商品資料直接保存於 `GroupBuy`。
- `GroupBuyStore` 表示參與團購的分店與該店取貨時間。
- 訂單連到 `GroupBuyStore`，確保訂單只能屬於有參與該團的門市。
- 訂單保存商品名稱、單價、單位、數量與金額快照。
- 總公司、分店與客戶的權限必須在伺服器端驗證。

## 目錄結構

```text
app/
  api/                 API 路由
  home/                管理端首頁
  lib/prisma.ts        共用 Prisma Client（只限伺服器端）
  page.tsx             登入頁

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

1. 真實管理員登入、session 與角色權限。
2. 門市管理。
3. 總公司與分店開團。
4. LINE 客戶身分辨識與下單。
5. 到貨、取貨付款、取消與逾期未取。
6. LINE 通知、報表與 Excel 匯出。

## 安全規則

- 不提交 `.env.local`、Token、密碼或正式客戶資料。
- 不在測試環境使用真實客戶個資。
- 不使用寫死帳密作為正式登入機制。
- 正式上線前確認資料庫備份、權限規則與 LINE 金鑰管理方式。
