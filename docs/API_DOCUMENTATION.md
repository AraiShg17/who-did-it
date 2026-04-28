# API Documentation

このプロジェクトで現在実装済みの API は CPU の質問生成エンドポイントです。

## `POST /api/cpu-question`

CPU が次に質問する「犯人 / 凶器 / 犯行現場」を生成します。  
サーバー側で OpenAI API を呼び出し、失敗時はフォールバックでランダム質問を返します。

### リクエスト

```json
{
  "cpuId": "cpu1",
  "hand": { "suspect": "田中", "weapon": "ロープ", "location": "庭" },
  "clueData": {
    "suspects": ["田中", "佐藤", "鈴木", "高橋", "伊藤", "渡辺"],
    "weapons": ["ナイフ", "ロープ", "毒薬", "拳銃", "ハンマー", "燭台"],
    "locations": ["書斎", "キッチン", "庭", "地下室", "寝室", "ホール"]
  },
  "logs": []
}
```

### レスポンス

```json
{
  "question": { "suspect": "高橋", "weapon": "毒薬", "location": "書斎" },
  "source": "openai"
}
```

`OPENAI_API_KEY` 未設定や API 失敗時:

```json
{
  "question": { "suspect": "佐藤", "weapon": "燭台", "location": "寝室" },
  "source": "fallback",
  "reason": "OPENAI_API_KEY is not configured"
}
```

## エラー方針

- 可能な限り 200 でフォールバック結果を返し、ゲーム進行を止めない
- 入力値が想定外でも `sanitize` して有効候補に補正する
