# Agent Instructions

このリポジトリで実装を行うときは、必ず以下を守ってください。

1. 実装前に `docs/` 配下の関連ドキュメントを読む  
2. 仕様と実装に差分があれば、先に `docs/` を更新してから実装する  
3. ゲームロジックはUIと分離し、`src/lib/game` を優先して拡張する  
4. OpenAI APIはサーバー側APIルート経由でのみ利用し、キーをクライアントに出さない  
5. 変更後は `npm run lint` と `npm run build` を実行して確認する

最優先の参照資料:

- `docs/CONTRIBUTING.md`
- `docs/API_DOCUMENTATION.md`
- `docs/DEPLOYMENT.md`
- `docs/DEPLOYMENT_CHECKLIST.md`
- `docs/ACCESSIBILITY_COMPLIANCE.md`
- `docs/CSS_ARCHITECTURE.md`
