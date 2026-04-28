# Deployment Guide

現時点のMVPはローカル実行を優先します。  
この文書では「最小構成でのデプロイ」手順を示します。

## 1. ローカル実行（推奨）

```bash
npm install
cp .env.example .env.local
# OPENAI_API_KEY を設定
# または .env に設定
npm run dev
```

## 2. ビルド確認

```bash
npm run lint
npm run build
npm run start
```

## 3. 必要な環境変数

- `OPENAI_MODEL` (任意): 例 `gpt-5-mini`
- `GCP_PROJECT_ID`: あなたのGCPプロジェクトID
- `OPENAI_API_KEY_SECRET_NAME`: 既定 `OPENAI_API_KEY`
- `OPENAI_API_KEY_SECRET_VERSION`: 既定 `latest`

本番 (`NODE_ENV=production`) では、OpenAI APIキーは Secret Manager から読み取ります。  
ローカル開発では `OPENAI_API_KEY` を `.env` / `.env.local` に置いたフォールバックも利用できます。

## 4. 任意のホスティング先へ展開

Next.js App Router が動作する環境なら展開できます（Vercel など）。  
ホスティング先の実行サービスアカウントに `Secret Manager Secret Accessor` を付与し、
`OPENAI_API_KEY` シークレットを参照できるようにしてください。

## 5. 動作確認項目

- ゲーム開始後に手札が配られる
- プレイヤーが質問できる
- CPUターンで質問が自動実行される
- OpenAI未設定時でもフォールバックで進行が止まらない
