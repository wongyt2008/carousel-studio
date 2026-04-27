# Carousel Studio

![Carousel Studio 預覽圖](./og-cover.png)

Carousel Studio 是一個以瀏覽器為核心的工具，讓你把一段主題、草稿或長文內容，轉成可直接用於 Instagram 或 LinkedIn 的 carousel 貼文。

它不只是單純生圖，而是把整個流程串起來：

- 逐頁內容規劃
- 統一風格設定
- 參考圖片分析
- 版型系統生成
- 每頁圖片輸出
- PDF / ZIP 匯出

你只需要貼上內容、選擇頁數與尺寸，系統就會：

1. 先把內容拆成多頁 carousel 結構
2. 為每頁建立視覺方向
3. 逐頁生成圖片
4. 匯出最終結果

這個公開 branch 刻意只保留 **核心 carousel 生成功能**。  
私人 lead generation、webhook integration，以及 production 專用 backend 邏輯並不包含在這個版本裡。

- Demo: [carouselapp.isaac.mba](https://carouselapp.isaac.mba)
- 這個公開 repo 的目的，是清楚展示產品概念與核心實作方式

## 功能重點

- 支援 3、5、10 頁 carousel
- 支援多種尺寸：
  - `1:1`
  - `3:4`
  - `16:9`
  - `1080 × 1350`
- 可輸入統一風格 brief
- 最多可上傳 5 張參考圖片
- 先抽出 Image DNA，再建立整體 Design System
- 每頁可選不同 layout family，但維持同一套視覺語言
- 支援單頁重生成
- 可匯出 PDF 或 ZIP

## 這個工具在做什麼

- 接收一段內容草稿
- 自動拆成多頁 carousel
- 為每頁規劃標題、文案、設計方向與視覺元素
- 用 GPT Image 逐頁輸出圖片
- 最後整理成可以分享或下載的格式

它比較像一個輕量版的 AI 內容製作 workflow，而不是單一 prompt box。

## 為什麼做這個專案

我想做一個可以把原始內容快速轉成視覺化 carousel 的工具，而不是每次都從零開始排版或逐頁構思。

這個專案真正有趣的地方，是它把幾件事放在一起：

- 內容規劃
- 版型選擇
- 風格系統
- 圖片生成
- 匯出流程

所以它不是只展示「AI 可以畫圖」，而是展示一個比較完整的 AI-assisted content workflow。

## Demo

線上版本：

[https://carouselapp.isaac.mba](https://carouselapp.isaac.mba)

## 技術組成

- 原生 HTML、CSS、JavaScript
- OpenAI Chat Completions：用於內容規劃
- GPT Image：用於逐頁生圖
- 前端 PDF / ZIP 匯出

## 使用流程

1. 貼上主題、草稿、bullet points 或長文內容
2. 加入可選的統一風格設定
3. 上傳可選的參考圖片
4. 選擇頁數、尺寸與輸出格式
5. 系統會：
   - 分析參考圖片
   - 建立 carousel 設計系統
   - 規劃每一頁
   - 逐頁生成圖片
6. 匯出結果

## 本地使用方式

如果你完全沒有接觸過本地開網站，可以照下面做。

### 1. 先把專案下載到你的電腦

你可以用兩種方式：

**方法 A：直接下載 ZIP**

1. 打開這個 GitHub repo
2. 按 `Code`
3. 按 `Download ZIP`
4. 解壓縮到你的電腦

**方法 B：用 git clone**

如果你本身有安裝 Git，可以用：

```bash
git clone https://github.com/wongyt2008/carousel-studio.git
cd carousel-studio
```

### 2. 打開 terminal

如果你是 Mac：

- 可以打開 `Terminal`
- 或在資料夾上按右鍵，用支援 terminal 的工具開啟

如果你是 Windows：

- 可以打開 `PowerShell`
- 然後切換到這個專案資料夾

### 3. 進入專案資料夾

如果你是用 ZIP 下載並解壓後，請先進入那個資料夾。

例如：

```bash
cd 你的專案資料夾路徑
```

如果你剛才是用 `git clone`，而且已經執行了 `cd carousel-studio`，這一步可以跳過。

### 4. 啟動一個本地靜態伺服器

這個專案是靜態前端，不需要安裝 Node.js 套件，也不需要資料庫。

如果你的電腦有 Python 3，直接執行：

```bash
python3 -m http.server 4173
```

如果成功，你會看到類似：

```text
Serving HTTP on 0.0.0.0 port 4173 ...
```

### 5. 打開瀏覽器

在瀏覽器輸入：

```text
http://127.0.0.1:4173
```

這樣你就會看到 Carousel Studio 的介面。

### 6. 開始使用

打開後，你需要：

1. 在 `OpenAI API Key` 欄位貼上你自己的 OpenAI API Key
2. 在 `Carousel 內容` 貼上主題、草稿或長文內容
3. 選擇頁數與尺寸
4. 按 `規劃並生成`

### 常見問題

**Q：我輸入 `python3 -m http.server 4173` 之後顯示找不到 `python3`？**

A：代表你的電腦可能未安裝 Python 3。  
你可以先安裝 Python，或者改用其他靜態伺服器工具。

**Q：我打開 `127.0.0.1:4173` 看不到網站？**

A：先確認：

- 你有沒有在正確的專案資料夾裡啟動伺服器
- terminal 有沒有顯示 server 正在運行
- 4173 這個 port 有沒有被其他程式佔用

**Q：一定要安裝很多東西嗎？**

A：不用。  
這個公開版本最基本只需要：

- 一個瀏覽器
- Python 3（用來開本地靜態伺服器）
- 你自己的 OpenAI API Key

## OpenAI API 說明

這個公開版本會在瀏覽器端使用使用者自己的 OpenAI API Key。

也就是說：

- API Key 是由使用者在前端輸入
- 請求會直接從瀏覽器送到 OpenAI
- 為了方便重複使用，這個 branch 會把 key 存在瀏覽器的 `localStorage`

如果你想把它做成正式 SaaS，較合理的做法是把 API handling 移到 backend。

## Production 說明

我自己部署使用的版本，可能包含額外的 production integration 或私有 workflow。  
這些內容不會放在這個公開 branch 裡。

這個 repo 的目的，是公開核心產品思路與主要實作，而不是完整公開所有私有營運流程。

## 適合誰

- 想快速製作 carousel 的創作者
- 想測試 AI content workflow 的 marketer
- 想研究 prompt-to-design-system 流程的 builder
- 對 AI 規劃 + 圖像生成整合介面有興趣的人

## 建議的 GitHub Metadata

**Repository description**

用 ChatGPT 規劃內容、用 GPT Image 逐頁生成 Instagram / LinkedIn carousel，並支援參考圖分析、Design System 與 PDF / ZIP 匯出。

**Suggested topics**

```text
ai
openai
chatgpt
gpt-image
carousel
instagram
linkedin
social-media
content-creation
image-generation
javascript
frontend
prompt-engineering
design-system
creative-tools
```

## License

目前尚未加入授權條款。
