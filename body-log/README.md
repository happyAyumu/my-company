# 体重・睡眠・美容 記録アプリ（body-log）

体重・睡眠時間・美容（肌・ひげ周り）を毎日記録するための、自分専用の Web アプリです。
データはすべて端末の中（IndexedDB）に保存され、外部には送信されません。

## 開発

```bash
cd body-log
npm install
npm run dev      # 開発サーバー
npm run build    # dist/ に静的ファイルを作る
```

## 公開（GitHub Pages）

`main` ブランチに push すると、`.github/workflows/deploy-body-log.yml` がビルドして GitHub Pages に公開します。
公開先: `https://<ユーザー名>.github.io/my-company/`

初回のみ GitHub のリポジトリ設定が必要です。

1. Settings → General → Danger Zone → Change visibility → Public
2. Settings → Pages → Build and deployment → Source を「GitHub Actions」にする

## バックアップ

設定（右上の歯車）→「バックアップを書き出す」で、記録と写真を 1つの zip にします。
同じ画面の「バックアップから復元する」で、その zip を読み込めます。
