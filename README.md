# WriteOne

英作文プリントを選び、回答を提出するとAI添削を受けられるWebアプリ / PWAです。

## ローカル起動

```bash
npm install
copy .env.example .env
npm run dev
```

ブラウザで `http://localhost:5173` を開きます。

## 環境変数

フロントエンドで使う値は `.env` に設定します。

```bash
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_xxxx
VITE_ENABLE_DEV_UNLOCK=true
```

`OPENAI_API_KEY` と `SUPABASE_SERVICE_ROLE_KEY` はフロントエンドに置かず、Supabase Edge Function の Secret に設定します。

## Supabase SQL

初回セットアップ時に、Supabase SQL Editorで以下を順番に実行します。

1. `supabase/schema.sql`
2. `supabase/migrations/001_grade_essay.sql`
3. `supabase/migrations/002_auth_profiles.sql`
4. `supabase/migrations/003_seed_prints.sql`

`003_seed_prints.sql` は、アプリとAI添削で使うO/E/A/M各100枚、合計400件のプリント情報を `prints` テーブルへ投入します。再実行しても `code` を基準に更新されます。

## Supabase Auth

Dashboardで以下を設定します。

- `Authentication > Sign In / Providers > Email`: Enabled
- 開発中は `Confirm email`: Off
- `Authentication > URL Configuration`
  - Site URL: `http://localhost:5173`
  - Redirect URLs: `http://localhost:5173`

Vercel公開後は、本番URLもSite URL / Redirect URLsに追加します。

## AI添削 Edge Function

本番用の関数は `supabase/functions/grade-essay/index.ts` です。

Supabase CLIを使う場合:

```bash
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase secrets set OPENAI_API_KEY=sk-...
npx supabase secrets set OPENAI_MODEL=gpt-5-mini
npx supabase functions deploy grade-essay
```

`YOUR_PROJECT_REF` は Supabase Project URL のサブドメイン部分です。

例:

```txt
https://ugdgkuhzuruydpynllul.supabase.co
```

この場合は:

```bash
npx supabase link --project-ref ugdgkuhzuruydpynllul
```

## AI添削の流れ

1. フロントエンドが `submissions` に回答を保存します。
2. `grade-essay` Edge Functionへ `{ "submission_id": "uuid" }` を送ります。
3. Edge Functionがログインユーザー本人のsubmissionか確認します。
4. 月間添削回数を確認します。
5. OpenAI API `gpt-5-mini` にJSON Schema付きで添削を依頼します。
6. `feedbacks` に添削結果を保存します。
7. `submissions.status` を `reviewed` に更新します。
8. `ai_usage_logs` に利用ログを保存します。

写真から添削する場合は、スマホで撮影した画像をフロントエンドで縮小し、Edge Functionへ送ります。Edge Function側で画像から英文を読み取り、`submissions` に保存してから同じAI添削フローに進みます。OpenAI APIキーはフロントエンドには置きません。

写真添削を反映するには、Edge Functionを再デプロイします。

```bash
npx supabase functions deploy grade-essay
```

## Vercelデプロイ

Vercelにはフロントエンドだけをデプロイします。OpenAI APIキーはVercelに設定せず、Supabase Edge FunctionのSecretにだけ設定します。

VercelのEnvironment Variablesに以下を設定します。

```bash
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_xxxx
VITE_ENABLE_DEV_UNLOCK=true
```

Build Command:

```bash
npm run build
```

Output Directory:

```bash
dist
```

デプロイ後、Supabase Dashboardで以下を追加します。

- `Authentication > URL Configuration > Site URL`: Vercelの本番URL
- `Authentication > URL Configuration > Redirect URLs`: Vercelの本番URL

## 添削回数制限

- Free: 3回/月
- Premium: 100回/月
- Pro: 300回/月

制限を超えた場合、OpenAI APIは呼び出されません。

## 確認ポイント

AI添削に失敗した場合は、以下を確認します。

- Supabase `functions > grade-essay > Logs`
- `OPENAI_API_KEY` がSupabase Secretに設定されているか
- `prints` テーブルに対象コードが存在するか
- `submissions.status`
- `feedbacks` に行が作られているか
- `ai_usage_logs` に行が作られているか

APIキーや内部エラー詳細は、ユーザー画面には表示しない設計です。
