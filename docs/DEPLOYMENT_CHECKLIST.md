# Deployment Checklist

## ローカルMVP確認

- [ ] `npm install` 実行済み
- [ ] `.env.local` に `OPENAI_API_KEY` を設定済み
- [ ] `npm run dev` で起動できる
- [ ] `npm run lint` が通る
- [ ] `npm run build` が通る

## ゲーム動作確認

- [ ] ゲーム開始で手札配布される
- [ ] プレイヤー質問が実行できる
- [ ] CPU4人が順番に質問する
- [ ] ログに質問・回答が記録される
- [ ] 解答UIで正解/不正解が表示される
- [ ] OpenAI失敗時もフォールバックで進行する

## 本番展開前確認

- [ ] `OPENAI_API_KEY` をホスティング先のサーバー環境変数に設定した
- [ ] APIキーがクライアントJSに露出していない
- [ ] `docs/API_DOCUMENTATION.md` と実装に齟齬がない
