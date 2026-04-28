# Contributing

このリポジトリは「犯人当て推理ゲーム（1人 + CPU4人）」の開発用です。  
実装時は、まず `docs/` の仕様を参照してから作業してください。

## セットアップ

```bash
npm install
cp .env.example .env.local
# ローカルでは OPENAI_API_KEY を設定可
# 本番は Secret Manager 経由
npm run dev
```

## 開発ルール

- ゲームロジックは `src/lib/game` に集約し、UIから分離する
- 候補データは `src/data/clues.json` を単一ソースとする
- OpenAI 呼び出しは必ず `src/app/api/*` のサーバー側ルート経由にする
- フロントエンドに API キーを露出しない
- 本番環境では OpenAI キーを Secret Manager から取得する
- MVP段階では「質問処理」を優先し、CPUの最終解答は拡張ポイントとして残す

## 品質チェック

```bash
npm run lint
npm run build
```

## PR/コミット方針

- 1コミット1目的で小さく分ける
- 破壊的変更は理由を明記する
- ドキュメント更新が必要な変更は `docs/` も同時更新する
