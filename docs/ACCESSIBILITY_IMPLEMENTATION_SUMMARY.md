# Accessibility Implementation Summary

## 対象

- `src/app/page.tsx`
- `src/app/page.module.css`

## 実装済み（MVP）

- ネイティブ要素中心（`button`, `select`）でキーボード操作可能
- CPU処理中のボタン無効化で誤操作を防止
- 判定結果は色 + テキストで表示（`正解です！` / `不正解です。`）
- レスポンシブ対応で小画面時の選択UIを縦積みに変更

## 既知の改善余地

- フォームの明示ラベル付与
- ログ更新に `aria-live` 追加
- コントラストの定量チェック（Lighthouse/axe）
