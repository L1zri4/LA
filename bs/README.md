# Leciel Arcadia ビルドシミュレータ

https://l1zri4.github.io/LA/

役割・レベル・STPを入れて能力値とスキル枠を割り振ると、取得できるスキルとスキル設定を確認できます。

## ファイル

| ファイル | 役割 |
|---|---|
| `index.html` | シミュレータ本体（単体で動作。中の内蔵データはオフライン用の予備） |
| `skills.csv` | スキル一覧（**正本**。ページを開くたびにこれを読む） |
| `tools/template.html` / `tools/build.py` | `index.html` の生成元。`python tools/build.py` で内蔵データを最新CSVに更新 |
| `tools/LA ビルドシミュ スキル取得.user.js` | ローカルで使う場合の自動取得（Tampermonkey）。GitHub Pages版では不要 |

## スキル一覧の更新

1. `skills.csv` を編集（列：`スキル名,使用条件,取得条件,効果`、1行目は見出し）
2. commit & push → 数分でサイトに反映

- 行の順番は一覧の表示順になる。既存のビルドコードは並び替えや追加の影響を受けない（スキル名で照合）
- スキル名を変えると、そのスキルを含む既存コードではその枠が空きになる
- Excelで保存する場合は「CSV UTF-8」推奨（Shift_JIS保存でも読める）
- `index.html` の作り直しは任意（オフライン時の予備データが古くなるだけ）
