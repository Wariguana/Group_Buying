團購系統
總公司＋分店＋LINE Bot＋客戶下單網站的團購管理系統。
完整第一版規格請見：Google Docs 規格文件
專案目前狀態
目前為基礎開發階段。
已完成：
- 基本登入頁面。
- 基本首頁。
- Next.js 專案基礎設定。
尚未完成：
- 正式帳號登入與 session。
- 總公司／分店權限。
- PostgreSQL／Supabase／Prisma 串接。
- 團購、訂單、門市、客戶資料表。
- LINE Login、LIFF、LINE 通知。
- 客戶下單、取貨管理、報表與 Excel 匯出。
目前登入功能僅為暫時示範，不可用於正式環境。

技術架構
目前已安裝
- Next.js 16
- React 19
- TypeScript
- Tailwind CSS
- ESLint
- Prettier - Code formatter
規劃加入
- PostgreSQL：核心關聯式資料庫。
- Supabase：代管 PostgreSQL 與商品圖片儲存。
- Prisma：資料模型、資料庫 migration 與型別安全查詢。
- LINE Login／LIFF：客戶身分辨識。
- LINE Messaging API：訂單、取消與通知訊息。
加入專案前的環境準備
請先安裝：
- Git
- Node.js 24 LTS
- npm（隨 Node.js 安裝）
- Visual Studio Code（建議）
- GitHub repository 存取權限
- Supabase 專案存取權限（資料庫功能開始後需要）
使用 Supabase 後，開發者不需要在本機另外安裝 PostgreSQL。
建議 VS Code 擴充功能
- ESLint
- Tailwind CSS IntelliSense
- Prisma（Prisma 加入專案後需要
第一次啟動專案
git clone <repository-url>
cd group_buying
npm ci
npm run dev
開啟瀏覽器：
http://localhost:3000
常用指令
npm run dev
啟動本機開發伺服器。
npm run lint
檢查程式碼格式與常見問題。
npm run build
建立正式環境版本；提交前建議執行一次。
npm run start
執行已建立完成的正式版本。
Prisma 加入後的常用指令
以下指令需等 Prisma 正式加入專案後才能使用。

npx prisma generate
產生 Prisma Client。
npx prisma migrate dev --name <migration-name>
建立並套用開發環境資料表變更。
npx prisma studio
開啟本機資料庫管理介面。
npx prisma migrate deploy
在正式環境套用已核准的 migration。
環境變數
建立本機環境檔案：
cp .env.example .env.local
.env.local 僅限本機使用，不可提交到 GitHub。
未來預計使用的環境變數：
# PostgreSQL / Supabase
DATABASE_URL=
DIRECT_URL=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=

# 網站與登入
NEXT_PUBLIC_APP_URL=
AUTH_SECRET=

# LINE
LINE_CHANNEL_ID=
LINE_CHANNEL_SECRET=
LINE_CHANNEL_ACCESS_TOKEN=
NEXT_PUBLIC_LIFF_ID=
注意事項：
- 不可將資料庫密碼、Supabase 金鑰、LINE Secret 或 Access Token 寫進程式碼。
- 不可將 .env.local 上傳至 GitHub。
- 正式環境、測試環境與本機開發環境應使用不同的資料庫與金鑰。
資料庫原則
第一版資料庫採用：
PostgreSQL + Supabase + Prisma
核心資料模型預計包含：
- User：總公司管理員與分店管理員。
- Store：門市基本資料與 LINE 群組設定。
- Customer：LINE user ID、顯示名稱與手機。
- GroupBuy：一團一商品的團購資料。
- GroupBuyStore：參與門市與各店取貨時間。
- Order：客戶訂單與下單當下的價格快照。
原則：
- 商品圖片存放於 Supabase Storage。
- 資料表結構修改必須透過 Prisma migration。
- 不可直接修改正式資料庫結構後卻沒有 migration。
- 總公司、分店與客戶權限一律在伺服器端檢查。
專案目錄
app/
  api/              API 路由
  home/             管理後台首頁
  page.tsx          登入頁
  layout.tsx        全站 layout
  globals.css       全站樣式

public/             公開靜態圖片與素材

prisma/             Prisma schema 與 migration
                    （Prisma 加入後建立）
帳號與權限規則
- 總公司管理員：可管理全部門市、團購、訂單與報表。
- 分店管理員：只能管理自己所屬門市的資料。
- 客戶：透過 LINE 身分辨識，可跨門市查看自己的訂單。
- 客戶的門市歸屬由訂單決定，不寫在 Customer 身上。
- 所有權限限制必須在後端驗證，不可只依賴前端畫面隱藏。
開發流程
1. 從 main 拉取最新程式。
2. 建立自己的功能分支。
3. 安裝套件並設定 .env.local。
4. 完成功能後執行：
   npm run lint
   npm run build
5. 建立 Pull Request。
6. 經確認後再合併至主分支。
建議開發順序
1. PostgreSQL、Supabase、Prisma 與帳號權限基礎。
2. 門市管理。
3. 總公司開團與分店開團。
4. 客戶 LINE 身分辨識與下單。
5. 訂單到貨、取貨付款、取消與逾期未取。
6. LINE 通知。
7. 報表與 Excel 匯出。
8. 介面與行動版體驗優化。
安全規則
- 不提交 .env.local、Token、密碼或正式資料。
- 不在測試環境使用真實客戶個資。
- 不使用寫死帳號密碼作為正式登入機制。
- 上線前必須確認資料庫備份、權限規則與 LINE 金鑰管理方式。
費用提醒
- PostgreSQL：免費開源軟體。
- Prisma ORM：免費開源工具。
- Supabase：開發期可先使用免費方案。
- 正式上線後，需評估 Supabase、網站主機、網域與 LINE 訊息費用。
待確認項目
- 到貨通知的發送對象與時機。
- 報表完整欄位與計算公式。
- LINE 正式 Channel、LIFF 與 Messaging API 設定。
- 正式資料庫 schema 與 API 設計。