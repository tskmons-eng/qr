# QR System Plan

## 2026-08-30 お客様注文Functions 常時1台待機

### 目的

- お客様QRで人数確定後に注文を開始する処理と、カートから注文を確定する処理のコールドスタートを減らす。
- 料金対象を顧客体験に直結する最小2本へ限定し、スタッフ・会計・通知など低頻度Functionsまで常時待機させない。

### 変更前バックアップ・現状確認

- 変更前HEAD `98f70d6` に復元タグ `backup/customer-order-warm-instances-before-20260830` を付け、GitHubへpush済み。
- 本番19 FunctionsはNode.js 22 / 256MiB / concurrency 80 / `maxInstances: 20`。現在は全本 `minInstances` 未設定で、無通信時に0台まで縮退する。
- お客様注文送信は `submitCustomerOrderItemsCommandAsia` を本線とし、一時障害時だけ米国 `submitCustomerOrderItemsCommand` へ同一 `clientRequestId` でfallbackする。注文開始は `startCustomerOrderSessionCommand` を使用する。
- Firebase公式の目安では、256MiB・1CPU・concurrency有効の最小1台は1本あたり月約8米ドル。2本で無料枠適用前の目安は月約16米ドルで、実額はリージョン、為替、無料枠、実利用量により変わる。

### 変更方針

- `startCustomerOrderSessionCommand` と `submitCustomerOrderItemsCommandAsia` だけに `minInstances: 1` を設定する。
- 共通Callable factoryは `minInstances` を非負整数として明示検証し、未指定Functionにはfield自体を渡さない。全19本へ広げず対象2本だけを有料待機にする。
- 米国fallback、スタッフ注文、会計、配膳、取消、席移動、予約、通知、集計triggerは `minInstances` 未設定を維持する。
- region、memory、CPU、concurrency、`maxInstances: 20`、注文payload、Firestore transaction、冪等性、Rules、Hosting、既存データは変更しない。

### 検証・段階公開・復元

- factory options、対象2本、非対象Functionを静的checkで固定し、Functions source load、Emulator、`npm run check`、`npm run build`、`git diff --check` を実行する。
- commit/push後、Firebase project `qrproduct-3340b` へ対象2本だけを1本ずつ明示deployする。CLIの月額見積りを記録し、Functions一覧とCloud Run実設定で `minInstances: 1`、Node.js 22、region、`maxInstances: 20`、concurrency 80を確認する。
- 本番ダミー注文は送らず、自然注文のログでコールドスタート減少と処理時間を後続確認する。
- 問題や費用見直し時は復元タグの設定へ戻し、対象2本を `minInstances` 未設定で再deployする。Functions全体、Hosting、Rules、データは巻き戻さない。

### ローカル検証結果

- 共通Callable factoryへ非負整数の `minInstances` 検証を追加し、未指定時はmanifestへfield自体を含めないことを静的checkで固定した。
- `startCustomerOrderSessionCommand` と `submitCustomerOrderItemsCommandAsia` だけが `CUSTOMER_ORDER_MIN_INSTANCES = 1` を使用し、スタッフ東京送信を含む残り17本には設定がないことを確認した。
- Functions sourceの構文・読込、`check:functions-rules-migration`、`check:order-latency-routing`、`check:functions-runtime-upgrade`、全体 `npm.cmd run check`、`npm.cmd run build`、`git diff --check` は成功した。
- Auth / Firestore / Functions Emulatorで全19定義を読み込み、注文開始、顧客・スタッフ同時注文、同一request再送、会計、配膳、取消、席移動、予約、pending集計triggerを含む既存fixtureが成功した。本番データへのダミー注文は作成していない。

## 2026-08-29 お客様メニュー オプション数量調整・会計確認文言整理

### 目的

- タレ・塩などのオプションを選んだ後も、メニュー画面から選択内容ごとに数量を増減できるようにする。
- 会計確認画面の「カートに未注文の商品があります／カートを見る」は表示せず、注文履歴と会計依頼だけに集中できるようにする。

### 現状確認

- オプションなし商品は選択後に `− / 数量 / ＋` が出るが、オプション付き商品は合計数と再選択ボタンだけで、選択したタレ・塩ごとの数量を調整できない。
- カート自体にはオプション別の行と数量が保持され、既存 `updateQuantity` で個別更新・0個時削除ができる。
- 注文履歴から会計確認へ進むと、未注文カート数とカート遷移ボタンが会計操作の途中に表示される。

### 変更方針

- 商品カード内に選択済みオプションを1行ずつ表示し、それぞれへコンパクトな `− / 数量 / ＋` を付ける。別のオプションを追加する既存導線は維持する。
- 同じ商品でもタレ・塩など異なる組合せは、既存cart item ID単位で独立して数量更新する。
- 会計確認から未注文カート警告と `カートを見る` を削除し、下部ナビのカート導線は維持する。
- 注文payload、オプション保存形式、注文送信、会計依頼、Functions、Rules、既存データは変更しない。

### 影響範囲・検証方法

- お客様メニュー商品一覧、メニューページ、注文履歴の会計確認、関連CSS・静的チェック・本計画書。
- `npm run check:customer-cart`、`npm run check:customer-order-status`、`npm run check:option-modal`、`npm run check`、`npm run build`、`git diff --check` を実行する。
- モバイル実画面で、オプション選択後の個別増減、0個削除、別オプション追加、会計確認から不要表示が消えたこと、横方向の表示崩れがないことを確認する。

### ローカル検証結果

- タレ2個・塩1個を追加後、メニューの商品カード内に各選択が別行で表示された。タレだけ3個へ増やし、塩だけ0個へ減らすと塩の行だけ削除され、タレ3個とカート合計3個を維持した。
- オプション選択後も `追加` から別の選択を開けること、390×844で横方向のはみ出しがないことを確認した。
- 未注文商品が3個残る状態で会計確認を開き、「カートに未注文の商品」と `カートを見る` が表示されないことを確認した。会計依頼は送信していない。
- `npm.cmd run check:customer-cart`、`check:customer-order-status`、`check:option-modal`、全体 `npm.cmd run check`、`npm.cmd run build`、`git diff --check` は成功した。

### 本番公開結果

- commit `a9c7d47` をbranch `codex/customer-order-mobile-redesign` へpushし、Firebase project `qrproduct-3340b` のHostingだけを更新した。Functions、Rules、indexes、既存データは変更していない。
- 公開HTMLのasset参照はローカル完成版と一致し、`/`、`/login`、`/order/test-token` はHTTP 200だった。
- 本番の有効な実QRでタレを1個から2個へ増やし、商品カード内の選択名・数量・増減操作とカート合計2個が表示されること、横方向のはみ出しがないことを確認した。このカート操作はブラウザ内の未送信状態だけで、本番注文は作成していない。
- 未注文商品が残る状態の本番会計確認で、「カートに未注文の商品」と `カートを見る` が表示されず、`会計を依頼する` は維持されることを確認した。会計依頼は送信していない。

## 2026-08-29 お客様QR注文画面 モバイル再設計・初回表示高速化

### 目的

- お客様がQRを読み取ってから「人数決定 → 商品追加 → カート確認 → 注文送信 → 注文履歴確認」まで迷わず進める一本の導線へ組み替える。
- モバイル画面では主要操作を先に見せ、スタッフ呼出などの低頻度操作を整理して、商品と注文操作へ集中できるようにする。
- 見た目だけでなく、公開注文画面に不要な管理機能の読み込みと直列データ取得を減らし、初回表示と画面遷移の体感速度を改善する。

### 変更前バックアップ

- 変更前HEAD `b337df7` に復元タグ `backup/customer-order-before-redesign-20260829` を付け、GitHubへpush済み。
- リポジトリ外の `QRシステム-backups/2026-08-29-customer-order-before-redesign` に全Git履歴bundleと変更前 `dist` zipを保存済み。
- 本番Firebaseは調査中・実装中には変更せず、全確認完了後にHostingだけを更新する。Functions / Firestore rules / indexes / storage は今回の画面反映では変更しない。

### 現状確認

- 本番の390×844表示では、下部に `注文` / `カート` / `呼び出し` / `注文確認` が同列で並び、主要導線と低頻度操作が競合している。
- `注文確認` は注文履歴と会計確認の両方を兼ね、画面名と遷移後の目的が一致しない場合がある。
- 商品未選択時にも `−` / 空の数量欄 / `＋` が常時表示され、商品情報より操作部品の占有が大きい。
- 空カートでも画面下部に無効な注文ボタンが固定され、空状態からメニューへ戻る主操作が弱い。
- `App.jsx` が注文画面と同時に管理・スタッフ・画像処理・PDF関連まで読み込む。変更前buildは536 modules、顧客初回表示と無関係な大容量vendor chunkを含む。
- `OrderEntryPage` は席情報の取得後に店舗設定を待ち、その完了後に `MenuPage` がメニュー取得を始めるため、初回表示が直列になっている。
- 本番には東京リージョンの注文送信FunctionsとNode.js 22構成が反映済みだが、現在ブランチのソースはその反映前であるため、既存の検証済み実装を統合して本番とソースを一致させる。

### 変更方針

- 公開注文ルートを認証済み管理ルートから分離し、ルート単位で遅延読み込みする。お客様QRでは管理、PDF、画像変換、スタッフ画面を初回取得しない。
- 席情報が確認できた時点で注文画面を表示し、店舗設定とメニューデータを並行取得する。設定確定前は注文開始・商品追加を安全に無効化する。
- 下部ナビは `メニュー` / `カート` / `履歴・会計` の3導線に整理する。スタッフ呼出は共通ヘッダーの低頻度メニューへ移し、確認シートを維持する。
- 人数画面は主ボタンを短く保ち、自動追加内容は補足文へ分離する。
- 商品行は未選択時に大きな `＋` または `選ぶ` だけを表示し、数量が入った時だけステッパーへ変える。行全体タップは実buttonで構成し、入れ子の操作要素を避ける。
- 空カートは `メニューを見る` を主操作にし、注文済み履歴では状態の重複表示を減らす。会計は履歴確認後に明示的に進める既存の二段階確認を維持する。
- 商品画像は遅延読み込みし、外部Webフォントを初回表示の必須条件から外す。
- 注文、会計、呼出の保存形式、Functions command境界、復旧用 `clientRequestId`、QR URL、Firestore rules、既存データは変更しない。

### 影響範囲

- `src/App.jsx` と認証済みルートシェル、公開注文ルート内の遅延読み込み。
- お客様向け人数、メニュー、商品行、カート、注文履歴、共通ヘッダー、下部ナビ、確認シート、関連CSS。
- お客様向けチェック、初回bundle予算チェック、既存注文速度改善ソースとの統合、および本計画書。
- 管理画面、スタッフ画面、注文データ、会計データ、権限、Rulesは表示・契約を維持する。

### 検証方法

- `npm run check:customer-entry`、`npm run check:customer-cart`、`npm run check:customer-order-status`、`npm run check:option-modal`、`npm run check:order-command-ui` を実行する。
- 東京リージョン送信の既存チェックを統合し、注文payload、fallback、Functions名、本番Functions一覧との整合を確認する。
- 初回buildで公開注文ルートが管理・PDF・画像変換chunkを参照しないことを自動チェックし、変更前後のgzipサイズを比較する。
- `npm run check`、`npm run build`、`git diff --check` を通す。
- 390×844を中心に、人数、読み込み、空メニュー、商品追加、オプション、空カート、注文中、送信中、反映待ち、エラー、履歴、会計確認をローカルブラウザで確認する。
- commit/push後にFirebase既定プロジェクトを再確認し、Hostingのみ反映する。本番asset hash、主要ルートHTTP 200、実QRの読み取り表示を確認する。

### ローカル検証結果

- 変更前buildの初回HTMLはmain、React、Firebase、jsPDF、全画面CSSを先読みし、gzip合計は約461KBだった。再設計後のお客様メニュー到達までの初回経路は約242KBで、約48%削減した。
- 初期CSSは143.88KBから共通4.01KB + お客様用26.55KBへ分離した。管理用127.54KB、PDF、画像変換、HEIC変換はお客様QRの初回経路から外れた。
- `npm.cmd run check` は顧客、スタッフ、管理、権限、注文command、Node.js 22、東京リージョンfallback、構造監査まで全項目成功した。`npm.cmd run build` も成功した。
- 390×844のローカル実画面で、来店人数、商品追加、選択後だけ出る数量操作、空カート、カート注文ボタン、注文履歴、会計確認、スタッフ呼出シートを確認した。管理側の `/login` も分離後のCSSで表示崩れがないことを確認した。
- 本番への注文送信、会計依頼、スタッフ呼出は検証データを作らないため実行していない。既存command契約と失敗復旧は自動チェックで維持を確認した。

### 本番公開結果

- branch `codex/customer-order-mobile-redesign` をGitHubへpushし、Firebase project `qrproduct-3340b` へHostingだけを公開した。Functions、Firestore Rules / indexes、Storage Rules、既存データは変更していない。
- 公開HTMLが参照する `/assets/index-C-DEM1pj.js`、`/assets/index-CyK1AOUa.css`、`/assets/vendor-react-Ddk2dSdh.js` はローカル完成版と一致した。`/`、`/login`、`/admin`、`/owner`、`/staff`、`/order/test-token` はすべてHTTP 200だった。
- 本番の有効な実QRを390×844で読み取り、共通ヘッダー、低頻度操作メニュー、`メニュー` / `カート` / `履歴・会計` の3導線、新しい商品追加UIが表示されることを確認した。画面幅390pxに対して本文幅390pxで、横方向のはみ出しはなかった。
- 分離後の本番 `/login` でスタッフログイン画面が表示されることを確認した。公開後のFunctions一覧は19本すべてNode.js 22のままで、Hosting公開によるFunctions変更がないことを確認した。
- `npm.cmd run check:order-safety-release-gate -- --final` と `npm.cmd run check:restaurant-ux-release-gate -- --final` は、Functions Emulatorの同時注文・重複防止・権限・会計・席移動・集計triggerを含めて成功した。
- 読み取り専用の既存データ監査は19卓、未提供item 58件、集計drift 8卓、item参照不整合0件だった。既存driftは今回のUI公開と分離し、自動修復していない。
- 本番では注文送信、会計依頼、スタッフ呼出を実行せず、実運用データを増やさない表示確認に限定した。

## 2026-07-14 Cloud Functions Node.js 22 / SDK更新

### 目的

- 2026-10-30に廃止予定のNode.js 20から、Firebaseが正式対応するNode.js 22へFunctions runtimeを移行する。
- `firebase-functions` / `firebase-admin`を現行コードと互換な安定版へ更新し、既知の不具合・脆弱性修正を取り込む。
- 注文、集計、通知、予約到着処理の動作と既存リージョン、scale設定、権限境界を維持し、一括更新による本番影響を避ける。

### 現状確認

- 本番FunctionsはNode.js 20で稼働中。Google Cloudの公開日程ではNode.js 20は2026-04-30にdeprecated、2026-10-30にdecommission予定。
- `firebase.json`は`nodejs20`、`functions/package.json`はengine `20`。lock済み実体は`firebase-functions 5.1.1` / `firebase-admin 12.7.0`。
- 更新前のFunctions production dependency監査はcritical 0 / high 4 / moderate 13 / low 1。
- Firebase CLIは15.23.0でNode.js 22のdeploy要件を満たす。Functionsコードはv2の明示importとAdmin SDK modular importを使い、v7で削除された`functions.config()`やAdmin v13で削除された旧Messaging APIを使っていない。
- 最新`firebase-admin 14.1.0`はNode.js 22対応だが、安定版`firebase-functions 7.2.5`のpeer範囲はAdmin 13まで。今回は互換範囲内の`firebase-admin 13.10.0`を選ぶ。
- 本番19関数はasia-northeast1が6本、us-central1が13本で、すべてNode.js 20 / ACTIVE。`minInstances`は全関数で未設定、memory 256MiB、concurrency 80を維持している。
- 本番では全注文Callable 13本、pending集計trigger 3本、`notifyStaff`に`maxInstances: 20`が設定済みだが、現sourceは東京注文Callable 2本以外の上限を明示していない。SDK更新deployで既存上限を失わないよう、runtime更新前にsourceと本番設定を一致させる。
- Functions SDK v7では未指定のreset可能optionをplatform既定値へ戻すため、更新前に上限未設定だったevent functionも単純な再deployで`maxInstances: 20`になる。`maxInstances: 0`もFirebase deployでは20へ正規化されることを本番で確認した。

### 変更方針

- runtime指定を`nodejs22` / engine `22`へそろえる。
- 既存依存だけを`firebase-functions 7.2.5`、`firebase-admin 13.10.0`へ更新し、lockfileを再生成する。新しい依存パッケージは追加しない。
- package / lock / import / runtime / emulator初期化を固定する専用checkを追加し、今後Node.js 20や互換外Adminへ戻らないようにする。
- 全注文Callableとevent / schedule Functionsを`maxInstances: 20`へsourceで統一する。`notifyReservationCreated`と`processReservationArrivals`だけは未設定から20への変更になるが、concurrency 80との組合せで最大1,600並列を確保し、実運用を妨げず暴走・従量課金を抑える安全上限として採用する。
- CommonJS、既存trigger名、region、`minInstances`、メモリ、concurrency、Firestore transaction、認証検証は変更しない。
- Hosting、Firestore Rules / indexes、Storage Rules、クライアントasset、既存データは変更しない。

### 段階公開

- 先に東京注文Callableをcanary更新する。クライアントは一時障害時に同一`clientRequestId`で既存米国Callableへfallbackできるため、runtime問題を注文重複なしで退避できる。
- canaryのruntime・scale設定・ERRORログを確認後、注文Callable、Firestore trigger、通知・scheduleを10本以下の明示groupに分けて更新する。Functions全体deployは行わない。
- 公開前後に直近の注文失敗、pending-count drift、Functions ERRORログを読み取り専用で比較する。本番ダミー注文や通知は作らない。
- 問題時は本番scale上限をsourceへ反映したNode.js 20 rollback基準から、対象functionだけを再deployする。上限未反映の`93e13e5`をそのままrollback元にはせず、HostingやRulesは戻さない。

### 検証方法

- Node.js 22実体でclean `npm ci`、`node --check`、Functions source load、専用runtime checkとFunctions Emulatorを実行する。その後`npm.cmd run check`、`npm.cmd run build`、`git diff --check`を実行する。
- Auth / Firestore / Functions Emulatorで注文の正常系、同時再送、権限拒否、会計、席移動、集計triggerを確認する。
- `npm.cmd audit --omit=dev`で更新前後を比較し、残る脆弱性はpackage名と到達可能性を確認する。
- 各deploy後に`functions:list`とCloud Run実設定でNode.js 22、region、scale上限を確認し、ERRORログと注文失敗監査が増えていないことを確認する。

### ローカル検証結果

- 本番scale上限をsourceへ固定したNode.js 20 rollback基準をcommit `aa996d6`として先に作成した。
- Node.js 22.23.1実体でFunctions dependencyのclean `npm ci`、全Functions JavaScriptのsyntax check、`functions/index.js`読込、runtime / migration / latency routing checkが成功した。
- Firebase CLI 15.23.0自体をNode.js 22で起動し、Functions Emulatorが`Using node@22 from host`と認識した状態で注文・会計・席移動・予約案内・pending集計trigger・予約通知triggerの検証が成功した。全19定義を読み込み、test processもNode.js 22.23.1だった。
- `npm.cmd run check`、`npm.cmd run build`、`git diff --check`は成功した。scheduleはPub/Sub Emulator未起動のためローカル実行対象外で、最後に単独deployして本番の毎分成功ログを確認する。
- Functions production dependency監査は更新前のcritical 0 / high 4 / moderate 13 / low 1から、critical 0 / high 0 / moderate 8 / low 0へ改善した。残る8件はFirestore / Storage経由の間接`uuid` advisoryで、互換外Admin 14への更新や`npm audit fix --force`は行わない。
- `notifyReservationCreated`の初回Node.js 22 deploy後、SDK v7のplatform resetにより本番`maxInstances`が未設定から20へ変わることを実測した。`maxInstances: 0`で再deployしても20へ正規化されたため、外部設定を手動で残す構造にはせず、同上限をsourceへ明示して全Functionsを管理可能な状態にする。

### 本番公開結果

- branch `codex/functions-runtime-node22`をpushし、Firebase project `qrproduct-3340b`へ対象名を明示した段階deployだけを行った。Functions全体deploy、Hosting、Firestore Rules / indexes、Storage Rules、本番データ変更は行っていない。
- 東京顧客注文1本をcanaryにし、東京スタッフ、米国fallback、低頻度Callable、セッション、取消、配膳、会計、予約通知、スタッフ通知、pending集計trigger、scheduleの順に更新した。各段階でruntime / state / scale設定、Cloud Run ERROR、注文失敗を確認した。
- 全19本がNode.js 22 / ACTIVE。asia-northeast1 6本、us-central1 13本、全本256MiB / concurrency 80 / `minInstances`未設定 / `maxInstances: 20`である。
- `notifyReservationCreated`と`processReservationArrivals`だけはSDK v7更新前の上限未設定から`maxInstances: 20`へ変更した。1関数あたり最大1,600並列を確保したまま、従量課金の暴走を抑えるsource管理上限として採用した。
- 全Functionsの直近75分Cloud Run ERRORは0件、`orderCommandFailures`も直近75分0件だった。本番ダミー注文・通知は作成していない。
- pending-count監査はtrigger更新前後とも19席 / 未提供item 50件 / drift 7席 / item参照不整合0件で一致した。既存driftは今回のruntime更新と分離し、自動修復していない。
- `processReservationArrivals`はScheduler `ENABLED` / `every 1 minutes` / `Asia/Tokyo`を維持し、Node.js 22更新後の自然実行が3回連続HTTP 200だった。
- Hostingの公開assetは`/assets/index-DGZ0_1if.js`のままで、注文速度改善公開時のassetとSHA-256が一致した。`/`、`/order`、`/staff`、`/admin/sales`はHTTP 200だった。
- deploy時に既存`notifyStaff`がus-central1、Firestore triggerがasia-northeast1というcross-region警告が継続した。今回のruntime更新ではregionを移動せず、別名移行が必要な将来の速度改善課題として残す。

## 2026-07-13 注文送信レイテンシ無料改善 Phase 1

### 目的

- 月額の常駐費用を増やさず、顧客・スタッフの注文送信にかかる実時間を短縮する。
- Functions本線、Firestore transaction、`clientRequestId`冪等性、送信復旧を維持し、速度目的で安全性を下げない。
- 成功注文の処理時間を匿名の区間ログで測定し、改善前後を推測ではなくp50 / p95で判断できるようにする。

### 現状確認

- 本番Firestoreは`asia-northeast1`、注文Callable Functionsは`us-central1`で、商品確認とtransactionが地域間通信になっている。
- 過去7日の`submitCustomerOrderItemsCommand`成功81件は、Cloud Run request latencyがp50約2.0秒、p95約3.2秒。7日間にcontainer startup 24回があり、startup latencyはp50約1.33秒。
- 商品確認はカート行ごとにproduct、必要時categoryを読み、その後customerはdedupe item→order、staffはdedupe item→order→tableをtransaction内で逐次取得する。
- 成功時はCloud Run全体時間しかなく、商品確認とtransactionの区間時間が記録されていない。
- 会計履歴branch `codex/sales-history-attribution` のcommit `27541bb`はRules / Hosting公開済みで、Functionsは未変更。今回のbranchは同commitから分離している。

### 変更方針

- `asia-northeast1`に顧客注文送信・スタッフ注文送信の別名Callableを追加し、既存`us-central1` Functionsは削除・変更せずrollback先として残す。
- クライアントは東京Callableを優先し、到達不能・一時障害に限り同一`clientRequestId`のまま既存米国Callableへfallbackする。業務エラー・権限エラーではfallbackしない。
- 商品IDをrequest内で重複排除してAdmin SDK `getAll()`で取得し、必要categoryも一括取得する。transactionの独立したdocument readも`getAll()`へまとめる。
- Callable全体、商品確認、transactionのdurationを、店舗・席・注文・request IDを含めない構造化ログへ出す。
- `minInstances`、有料サービス、新規依存、クライアント直接Firestore書込への復帰は行わない。新東京Callableは既存経路と同じ`maxInstances: 20`を上限にする。

### 影響範囲

- 注文Callable factory / exports、顧客・スタッフ注文handler、Functions呼出しservice。
- Functions mainline / migration / observabilityの静的check、Functions emulator検証、注文信頼性ドキュメント、本計画書。
- Firestore rules / indexes / Storage、既存データ、会計・席移動・提供済みcommand、会計履歴UIは変更しない。

### 検証・公開方法

- `node --check`、注文command関連check、`npm.cmd run check`、`npm.cmd run build`、`git diff --check`を通す。
- Auth / Firestore / Functions Emulatorで東京別名Callableの顧客・スタッフ正常系、同一request再送、権限拒否、同時実行を確認する。
- 東京Callable 2本だけを先にdeployし、`functions:list`でregionを確認する。旧米国Callableは残す。
- その後Hostingをdeployし、公開assetが東京別名とregion指定、米国fallbackを含むことを確認する。本番へのダミー注文は送らない。
- 公開後はCloud Run成功latencyと失敗監査を読み取り専用で比較する。即時の利用件数が少ない場合は、測定待ちを未達ではなく継続観測として明記する。

### 検証結果

- `npm.cmd run check`、`npm.cmd run build`、`git diff --check` は成功した。
- Auth / Firestore / Functions Emulatorで東京別名Callable 2本の正常送信、同一requestの同時再送・完了後再送、スタッフ権限拒否、`pendingCount`重複防止を確認した。
- 東京別名Callable 2本がEmulator上で`asia-northeast1`として初期化され、既存米国Callableも残ることを確認した。
- 一時障害だけを米国fallback対象とし、入力・権限・業務エラーを対象外にするfixture、および`minInstances`未設定を静的checkで固定した。
- 初回Functions公開後の実設定確認で最大スケール上限が未設定だったため、Hosting切替前に`maxInstances: 20`を明示する安全修正を追加した。
- Firebase project `qrproduct-3340b`へ東京別名Callable 2本だけを公開した。両方とも`asia-northeast1` / ACTIVE / 256MiB / 1CPU / concurrency 80、`minInstances`未設定（scale to zero）、`maxInstances: 20`で、既存米国Callable 2本もACTIVEのまま残っている。
- 公開直前の本番確認で注文更新が直近15分以内にあったため、既存画面に影響しないFunctions追加だけを先行し、注文・席・未提供明細の更新が15分間0件になってからHostingを公開した。
- Hosting公開後の`/assets/index-DGZ0_1if.js`はローカルbuildとSHA-256が一致し、東京別名2本、`asia-northeast1`、`us-central1` fallbackを含む。`/`、`/order`、`/staff`、`/admin/sales`はHTTP 200だった。
- 公開後の直近15分`orderCommandFailures`は0件、東京Callable 2本の直近30分ERRORログも0件だった。本番へのダミー注文は送っていないため、改善後latencyのp50 / p95は実利用サンプル待ちとする。
- pending-count監査では19席中8席に既存drift、未提供item 55件、item参照不整合0件があり、今回の公開前後で件数は変わっていない。速度改善と分離し、本番データの自動修復は行っていない。
- 公開時にNode.js 20の2026-10-30廃止予定と`firebase-functions`旧版の警告が出た。依存更新は破壊的変更を含み得るため今回の無料速度改善には混ぜず、期限前の別作業として残す。

## 2026-07-13 会計履歴・担当別売上と管理画面UI改善

### 目的

- 保存済みの全会計を日付・期間・担当別に確認し、会計後に1名の担当を設定できるようにする。
- 既存の会計確定処理と本日・レジ締め導線を維持しながら、スマホ中心の管理画面を自然な情報構造へ整える。
- 担当別の確定売上額をCSVでも確認できるようにし、ユーザー様が後から割合計算しやすい状態にする。

### 現状確認

- 売上サービスは店舗の `checks` を全件取得しているが、画面は当日分だけを表示している。
- 過去日はレジ締め集計だけで、会計行から商品明細へ進む導線がない。
- 390px幅では管理ヘッダーと7個の管理タブが極端に折り返され、画面上部を大きく占有する。
- `操作履歴` は会計一覧ではなくスタッフ操作ログであり、割引会計を補完する処理には二重表示の可能性がある。

### 変更方針

- 売上画面は `本日・レジ締め` を初期表示のまま残し、`会計履歴` をページ内の第2表示として追加する。
- 担当情報は会計本体へ書き込まず、`salesAssignees` と `salesAttributions` に分離する。顧客名、割合、報酬額は保存・計算しない。
- 担当は1会計1名、会計後に設定する。売上額は保存済みの割引後確定額 `check.total` を正とする。
- スマホ管理ヘッダーは主要導線だけを残し、管理タブは44px以上・折返しなしの横スクロールへ変更する。
- CSV、担当者管理は低頻度メニューへまとめ、レジ締めは内容確認ダイアログを通して実行する。
- 会計詳細はスマホで下部シート、タブレット以上で中央ダイアログとし、明細は開いた時だけ取得する。
- `closeRegister` 権限者は担当設定、`manageStaff` 権限者は担当マスタ管理を行う。物理削除と店舗間アクセスはRulesで禁止する。
- 会計確定処理、`checks`、`orders`、`tables`、Functions、保存済み履歴には変更を加えない。

### 影響範囲

- 管理共通ヘッダー・管理ナビ、売上・レジ締め、操作ログの表示とレスポンシブCSS。
- 売上履歴・担当集計・会計詳細・担当編集のUI、サービス、純粋計算ロジック。
- Firestore Rules、売上／操作ログのチェック、および本計画書。Functionsと既存データの移行は対象外。

### 検証方法

- 当月、月境界、任意期間、全期間、担当あり／未設定／改名／無効化、旧会計／新会計、明細欠損を自動チェックする。
- Rulesエミュレータまたはrulesチェックで権限、他店舗拒否、削除拒否、担当変更と操作ログ保存を確認する。
- 390×844、768〜820px、デスクトップで管理画面を確認し、管理タブ以外の横スクロールがないことを確認する。
- `npm run check`、`npm run build`、`git diff --check` を通し、Rulesを先に公開した後でHostingを公開する。

### 検証結果

- `npm.cmd run check`、`npm.cmd run build`、`git diff --check` は成功した。
- `TZ=UTC` 相当でも `check:admin-sales` を実行し、JSTの日付・月境界テストが成功した。
- Auth / Firestore Emulator のRESTテストで、権限別の正常系、自己権限昇格、監査ログなし、他店舗、actor偽装、ID差し替え、無効担当、更新・物理削除の拒否を確認した。
- 公開直前の本番確認では当日の会計は0件だった。スタッフ画面に残る使用中表示は約569時間前の状態で、現在進行中の利用ではないことを読み取り専用で確認した。
- 本番データへの担当マスタ・担当割当のダミー書き込みは行わない。
- Firebase project `qrproduct-3340b` へ Firestore Rules を先に公開し、警告がないことを確認した後で Hosting を公開した。Functions は変更・公開していない。
- 本番 `https://qrproduct-3340b.web.app` を認証済みChromeで読み取り専用確認した。390×844では全管理ルートの本文に横スクロールがなく、管理タブだけが意図どおり横スクロールする。
- 820×1180では会計詳細が幅680px、上下24pxの中央ダイアログになり、背景スクロール停止、Escで閉じる、元の会計カードへのフォーカス復帰を確認した。1280×900でも本文と管理ナビの横はみ出しはない。
- 会計履歴は前月移動後のURL条件が再読込で維持され、過去会計の保存済み明細、支払情報、担当選択欄を表示できた。保存操作は行っていない。
- 操作ログの空状態、新しい担当変更／担当者管理フィルター、CSV無効状態を本番で確認した。本番データへの担当マスタ・担当割当を含む書き込みは一切行っていない。

## 2026-06-21 Google Login Popup Closed Fallback Hotfix

### Purpose

- Google ログインで `Googleログインに失敗しました` が表示され、認証へ進めない状態を直す。
- Popup がブラウザ側で即閉じ扱いになった場合も、汎用エラーで止めず redirect 認証へ fallback する。
- 失敗時は原因切り分けができるよう、ユーザー様向けの短い補足を表示する。

### Current Confirmation

- Live Hosting asset には Firebase project / auth domain が含まれており、Firebase 設定が丸ごと抜けた状態ではない。
- 現在の `shouldFallbackToRedirect` は `auth/popup-blocked` などを拾うが、popup が閉じた扱いの `auth/popup-closed-by-user` は fallback 対象外。
- そのため popup が開けても即閉じ扱いになる環境では、redirect に進まず `Googleログインに失敗しました` で止まる。

### Change Policy

- `auth/popup-closed-by-user` を redirect fallback 対象に追加する。
- redirect fallback へ入る前に匿名スタッフセッションがあれば sign-out する既存方針は維持する。
- それでも失敗した場合は、Firebase Auth の代表的な失敗理由を短く表示する。
- 店舗、注文、会計、スタッフ権限、Firestore rules、Functions、indexes、storage は変更しない。

### Verification

- `git diff --check`
- `npm run check:staff-entry`
- `npm run check`
- `npm run build`
- Live Hosting asset に `auth/popup-closed-by-user` fallback が含まれることを確認する。

### Verification Results

- `git diff --check`, `npm run check:staff-entry`, `npm run check`, and `npm run build` passed.
- Commit `1107004` was pushed to `origin/codex/staff-entry-session-recovery`.
- Hosting only was deployed to Firebase project `qrproduct-3340b`; Functions, Firestore rules, indexes, and Storage rules were not deployed.
- Live Hosting assets are `assets/index-sn8uPldh.js` and `assets/index-Dv_FLdsB.css`.
- Route checks returned 200 for `/`, `/login`, `/admin`, `/owner`, `/staff`, and `/order/test-token`.
- The live JS asset contains `auth/popup-closed-by-user` fallback and the new user-facing Firebase Auth failure hints.

## 2026-06-21 Google Login Button No-Action Hotfix

### Purpose

- `/login` の Google ログインボタンを押しても、Google 認証画面へ遷移せず、画面上の反応も出ない状態を直す。
- Google ログイン中はユーザー様が「押せたかどうか」を判断できる表示を出し、メールログインの loading と Google ボタンを同じ状態で潰さない。

### Current Confirmation

- Live `/login` で Google ボタンは `disabled=false`、`pointer-events=auto`、`elementFromPoint` でもボタン自身を指している。
- クリックイベントは発火しているが、`signInWithRedirect` 固定の現在実装では、公開ページ上でトップレベルURLが Google 認証画面へ移らず `/login` のまま残る。
- Console error は出ていないため、UI上は「何も起きない」見え方になる。

### Change Policy

- Google ログインはクリック直後のユーザー操作に強い `signInWithPopup` を先に試す。
- Popup がブロックされた、または popup 非対応環境の場合だけ `signInWithRedirect` へ fallback する。
- Google ログイン用の進行表示を `googleLoading` として分離し、メールログインの `loading` では Google ボタンを無効化しない。
- 店舗、注文、会計、スタッフ権限、Firestore rules、Functions、indexes、storage は変更しない。

### Verification

- `git diff --check`
- `npm run check:staff-entry`
- `npm run check`
- `npm run build`
- Live `/login` Google ボタンのクリック後に Google 認証画面または popup が開くことを確認する。

### Verification Results

- `git diff --check`, `npm run check:staff-entry`, `npm run check`, and `npm run build` passed.
- Commit `9590c92` was pushed to `origin/codex/staff-entry-session-recovery`.
- Hosting only was deployed to Firebase project `qrproduct-3340b`; Functions, Firestore rules, indexes, and Storage rules were not deployed.
- Live Hosting assets are `assets/index-B8tp9KPB.js` and `assets/index-Dv_FLdsB.css`.
- Route checks returned 200 for `/`, `/login`, `/admin`, `/owner`, `/staff`, and `/order/test-token`.
- Live `/login` DOM shows the Google button as `disabled=false`, `pointer-events=auto`, and the hit-test target is the button itself.
- The in-app browser automation could not conclusively verify popup creation, so the final Google account sign-in step was not completed by automation.

## 2026-06-21 Checkout Cash Input Fixed Action Area

### Purpose

- 会計画面で、注文明細や割引・合計の確認は必要に応じてスクロールしても、`お預かり金額` の入力フォームと `会計を確定する` 操作はスクロール領域へ入れない。
- 現場で会計時に入力欄を探す状態を避け、下部の操作エリアで金額入力から確定まで完結させる。

### Current Confirmation

- `CheckoutPage` は `CheckoutPaymentPanel` を `.checkout-page__payment` に置いている。
- `.checkout-page__payment` は `overflow-y: auto` のため、`CheckoutPaymentPanel` 内の `お預かり金額` 入力欄までスクロール対象になっている。
- `CheckoutConfirmBar` は固定配置だが、現状は確定ボタンとエラー表示だけを持つ。

### Change Policy

- `CheckoutPaymentPanel` は商品小計、割引、合計表示までに限定する。
- `お預かり金額` のプリセット、入力欄、不足/お釣り表示は固定の `CheckoutConfirmBar` 側へ移す。
- 会計計算、会計確定command、注文/会計データ構造、Firestore rules、Functions、indexes、storage は変更しない。

### Verification

- `git diff --check`
- `npm run check:checkout`
- `npm run check:staff-table-detail`
- `npm run check`
- `npm run build`

### Verification Results

- `git diff --check`, `npm run check:checkout`, `npm run check:staff-table-detail`, `npm run check`, and `npm run build` passed.
- Commit `9f88f7b` was pushed to `origin/codex/staff-entry-session-recovery`.
- Hosting only was deployed to Firebase project `qrproduct-3340b`; Functions, Firestore rules, indexes, and Storage rules were not deployed.
- Live Hosting assets are `assets/index-Dm8k8zYH.js` and `assets/index-DcmINQBY.css`.
- Route checks returned 200 for `/`, `/login`, `/admin`, `/owner`, `/staff`, and `/order/test-token`.

## 2026-06-21 Google Login Redirect Recovery Hotfix

### Purpose

- Google認証後に `/login` へ戻ったまま、元の管理画面へ遷移しない再発を止める。
- 以前の安定策どおり、Googleログインはredirect本線に戻し、Googleボタンをメールログイン用の共有loadingで無効化しない。

### Current Confirmation

- Live Hosting assetには Firebase `apiKey` / `authDomain` が入っており、API設定が丸ごと抜けた状態ではない。
- 現在の `staffLoginService` は `signInWithPopup()` を優先し、失敗時だけ `signInWithRedirect()` へfallbackしている。
- 現在の `LoginPage` はGoogleボタンにも `loading` を渡しており、redirectが滞った場合にGoogleボタンが無効化される再発リスクがある。

### Change Policy

- Googleログインは `signInWithRedirect()` のみに戻す。
- redirect前に `staffLoginRedirect` を sessionStorage/localStorage に保存し、復帰後に `getRedirectResult()` または `onAuthStateChanged` から安全な `next` へ戻す。
- Googleボタンはメールログインの `loading` でdisabledにしない。
- 店舗、注文、会計、スタッフ、Firestore rules、Functions、indexes、storage は変更しない。

### Verification

- `git diff --check`
- `npm run check:staff-entry`
- `npm run check`
- `npm run build`

### Verification Results

- Confirmed the live Hosting asset contains Firebase `apiKey` / `authDomain`; this was not an API config omission.
- `git diff --check`, `npm run check:staff-entry`, `npm run check`, and `npm run build` passed.
- Commit `2dd4c83` was pushed to `origin/codex/staff-entry-session-recovery`.
- Hosting only was deployed to `qrproduct-3340b`; live assets are `assets/index-DnG5Np_Z.js` and `assets/index-DZyFSCOK.css`.
- `/`, `/login`, `/admin`, `/owner`, `/staff`, and `/order/test-token` returned HTTP 200.
- Live `/login?next=%2Fadmin` shows the Google button enabled, `pointer-events: auto`, and no browser console errors on initial load.
- Functions / Firestore rules / indexes / storage were not deployed because this hotfix only changed login client code, a check script, and docs.

## 2026-06-21 Owner Store Detail And Super Admin Management

### Purpose

- `/owner` の店舗一覧から、その店舗の詳細を把握し、スーパー管理者が対象店舗のオーナーと同じ管理画面権限で入れるようにする。
- 権限付与はユーザー様のスーパー管理者アカウントに限定し、通常オーナー・店舗管理者・スタッフの導線は変えない。

### Current Confirmation

- Firestore rules は `isSuper()` を `canManageStore(storeId)` に含めており、Firebase権限上はスーパー管理者が全店舗を管理できる。
- 現在の `StoreContext` は Googleユーザーの `storeId` を `storeAdminEmails/{email}` または自分の `uid` に決めるため、`/owner` で見ている任意店舗を管理画面の対象店舗にする導線がない。
- `/owner` の店舗一覧は店舗名、店舗コード、名義メール、売上、未会計、最終利用を表示しているが、対象店舗として管理画面へ入る操作がない。

### Change Policy

- スーパー管理者だけが `ownerActiveStoreId` を選べるようにし、通常ユーザーが localStorage を触っても無視する。
- 選択した `storeId` は `stores/{storeId}` が存在する場合だけ管理対象にする。存在しない場合は解除する。
- 管理画面では選択中の店舗が分かるバナーを表示し、`/owner` に戻る導線を置く。
- `stores`, `orders`, `orderItems`, `checks`, `tables`, `products`, `staffMembers` のデータ移行や削除はしない。Firestore rules は既存の `isSuper()` 境界を使い、広げない。

### Impact Scope

- `src/contexts/StoreContext.jsx`
- `src/pages/owner/OwnerPage.jsx`
- `src/components/owner/OwnerStoreDashboard.jsx`
- `src/pages/admin/AdminLayout.jsx`
- `src/styles/owner-dashboard.css`
- `src/styles/admin-layout.css`
- `scripts/check-owner-dashboard.mjs`
- `scripts/check-store-admin-assignment.mjs`

### Verification

- `git diff --check`
- `npm run check:owner-dashboard`
- `npm run check:store-admin-assignment`
- `npm run check:owner-access`
- `npm run check`
- `npm run build`

### Verification Results

- `git diff --check`, `npm run check:owner-dashboard`, `npm run check:store-admin-assignment`, `npm run check:owner-access`, `npm run check:staff-entry`, `npm run check:owner-settings-sync-release-gate`, `npm run check`, and `npm run build` passed.
- Commit `de1b6db` was pushed to `origin/codex/staff-entry-session-recovery`.
- Hosting only was deployed to `qrproduct-3340b`; live assets are `assets/index-DGYLo6IW.js` and `assets/index-DZyFSCOK.css`.
- `/`, `/login`, `/admin`, `/owner`, `/staff`, and `/order/test-token` returned HTTP 200.
- Functions / Firestore rules / indexes / storage were not deployed because this change only affected client UI, context state, checks, styles, and docs.

## 2026-06-20 Owner Settings Sync Round 1

### Purpose

- スーパー管理者、店舗オーナー、スタッフ設定の境界を壊さず、許可メール、店舗名、管理者メール名義を同期して扱えるようにする。
- 注文パネルのフード/ドリンク表示は、各項目に `ドリンク` / `フード` と文字を付けるのではなく、枠色などの無駄のないUIで見分ける。

### Current Confirmation

- `/owner` の許可メールは `ownerAccessService`、管理画面の `管理者・キッチン アクセス許可` は `settingsService` から同じ `allowedEmails` を扱っているが、購読方式と保存ドキュメント形状がそろっていない。
- `/owner` の店舗一覧は `storeAdminEmails/{email}` と `stores/{storeId}.ownerEmail` を更新する管理者メール変更UIを既に持っている。
- `StoreContext` は `stores/{storeId}.storeName` を作成し、`ownerDashboard` は同じ店舗名を表示しているが、管理画面の店舗コードカードには店舗名表示・編集がない。
- 顧客カテゴリタブは現在、各カテゴリに `ドリンク` / `フード` の文字バッジを表示している。

### User UI Preference

- ユーザー様は、フード/ドリンクの分類を各項目の文字ラベルで増やすより、枠色や控えめな視覚差で処理する無駄のないUIを重視している。
- 店舗名は店舗コードより上に表示し、店舗名設定は管理者・キッチンアクセス許可の近くへ整理する。

### Parallel Work Documents

- `docs/owner-settings-sync-round1/README.md`
- `docs/owner-settings-sync-round1/01-owner-allowed-email-sync.md`
- `docs/owner-settings-sync-round1/02-order-category-visual-treatment.md`
- `docs/owner-settings-sync-round1/03-store-name-settings-sync.md`
- `docs/owner-settings-sync-round1/04-owner-admin-email-transfer.md`
- `docs/owner-settings-sync-round1/05-integration-release-gate.md`

### Change Policy

- `allowedEmails` はGoogleログイン許可、`storeAdminEmails` は既存店舗への管理者割当として責務を分けたままにする。
- 店舗名変更や管理者メール名義変更で `storeId` を作り直さない。注文、会計、商品、席、スタッフデータは移行しない。
- 各担当MD単体では Firebase deploy をしない。最終deploy判断は `05-integration-release-gate.md` に集約する。

### 04 Owner Admin Email Transfer Responsibility

- Purpose: `/owner` の店舗一覧で、既存店舗データを保持したまま管理者の名義メールだけを変更できることを固定する。
- Current confirmation: `OwnerStoreDashboard` は店舗ごとの管理者メール入力を持ち、`updateStoreAdminEmail()` は `storeAdminEmails/{email}` と `stores/{storeId}.ownerEmail` を `writeBatch()` で更新している。
- Change policy: UI表記はデータ引き継ぎが分かる `名義メール` 表現へ寄せ、メール変更で `storeId` や注文、会計、商品、席、スタッフデータを作り直さないことをチェックで固定する。
- Impact scope: `src/components/owner/OwnerStoreDashboard.jsx`, `src/services/ownerDashboardService.js`, `scripts/check-store-admin-assignment.mjs`, `docs/owner-settings-sync-round1/04-owner-admin-email-transfer.md`, and this plan.
- Verification: `npm run check:store-admin-assignment`, `npm run check:owner-dashboard`, `npm run check:owner-access`, `npm run check`, `npm run build`, and `git diff --check`.

### Verification

- `git diff --check`
- `npm run check:owner-access`
- `npm run check:owner-dashboard`
- `npm run check:store-admin-assignment`
- `npm run check:settings`
- `npm run check:customer-cart`
- `npm run check`
- `npm run build`

### 01 Owner Allowed Email Sync Responsibility

- Purpose: `/owner` と管理画面の `管理者・キッチン アクセス許可` を、同じ `allowedEmails/{email}` の形と同期方式で扱う。
- Current confirmation: `/owner` はリアルタイム購読で `{ email, addedAt, addedBy }` を保存し、管理画面は一回読み込みで `{ addedAt }` のみ保存している。
- Change policy: `allowedEmails` のFirestore読み書きは `ownerAccessService` の共通境界へ寄せ、管理画面は `settingsService` 経由で同じ境界を使う。`storeAdminEmails` には触れない。
- Impact scope: `src/lib/ownerAccess.js`, `src/lib/settingsConfig.js`, `src/services/ownerAccessService.js`, `src/services/settingsService.js`, `src/pages/admin/SettingsPage.jsx`, `scripts/check-owner-access.mjs`, `scripts/check-settings-config.mjs`, and `docs/owner-settings-sync-round1/01-owner-allowed-email-sync.md`.
- Verification: `git diff --check`, `npm run check:owner-access`, `npm run check:settings`, `npm run check`, and `npm run build`.

### 02 Order Category Visual Treatment Responsibility

- Purpose: 顧客注文パネルのカテゴリタブで、`ドリンク` / `フード` の可視文字バッジを増やさず、省スペースな視覚差で分類を残す。
- Current confirmation: 対象は `CustomerCategoryTabs` の顧客カテゴリタブ。スタッフ席詳細とキッチンフィルタは操作意味を持つ別表示のため、この担当では触らない。
- Change policy: category group は既存の `category.group` を使い、ボタン自体のクラス、左ライン、控えめな点、薄い背景差で表現する。画面上の常時表示テキストはカテゴリ名を主役にする。
- Impact scope: `src/components/order/CustomerCategoryTabs.jsx`, `src/styles/customer-menu.css`, `scripts/check-customer-cart.mjs`, and `docs/owner-settings-sync-round1/02-order-category-visual-treatment.md`.
- Verification: `git diff --check`, `npm run check:customer-cart`, `npm run check`, and `npm run build`.

### 03 Store Name Settings Sync Responsibility

- Purpose: 店舗コード設定の上に店舗名を表示し、管理画面と `/owner` の店舗名編集を同じ `stores/{storeId}.storeName` に集約する。
- Current confirmation: `StoreContext` は新規店舗に `storeName` を作り、`ownerDashboard` は表示済みだが、管理画面の `StoreCodeCard` は店舗コードのみ、`SettingsPage` は店舗名の読み込み/保存を持っていない。
- Change policy: `settingsService` と `ownerDashboardService` は `stores/{storeId}.storeName` だけを更新し、`storeId`、店舗コード、QR URL、注文、会計、商品、席、スタッフデータは変更しない。空白名は `店舗名未設定` に正規化し、長い名称は上限で崩れを防ぐ。
- Impact scope: `src/lib/storeIdentity.js`, `src/services/settingsService.js`, `src/pages/admin/SettingsPage.jsx`, `src/components/admin/StoreCodeCard.jsx`, `src/services/ownerDashboardService.js`, `src/components/owner/OwnerStoreDashboard.jsx`, admin/owner CSS, `scripts/check-settings-config.mjs`, `scripts/check-owner-dashboard.mjs`, and `docs/owner-settings-sync-round1/03-store-name-settings-sync.md`.
- Verification: `npm run check:settings`, `npm run check:owner-dashboard`, `npm run check:store-admin-assignment`, `npm run check`, `npm run build`, and `git diff --check`.

### 05 Integration Release Gate Responsibility

- Purpose: 01〜04の完了メモ、衝突、権限境界、UI表示、Firebase deploy対象をまとめて確認し、本番反映可否を判断できるゲートを固定する。
- Current confirmation: 01〜04の担当MDは Completion Notes を持ち、差分はフロントエンド、チェック、ドキュメント中心で、Functions / Firestore rules / indexes / storage は変更していない。
- Change policy: `check:owner-settings-sync-release-gate` を追加し、通常モードで配線と責務分離、`--final` で clean git、push済み、最終チェック実行を強制する。deploy対象はHostingのみ候補とし、Functions/rules/indexes/storageは差分がないためdeployしない。
- Impact scope: `scripts/check-owner-settings-sync-release-gate.mjs`, `package.json`, `docs/owner-settings-sync-round1/05-integration-release-gate.md`, `docs/owner-settings-sync-round1/README.md` if needed, and this plan.
- Verification: `npm run check:owner-settings-sync-release-gate`, `git diff --check`, listed owner/customer checks, `npm run check`, `npm run build`, commit/push後に `npm run check:owner-settings-sync-release-gate -- --final`。
- Verification results: final gate passed after commit/push. Hosting only was deployed to `qrproduct-3340b`; live assets were `assets/index-DD8bA5mZ.js` and `assets/index-B9Fvv4Sa.css`; `/`, `/login`, `/admin`, `/owner`, `/staff`, and `/order/test-token` returned HTTP 200. Functions / Firestore rules / indexes / storage were not deployed.

## 2026-06-20 Restaurant UX Round 4

### Purpose

- キッチン、スタッフ注文/会計、顧客QR、カテゴリー管理、人数分メニュー自動追加、メニュー行タップ追加を、既存データを壊さず改善する。
- 使っている人がいるため、各担当MDでは本番deployせず、最後に統合ゲートでまとめて判断する。

### User UI Preference

- スタッフ画面は、注文追加や会計確定などの下部操作まで長くドラッグしないで済むことを重視する。
- 商品や会計の内容は内容領域としてスクロールさせ、主要操作は見失わない位置に残す。
- 顧客画面は、カート、注文履歴/注文状況、会計依頼の意味が他アプリと同じ感覚で分かる命名にする。
- 注文前のカート周辺では料金を強く出さず、会計確認で注文済み内容と金額を見せる。
- キッチンの誤操作Undoは、安全に command 層で戻せる場合だけ追加する。表示だけ戻す実装はしない。
- メニュー行タップ追加はデフォルトON候補。ただし店舗設定でプラスボタンのみへ戻せるようにする。

### Parallel Work Documents

- `docs/restaurant-ux-round4/README.md`
- `docs/restaurant-ux-round4/01-kitchen-served-undo-density.md`
- `docs/restaurant-ux-round4/02-staff-order-checkout-scroll-layout.md`
- `docs/restaurant-ux-round4/03-customer-cart-checkout-history-navigation.md`
- `docs/restaurant-ux-round4/04-admin-category-ios-zoom.md`
- `docs/restaurant-ux-round4/05-guest-auto-add-entry-visibility.md`
- `docs/restaurant-ux-round4/06-customer-menu-row-tap-add-setting.md`
- `docs/restaurant-ux-round4/07-integration-release-gate.md`

### Change Policy

- 既存の注文履歴、会計履歴、メニュー、カテゴリー、オプション、QR URL は削除・移行・破壊更新しない。
- UI改善でも、注文/会計/提供済み状態を変える場合は既存 command 層を通す。
- 各担当MDは完了時に検証結果と未解決リスクを自分のMDへ追記する。
- deployは `07-integration-release-gate.md` のチェック通過後にまとめて判断する。

### 01 Kitchen Served Undo And Density Responsibility

- Purpose: キッチンで直近の「提供済み」を command 層で戻せるUndoを追加し、文字サイズを維持したままカード内余白を詰めて表示密度を上げる。
- Current confirmation: `KitchenPage` は `markKitchenItemServed()` / `markKitchenItemsServed()` で提供済みにし、`orderItemCommandService` には `markOrderItemOrderedCommand()` の戻し経路がある。
- Change policy: Undoはこの画面で直近押した単品/全提供だけを対象にし、ローカル表示だけで戻さず `markOrderItemOrderedCommand()` を呼ぶ。密度調整はキッチンCSSのpadding/gap/line-height中心に留める。
- Impact scope: `src/pages/kitchen/KitchenPage.jsx`, `src/services/kitchenService.js`, small kitchen undo component, `src/styles/staff-kitchen-layout.css`, `src/styles/staff-kitchen-table.css`, `scripts/check-kitchen-display.mjs`, `scripts/check-order-command-ui.mjs`, and `docs/restaurant-ux-round4/01-kitchen-served-undo-density.md`.
- Verification: `npm run check:kitchen-display`, `npm run check:order-command-ui`, `npm run check:order-functions-emulator`, `npm run check`, and `npm run build`.

### 05 Guest Auto Add Entry Visibility Responsibility

- Purpose: 人数分メニュー自動追加の「人数設定画面に追加内容のボタン表示を出す」設定が、管理画面と顧客人数画面で一貫して効くことを固定する。
- Current confirmation: `StoreWorkflowSettings` は `showGuestCountButton` を保存し、`GuestCountPage` は `guestAutoAdd.enabled` / `productId` / `showGuestCountButton !== false` を見て `autoAddLabel` を出している。
- Change policy: 既存UIと注文開始commandは変えず、設定OFF・商品未選択・表示OFFで人数画面の自動追加文言が出ないことをソースチェックに追加する。
- Impact scope: `scripts/check-customer-entry.mjs`, `scripts/check-settings-config.mjs`, `docs/restaurant-ux-round4/05-guest-auto-add-entry-visibility.md`, and this plan.
- Verification: `npm run check:customer-entry`, `npm run check:settings`, `npm run check:order-functions-emulator`, `npm run check`, and `npm run build`.

### 03 Customer Cart Checkout History Navigation Responsibility

- Purpose: 顧客QRの「カート」「注文履歴/注文状況」「会計確認」の意味を分け、注文前のカート周辺で金額を強く出さない。
- Current confirmation: `CustomerBottomNav` と `CartFloatingButton` はカート導線で金額を出し、`OrderCompletePage` の会計ボタンは注文履歴/合計確認を経由せず会計依頼確認へ進む。
- Change policy: 下部ナビ/カート表示を点数中心にし、`OrderCompletePage` 上で会計確認モードを経由して注文済み履歴と合計を見せてから `checkout` call を送る。
- Impact scope: `CustomerBottomNav`, customer cart components/styles, `OrderCompletePage`, order status header/total panel, customer cart/status checks, and `docs/restaurant-ux-round4/03-customer-cart-checkout-history-navigation.md`.
- Verification: `npm run check:customer-cart`, `npm run check:customer-order-status`, `npm run check:customer-entry`, `npm run check:order-command-ui`, `npm run check`, and `npm run build`.
- Verification results: `git diff --check`, all listed individual checks, `npm run check`, and `npm run build` passed. No Firebase deploy was run.

### 04 Admin Category iOS Zoom Responsibility

- Purpose: カテゴリー編集でiOS Safariが入力フォーカス時に自動ズームしにくい状態へ整え、管理画面の既存データ処理は変えない。
- Current confirmation: `CategoryRow` の編集行は `autoFocus` 付きのカテゴリ名input、分類select、任意のタグinputを持ち、対象CSSは `admin-product-category.css` で13pxから15pxの入力が混在している。
- Change policy: viewportのズーム禁止には逃げず、カテゴリー管理内のinput/selectと編集行の操作ボタンだけを16px基準にする。行の高さはpaddingを増やさず、既存の追加/編集/削除/並び替えロジックには触れない。
- Impact scope: `src/styles/admin-product-category.css`, `scripts/check-admin-category.mjs`, and `docs/restaurant-ux-round4/04-admin-category-ios-zoom.md`.
- Verification: `npm run check:admin-category`, `npm run check:product-form`, `npm run check`, `npm run build`, and `git diff --check`.

### 06 Customer Menu Row Tap Add Setting Responsibility

- Purpose: 顧客メニューでプラス/選択ボタンに加えて商品行の広い領域をタップ追加にし、店舗設定でプラスボタンのみへ戻せるようにする。
- Current confirmation: `OrderEntryPage` は `storeConfig` を `OrderProvider` に渡しており、`MenuPage` から参照できる。顧客商品行は `CustomerMenuProductList`、店舗設定UIは `CustomerDisplaySettings` に既存トグル構造がある。
- Change policy: 既定は `customerMenuTapToAddEnabled: true` とし、売り切れ行はタップ追加不可。オプションありは既存 `onAddProduct()`、オプションなしは既存数量更新を使い、カートIDや注文送信処理は触らない。
- Impact scope: `src/lib/settingsConfig.js`, `src/lib/customerEntry.js`, `src/pages/order/MenuPage.jsx`, `src/components/order/CustomerMenuProductList.jsx`, `src/styles/customer-menu.css`, related check scripts, and `docs/restaurant-ux-round4/06-customer-menu-row-tap-add-setting.md`.
- Verification: `npm run check:customer-cart`, `npm run check:customer-entry`, `npm run check:settings`, `npm run check:option-modal`, `npm run check`, and `npm run build`.

### 07 Integration Release Gate Responsibility

- Purpose: 01〜06の完了結果、衝突、UI崩れ、注文/会計安全性をまとめて確認し、本番deploy可否を判断できるゲートを固定する。
- Current confirmation: 01〜06の担当MDは `Completion Notes` を持ち、通常ゲートは完了メモ、必須チェック、Firebase project/configを確認できる。`check:order-functions-emulator` は会計競合時に内部数値コードが漏れたため、07で `complete_checkout` のtransaction contentionを `checkout-items-stale` に正規化した。
- Change policy: `npm run check` に通常モードの配線チェックを組み込み、`--final` の時だけ各担当完了メモ、clean git、push済みを強制する。最終deploy対象はHostingと `functions:completeCheckoutCommand` に絞り、rules / indexes / storage は差分がない限りdeployしない。
- Impact scope: `scripts/check-restaurant-ux-release-gate.mjs`, `functions/orderCommandApi.js`, `package.json`, `.gitignore`, `docs/restaurant-ux-round4/README.md`, `docs/restaurant-ux-round4/07-integration-release-gate.md`, and this plan.
- Verification: `npm run check:restaurant-ux-release-gate`, `git diff --check`, `npm run check`, `npm run check:order-functions-emulator`, and `npm run build`. Commit/push後に `npm run check:restaurant-ux-release-gate -- --final` を実行する。
- Verification results: final gate passed after commit/push, Hosting and `functions:completeCheckoutCommand` were deployed to `qrproduct-3340b`, live assets were `assets/index-DIJYZ4C0.js` and `assets/index-BA3KaryF.css`, 主要ルートHTTP 200を確認した。Production command failure auditはADC/service-account credentials未設定で未実行。

### 2026-06-20 Post-gate Customer Start Contention Fix

- Purpose: 全担当完了後の再検証で、同じ席の顧客注文開始50同時実行が Functions emulator 上で timeout/internal になったため、本番注文入口の余裕を増やす。
- Current confirmation: UI系チェックと本番Hosting疎通は通ったが、`npm run check:order-functions-emulator` の `same-table customer start race` が失敗した。
- Change policy: `startCustomerOrderSessionCommand` だけを補強し、既存の注文履歴、会計履歴、メニュー、QR URL、Firestore rules は変更しない。
- Implementation: `orderStartLocks/{tableId}` の短い開始ロックで、勝者だけが注文作成transactionを実行し、他リクエストは `tables/{tableId}.currentOrderId` を待って同じ注文IDを返す。ロック待ち中は、ロックなしで注文作成transactionへ入らない。
- Additional implementation: 再検証で検出した席移動と顧客追加注文の同時実行について、Firestoreの一時的なロック/期限切れだけを顧客追加注文と席移動transactionで再試行する。
- Verification: `node --check functions/orderCommandHandlers.js` passed. `npm run check:order-functions-emulator` passed.
- Deploy plan: `functions:startCustomerOrderSessionCommand`, `functions:submitCustomerOrderItemsCommand`, `functions:moveTableOrderCommand` のみdeployし、Hosting / rules / indexes / storage は追加deployしない。
- Final result: commit `9d3561d` pushed. `npm run check:restaurant-ux-release-gate -- --final` passed. The three target Functions were deployed to `qrproduct-3340b` and verified in `functions:list`; major Hosting routes stayed HTTP 200. Runtime log error scan returned no new error line. Production command failure audit remains blocked by missing local ADC/service-account credentials.

### Verification

- `git diff --check`
- 各担当MDの個別チェック
- `npm run check:restaurant-ux-release-gate`
- `npm run check`
- `npm run build`

## 2026-06-20 UI correction after live feedback

- Purpose: ユーザー様の実機確認で、スクロール類が体感で変わらず、顧客メニューの行タップ注文ができず、キッチンパネルは元の方がよいと分かったため、UIを現場向けに修正する。
- Current confirmation: Round4 Hosting asset is live, but the row tap implementation only商品情報側を押下領域にしており、数量操作側を含む「欄全体タップ」の体感になっていない。キッチンはRound4でUndoバーと密度調整が追加されている。
- Change policy: 履歴、メニュー商品データ、QR URL、Firestore rules、注文Functionsは変更しない。キッチンはRound4のUndo/密度UIだけ戻し、Round3の提供済みoptimistic hideは維持する。
- Impact scope: `src/pages/kitchen/KitchenPage.jsx`, `src/services/kitchenService.js`, kitchen CSS/checks, customer menu row tap component/CSS/check, staff menu/checkout scroll CSS/checks, and docs.
- Verification: `git diff --check`, `npm run check:kitchen-display`, `npm run check:customer-cart`, `npm run check:staff-menu`, `npm run check:staff-table-detail`, `npm run check:checkout`, `npm run check`, and `npm run build`.
- Deploy plan: UI変更なので、チェック後にHostingのみdeployする。Functions / Firestore rules / indexes / storage はdeployしない。

## 2026-06-20 Order safety Round 3 deploy

### Summary

- 01〜05 と 07 の完了後、`npm run check:order-safety-release-gate -- --final` を監査込みで通過した。
- 注文 command Functions 11本を明示deployし、Hostingを本番反映した。
- Firestore rules / Storage は今回差分なしのため deploy していない。

### Verification Results

- `npm run check` passed.
- `npm run check:order-functions-emulator` passed.
- `npm run build` passed.
- `npm run audit:command-failures -- --limit 10` は rows 0。
- Production HTML は `assets/index-CJoV9Bg3.js` を返した。
- `/`, `/login`, `/admin`, `/admin/staff`, `/staff`, `/staff/kitchen`, `/order/test-token` は HTTP 200。
- Functions log scan で注文 command の error pattern は検出されなかった。

### Monitoring Notes

- `npm run audit:pending-counts -- --json` は tableCount 19, pendingItemCount 20, driftedTableCount 7, itemIssueCount 0 を報告した。
- 既存の pending 集計ズレは自動修復していない。必要なら `repair:pending-counts` の dry-run で対象を確認してから判断する。
- Firebase の Node.js 20 runtime deprecation と `firebase-functions` outdated warning は別計画で対応する。

## 2026-06-19 Order safety Round 3: real restaurant scenarios

### Purpose

- ユーザー様は、QRから注文したお客様に「注文できませんでした」と出ることを売上直撃の重大問題として扱っている。
- いたちごっこの修正ではなく、飲食店で起きる同時操作・通信断・会計タイミング・古いQR画面・監視復旧をシナリオ別に潰す。

### Current Confirmation

- Production build は Functions command を注文本線として使う構造になっている。
- 顧客の注文開始と注文送信は Functions 側で Firestore transaction / `clientRequestId` 冪等処理へ寄っている。
- 既存の `npm run check:order-functions-emulator` は、同時着席、重複 submit、会計後の遅延 submit、store scope mismatch などを一部検証している。
- ただし、実店舗の複数端末、通信断、リロード復旧、保存済み注文の顧客表示、監視/復旧を別担当でさらに検証する必要がある。
- キッチンパネルの「提供済み」は安全性を保ちつつ、押した瞬間に一度消し、処理失敗時だけ戻す操作感改善も必要。

### Parallel MDs

- `docs/order-safety-round3/README.md`
- `docs/order-safety-round3/01-customer-session-race.md`
- `docs/order-safety-round3/02-submit-idempotency-and-retry.md`
- `docs/order-safety-round3/03-checkout-and-stale-qr-races.md`
- `docs/order-safety-round3/04-client-recovery-and-offline-ux.md`
- `docs/order-safety-round3/05-live-failure-monitoring-and-repair.md`
- `docs/order-safety-round3/06-load-release-gate.md`
- `docs/order-safety-round3/07-kitchen-served-optimistic-ui.md`

### Change Policy

- データ履歴、会計履歴、メニュー、カテゴリ、オプション、QR URL は消さない。
- 担当MD単独では本番 deploy しない。
- キッチン提供済みUIは optimistic hide / rollback で、失敗防止と現場の操作感を両立する。
- 各担当は対象ファイル、禁止事項、合格条件、検証コマンドを守り、完了時に担当MDへ結果を追記する。
- 最終 deploy は `06-load-release-gate.md` で全チェックと監視手順をそろえてから行う。

### 06 Load Release Gate Responsibility

- Purpose: integrate 01-05 and 07 into a deploy decision gate so crowded restaurant order safety is checked before Production release.
- Current confirmation: existing scripts already cover normal source checks, Functions emulator concurrency, order rules lockdown, command failure audit, pending count audit, and Production build.
- Change policy: add release-gate tooling and documentation only; do not deploy Firebase assets or write Production data from this responsibility.
- Impact scope: `scripts/check-order-safety-release-gate.mjs`, `package.json`, `docs/order-safety-round3/06-load-release-gate.md`, and this plan.
- Verification: `npm run check:order-safety-release-gate`, `npm run check`, `npm run check:order-functions-emulator`, `npm run build`, and read-only audits when credentials are available.

### 01 Customer Session Race Responsibility

- Purpose: guarantee that many customers opening the same table QR and starting at nearly the same time converge to one active order session.
- Current confirmation: Functions `startCustomerOrderSession()` already reads `tables/{tableId}` inside a Firestore transaction and returns the existing `currentOrderId` when one has already won.
- Change policy: strengthen emulator coverage rather than changing production behavior unless the check exposes a real command-layer gap.
- Impact scope: `functions/orderCommandHandlers.js`, `scripts/check-order-functions-emulator.mjs`, `scripts/check-customer-entry.mjs`, `docs/order-safety-round3/01-customer-session-race.md`, and this plan.
- Verification: `npm run check:order-functions-emulator`, `npm run check:customer-entry`, `npm run check`, and `npm run build`.
- Verification results: the strengthened 50-client emulator check first reproduced transaction contention, then passed after adding start-session contention recovery; `npm run check:customer-entry`, `npm run check`, and `npm run build` also passed. No Firebase deploy was run.

### 03 Checkout And Stale QR Race Responsibility

- Purpose: keep checkout history, table reset, and old customer QR screens consistent when customer submit, checkout, table move, or double checkout happen at nearly the same time.
- Current confirmation: `completeCheckoutCommand()` is idempotent for the same order check, but checkout needs a command-layer item snapshot guard so stale totals cannot close an order after a late submit has already landed.
- Change policy: validate checkout against the latest non-cancelled order items, keep the existing UI flow, and add emulator races for checkout vs submit, double checkout, stale customer route guards, and move vs submit.
- Impact scope: `functions/orderCommandHandlers.js`, command error mapping, checkout command clients, customer route/static checks, `scripts/check-order-functions-emulator.mjs`, `scripts/check-order-concurrency.mjs`, `docs/order-safety-round3/03-checkout-and-stale-qr-races.md`, and this plan.
- Verification: `npm run check:order-functions-emulator`, `npm run check:customer-entry`, `npm run check:customer-cart`, `npm run check:checkout`, `npm run check`, and `npm run build`.

### 04 Client Recovery And Offline UX Responsibility

- Purpose: when customer submit loses the response, reloads, or returns from browser back, keep the last `clientRequestId` and cart snapshot so saved orders are treated as reflection-pending instead of failed.
- Current confirmation: `CartPage` keeps the active request id only in memory, while `OrderCompletePage` can already identify reflected order items by `clientRequestId`.
- Change policy: add a small sessionStorage-backed recovery record, route pending/retryable submits to the order status page, clear the record only after the matching request id is reflected, and expose retry/staff-call guidance only after a delay.
- Impact scope: `src/lib/customerSubmitRecovery.js`, customer cart/status pages and components, customer cart/status checks, `docs/order-safety-round3/04-client-recovery-and-offline-ux.md`, and this plan.
- Verification: `npm run check:customer-cart`, `npm run check:customer-order-status`, `npm run check:order-command-ui`, `npm run check`, and `npm run build`.
- Verification results: `git diff --check`, `npm run check:customer-cart`, `npm run check:customer-order-status`, `npm run check:order-command-ui`, `npm run check`, and `npm run build` passed. No Firebase deploy was run.

### 07 Kitchen Served Optimistic UI Responsibility

- Purpose: make kitchen served actions feel immediate by hiding pressed items locally while keeping the existing Functions command as the source of truth.
- Current confirmation: `KitchenPage` currently renders the Firestore `itemStatus == ordered` subscription directly, so served rows remain visible until the subscription reflects the command write.
- Change policy: add scoped optimistic hidden item ids in the kitchen page, filter only display data, rollback hidden ids on command failure, and prune hidden ids after the subscription confirms they disappeared.
- Impact scope: `src/pages/kitchen/KitchenPage.jsx`, `src/lib/kitchenDisplay.js`, `scripts/check-kitchen-display.mjs`, `scripts/check-order-command-ui.mjs`, `docs/order-safety-round3/07-kitchen-served-optimistic-ui.md`, and this plan.
- Verification: `npm run check:kitchen-display`, `npm run check:order-command-ui`, `npm run check:order-functions-emulator`, `npm run check`, and `npm run build`.

### 05 Live Failure Monitoring And Repair Responsibility

- Purpose: make "order did not enter" reports traceable from recent command failures, Functions logs, pending-count audit, and dry-run repair steps.
- Current confirmation: server-side `orderCommandFailures`, client best-effort failure logs, read-only pending audit, and dry-run pending repair already exist, but the command failure audit needs time-window and trace filters for production triage.
- Change policy: extend the existing read-only audit script with recent-window and trace filters, keep pending repair dry-run by default, and document the production response path in a runbook without deploying.
- Impact scope: `scripts/audit-order-command-failures.mjs`, `scripts/check-live-observability.mjs`, `docs/order-safety-round3/05-live-failure-monitoring-and-repair.md`, new runbook MD, and this plan.
- Verification: `npm run check:live-observability`, `npm run check:data-consistency-repair`, `npm run audit:command-failures -- --help`, `npm run audit:command-failures -- --limit 10`, `npm run audit:pending-counts -- --json`, and `npm run check`.

### Verification

- `git diff --check`
- `npm run check`
- Commit and push the planning docs.

## 2026-06-20 Staff option cart quantity identity fix

### Purpose

- ユーザー様の指摘: 詳細画面でタレ3個・塩5個のように複数オプション数量を追加した後、片方を調整すると両方の数量が同期してしまう。

### Current Confirmation

- `StaffMenuPage.addToCart()` と customer cart の `CartProvider.addItem()` は新規 cart item id に `product.id + Date.now()` を使っている。
- 複数オプションを同じ確定操作で連続追加すると同じ millisecond の id になり、数量更新が同じ id の全行に当たる。

### Change Policy

- cart item id の生成を小さな共通 helper に切り出し、同一商品を同時に複数行追加しても必ず別 id になるようにする。
- 既存の product + optionSelections による同一オプションの加算ロジックは維持する。
- スタッフ画面だけでなく、同じ multi option 追加を持つ顧客 cart 側にも同じ helper を使う。

### Verification

- `npm run check:staff-menu`
- `npm run check:customer-cart`
- `npm run check:option-modal`
- `npm run check`
- `npm run build`

## 2026-06-19 Production deployment

### Scope

- Deployed the current `codex/staff-entry-session-recovery` build to Firebase project `qrproduct-3340b`.
- Deployed order callable Functions explicitly: `startCustomerOrderSessionCommand`, `submitCustomerOrderItemsCommand`, `submitStaffOrderItemsCommand`, `seatStaffOrderSessionCommand`, `completeCheckoutCommand`, `markOrderItemServedCommand`, `markOrderItemsServedCommand`, `markOrderItemOrderedCommand`, `cancelOrderItemCommand`, `moveTableOrderCommand`, and `guideReservationToTableCommand`.
- Deployed Hosting and Firestore rules/indexes. Storage was not deployed.
- This release supersedes earlier per-slice notes that said Firebase deploy had not yet been run.

### Verification Results

- `npm run check:staff-entry`, `npm run check:staff-permissions`, `npm run check:owner-access`, `npm run check`, and `npm run build` passed before deploy.
- Order reliability gates passed before deploy: `npm run check:order-functions-mainline`, `npm run check:order-rules-lockdown`, `npm run check:data-consistency-repair`, and `npm run check:order-functions-emulator`.
- Production `/staff` returned HTTP 200 and served the latest Hosting asset `assets/index-Co-14orm.js` with the staff store-code entry screen visible.
- In-app browser verification of Production `/staff` showed no console warning/error logs.
- `firebase functions:list` confirmed the deployed order callable Functions in `us-central1` on Node.js 20.
- `firebase functions:log --only startCustomerOrderSessionCommand --lines 10` showed deployment/startup/callable verification entries and no error entries in the fetched output.
- `npm run audit:pending-counts -- --json` and `npm run audit:command-failures -- --limit 10` could not run locally because Firestore read credentials were not available. No production data repair/write was run.

### Follow-up Notes

- Firebase reported that Cloud Functions Node.js 20 is deprecated and scheduled for decommission on 2026-10-30, so the Functions runtime should be upgraded in a separate planned change.
- Firebase also warned that the `firebase-functions` package is outdated; update it separately with a focused Functions dependency check.

## 2026-06-19 Order reliability Round 2: Functions mainline

### User Priority

- ユーザー様は「注文が入らない」「反映されない」状態を最優先で解消したい。
- `VITE_ORDER_COMMAND_RUNTIME=functions` が opt-in のままでは、Production の通常注文経路が変わらず、改善完了とは扱わない。
- 既存利用者がいるため、注文履歴、会計履歴、メニュー、カテゴリ、オプションは削除しない。

### Decision

- Cloud Functions command を Production の注文本線にする。
- client command は local/dev/rollback 用として残すが、Production の通常既定として曖昧に残さない。
- 06〜10 の分担MDで実装・検証を進め、11 の統合MDだけが deploy 順と rollback を管理する。
- 既存UI導線は維持し、見た目の大幅変更ではなく注文実行経路、同時実行、観測、rules、復旧を直す。

### Parallel Work Documents

- `docs/order-reliability/06-functions-mainline.md`
- `docs/order-reliability/07-functions-emulator-concurrency.md`
- `docs/order-reliability/08-rules-lockdown.md`
- `docs/order-reliability/09-live-observability.md`
- `docs/order-reliability/10-data-consistency-repair.md`
- `docs/order-reliability/11-integration-release.md`

### Completion Gate

- Production build の注文経路が Functions command であること。
- Callable Functions の emulator concurrency check があること。
- 注文失敗が server-side に記録され、原因を追えること。
- rules 締め込みが deploy 順と新旧クライアント混在を考慮していること。
- データ削除やメニュー移行なしで、監査/修復手順が dry-run first であること。

## 2026-06-19 Customer order UX split

### User Preference

- ユーザー様は、品切れの商品が通常注文の邪魔にならないよう、メニューの一番下にまとまることを重視している。
- ユーザー様は、お客様の注文確認で「過去に頼んだ商品」「注文済み」「まだ注文できていないもの」が分かることを重視している。
- ユーザー様は、タレ/塩などの味付け選択がキッチンパネルで見落とされないことを重視している。

### Parallel Work Documents

- `docs/customer-order-ux/01-sold-out-product-order.md`
- `docs/customer-order-ux/02-customer-order-visibility.md`
- `docs/customer-order-ux/03-kitchen-option-display.md`

### Current Implementation

- Add `sortSoldOutProductsLast` as a shared display-order helper.
- Apply it to customer menu and staff order menu after category filtering.
- Keep Firestore `sortOrder` and product data unchanged.
- Show customer-visible order history on the existing completion screen, grouped by preparing, served, and cancelled status.
- Keep cancelled rows visible as non-billable history and mark the latest reflected submission as `今回追加`.
- Show `optionSelections` on each kitchen item row so sauce/salt and other option choices are visible during preparation.

### Verification

- `npm run check:menu-product-order`
- `npm run check:customer-order-status`
- `npm run check:customer-cart`
- `npm run check:customer-entry`
- `npm run check:staff-menu`
- `npm run check:kitchen-display`
- `npm run check:staff-table-detail`
- `npm run check`
- `npm run build`

### Integration Results

- 01 sold-out product ordering, 02 customer order visibility, and 03 kitchen option display are all integrated on `codex/customer-order-ux-integration`.
- `npm run check:menu-product-order`, `npm run check:customer-order-status`, `npm run check:customer-cart`, `npm run check:customer-entry`, `npm run check:staff-menu`, `npm run check:kitchen-display`, and `npm run check:staff-table-detail` passed.
- Full integration gates `npm run check` and `npm run build` passed.
- Firebase deploy is intentionally left for a separate explicit release step.

### 02 Customer Order Visibility Responsibility

- Purpose: make the customer order confirmation screen show previous ordered items, preparing items, served items, and cancelled items clearly.
- Current confirmation: `OrderCompletePage` already subscribes to `orderItems`, but `customerOrderStatusService.js` hides `itemStatus: 'cancelled'`, and the list does not distinguish the latest submitted request from already reflected history.
- Change policy: keep the existing `/complete` route, show order items grouped by customer-visible status, include cancelled rows as non-billable history, and mark the latest submitted request once Firestore reflects it.
- Impact scope: `src/pages/order/OrderCompletePage.jsx`, `src/pages/order/CartPage.jsx`, `src/components/order/OrderStatusList.jsx`, `src/components/order/OrderStatusSummary.jsx`, `src/lib/customerOrderStatus.js`, `src/services/customerOrderStatusService.js`, `src/styles/customer-order-status.css`, `scripts/check-customer-order-status.mjs`, and the 02 work document.
- Verification: `npm run check:customer-order-status`, `npm run check:customer-cart`, `npm run check:customer-entry`, `npm run check`, and `npm run build`.
- Verification results: all listed commands passed; no Firebase deploy was run.

### 03 Kitchen Option Display Responsibility

- Purpose: show customer/staff selected option choices such as sauce or salt on the kitchen panel so preparation does not miss them.
- Current confirmation: `orderItems.optionSelections` already persists option selections, and staff table detail displays them, but `KitchenItemRow` only shows product name, quantity, source, and elapsed time.
- Change policy: keep the existing kitchen table/card structure, add a compact option line under the product name, and keep long option labels wrapping inside the row instead of widening the action buttons.
- Impact scope: `src/lib/kitchenDisplay.js`, `src/components/staff/KitchenItemRow.jsx`, `src/styles/staff-kitchen-table.css`, `scripts/check-kitchen-display.mjs`, and the 03 work document.
- Verification: `npm run check:kitchen-display`, `npm run check:staff-table-detail`, `npm run check`, and `npm run build`.
- Verification results: `npm run check:kitchen-display`, `npm run check:staff-table-detail`, `npm run check`, and `npm run build` passed. Firebase deploy was not run.

## 2026-06-19 Staff entry session recovery

### Purpose

- Recover staff devices that still have `deviceStoreId` in localStorage but no matching `staffSessions/{uid}` document under the current Firestore rules.
- Avoid leaving those users on a staff screen that cannot load staff members.

### Current Confirmation

- Production `/staff` returns the staff entry screen for a clean browser and has no console errors.
- `firestore.rules` requires `staffSessions/{uid}` for `staffMembers` reads through `canAccess(storeId)`.
- Older or partially reset devices can keep `deviceStoreId` without a matching session document, which makes `loadStaffMembers(storeId)` fail.

### Change Policy

- In `StoreProvider`, validate an anonymous user's saved `deviceStoreId` against that user's own `staffSessions/{uid}` before exposing `storeId`.
- If the session is missing or points at another store, clear only `deviceStoreId` and `activeStaff`, then show the existing staff store-code entry screen.
- Keep saved staff store code intact so the user can re-enter automatically or manually and recreate `staffSessions/{uid}`.

### Verification

- `npm run check:staff-entry`
- `npm run check:staff-permissions`
- `npm run check`
- `npm run build`

### Verification Results

- `npm run check:staff-entry` passed.
- `npm run check:staff-permissions` passed.
- `npm run check` passed.
- `npm run build` passed.
- Production `/staff` was checked in a clean browser and showed the staff store-code entry screen with no console errors.
- Firebase deploy was not run.

## 2026-06-19 Admin login return path

### Purpose

- Googleログインが必要な管理画面を開いた時、ログイン後に `/staff` へ戻されず、元の管理画面へ戻れるようにする。
- 匿名スタッフセッションから管理画面へ進む場合も、Google管理者ログインへ自然につなぐ。

### Current Confirmation

- `PrivateRoute` は未ログイン時に `/login` へ固定遷移しており、元の `/admin/...` パスを保持していなかった。
- `LoginPage` はGoogleログイン済みになった時点で常に `/staff` へ遷移していた。
- スタッフログイン画面のスタッフ追加導線も、匿名スタッフ状態では `/login` に固定遷移していた。

### Change Policy

- 管理画面でログインが必要な場合は `/login?next=/admin...` に遷移する。
- Google/メールログイン後は、安全な同一アプリ内 `next` のみへ戻す。
- Google OAuth リダイレクトでURLクエリが失われても戻れるように、リダイレクト開始前の安全な戻り先を `sessionStorage` と `localStorage` に一時保存する。
- `/login` 単体に戻った場合でも、Googleログインは管理者ログインとして扱い、既定の戻り先を `/admin` にする。
- Googleログインはポップアップを優先し、成功結果をその場で受け取って `/admin` へ遷移する。ポップアップ不可の場合だけリダイレクトへ戻す。
- 匿名スタッフセッションからGoogle管理者ログインへ切り替える時は、Googleリダイレクト前に匿名Authを明示的にsign outする。
- `next` がない、不正、または `/login` 自身の場合は `/admin` に戻し、承認されていないメールは既存の承認ゲートで止める。
- 管理者ログインでは保存済みの古い `/staff` 系戻り先を無効化して削除し、ログイン成功後にスタッフ店舗コード入力へ落ちないようにする。
- 注文、メニュー、履歴、店舗データには触れない。

### Verification

- `npm run check:staff-entry`
- `npm run check:staff-permissions`
- `npm run check`
- `npm run build`

## 2026-06-19 Staff add-order option quantity fix

### Purpose

- 注文追加画面で、焼き鳥の「タレ」「塩」のようなオプション付き商品を追加した後でも個数を変更できるようにする。
- オプションが多くても、数量操作が埋もれず現場で素早く修正できる状態にする。

### Current State

- 通常商品は商品行の右側に数量の `- / +` 操作が出る。
- オプション付き商品は選択済みオプションと数量がテキスト表示だけになり、同じ画面上で数量を変更できない。

### Change Plan

- `StaffMenuProductList` のオプション付きカート行にも既存の `onUpdateQuantity` を渡す数量操作を出す。
- 商品追加の `+` ボタンは残し、別オプションの追加導線は維持する。
- CSSは既存のスタッフ注文追加UIに合わせ、オプション行が複数あっても折り返しと操作領域が崩れないようにする。

### Verification

- `npm run check:staff-menu`
- `npm run check`
- `npm run build`

## 2026-06-19 Live order observability

### Purpose

- Take ownership of `docs/order-reliability/09-live-observability.md`.
- Make Functions command failures visible after the fact, so "orders did not enter" can be investigated from command logs and pending-count drift checks.

### Current State

- UI command errors already show short retryable messages through existing screens.
- Client-side best-effort logging exists, but Functions callable commands currently convert errors to `HttpsError` without writing a server-side `orderCommandFailures` record.
- `npm run audit:pending-counts` can verify derived pending-count drift, but there is no paired command-failure audit script.

### Change Plan

- Add a Functions-side command failure payload builder and best-effort recorder.
- Wrap each callable order command with command type / actor type metadata and sanitized request ids only.
- Keep logged fields limited to command type/version, actor type, store/table/order/item/request ids, error code/name/message, and timestamp.
- Add a read-only `audit:command-failures` script for recent failure inspection.
- Add a static `check:live-observability` script so the logging path and docs stay wired.

### Verification

- `node --check` for new/changed Functions and script files.
- `npm run check:live-observability`
- `npm run check:order-command-ui`
- `npm run check:functions-rules-migration`
- `npm run check`
- `npm run build`

## 2026-06-19 Functions emulator concurrency responsibility

### Purpose

- Take ownership of `docs/order-reliability/07-functions-emulator-concurrency.md`.
- Add a real Firebase Emulator integration check for callable order command Functions, not only the existing in-memory concurrency mock.

### Current Confirmation

- The repo already has callable order command exports and in-memory `npm run check:order-concurrency`.
- `07-functions-emulator-concurrency.md` requires emulator coverage for Functions handler, Firestore transaction, idempotency, staff authorization, and store-scope validation.
- This step must not connect to production Firestore, deploy Firebase resources, delete production data, or modify live records.

### Change Policy

- Add a separate heavy check command, `npm run check:order-functions-emulator`, instead of putting the emulator run directly into normal `npm run check`.
- Use `firebase emulators:exec` with a demo project and test-only seed data.
- Seed Firestore through Admin SDK inside the emulator process; call callable Functions through the Firebase client SDK.
- Cover customer start races, customer/staff duplicate submit idempotency, served/ordered/cancelled counter transitions, late submit after checkout, table move consistency, unauthorized staff rejection, and product/category store-scope rejection.
- If the emulator check finds a narrow Functions validation gap, fix only that command-layer validation.

### Impact Scope

- Emulator integration script and package script.
- Functions command validation only if needed for the test contract.
- 07 documentation and this plan.
- No UI changes, no Firestore rules lockdown, no hosting/functions deploy, no production data writes.

### Verification

- `npm run check:order-concurrency`
- `npm run check:order-functions-emulator`
- `npm run check`
- `npm run build`

### Verification Results

- `npm run check:order-functions-emulator` passed against the local Firebase Auth/Firestore/Functions emulators with demo project `demo-qr-functions-concurrency`.
- `npm run check:functions-rules-migration` passed.
- `npm run check:order-concurrency` passed.
- `npm run check` passed.
- `npm run build` passed.
- Local dependency note: `functions/node_modules` was reinstalled because OneDrive had left an emulator dependency as a reparse point that Functions could not read.
- Firebase deploy was not run for this 07 responsibility.

## 2026-06-19 Rules lockdown staging

### Purpose

- Take ownership of `docs/order-reliability/08-rules-lockdown.md`.
- Prepare the Firestore rules lockdown path without breaking old client builds before 06/07/11 finish their gates.

### Current State

- `firestore.rules` still permits public QR order start/submit compatibility:
  - `tables` vacant-to-occupied update.
  - `orders` create.
  - `orderItems` create.
- Functions command APIs exist, but this slice must not assume the live Hosting/Functions deploy order is complete.
- `orderCommandFailures` rules already exist and should remain readable to super/history-capable staff and writable only as validated failure documents.

### Change Policy

- Keep current compatibility behavior active in `firestore.rules`.
- Wrap legacy public order writes in explicit stage helper functions so lockdown is a small audited flip, not an ad-hoc rules edit.
- Add `scripts/check-order-rules-lockdown.mjs` to verify:
  - compatibility stage remains open in the deploy-target rules file,
  - the lockdown flip points are present,
  - customer/staff/admin read paths are not accidentally removed,
  - integration release docs include deploy/rollback cautions.
- Update 08/11 docs with staged deploy conditions. No production deploy in this slice.

### Verification

- `npm run check:order-rules-lockdown`
- `npm run check:functions-rules-migration`
- `npm run check`
- `npm run build`

### Verification Results

- `npm run check:order-rules-lockdown` passed.
- `npm run check:functions-rules-migration` passed.
- `npm run check:order-functions-mainline` passed.
- `npm run check` passed.
- `npm run build` passed.
- Current `firestore.rules` remains in Compatibility stage; no public order write lockdown was deployed.
- No Firebase deploy was run.

## 2026-06-19 06 Functions mainline implementation

#### Current State

- Callable order commands are already implemented and exported from Functions.
- Client wrappers can call Functions, but the current runtime switch is still opt-in through `VITE_ORDER_COMMAND_RUNTIME=functions`.
- `06-functions-mainline.md` requires Production build to use Functions commands by default and allow explicit `VITE_ORDER_COMMAND_RUNTIME=client` only for local/dev/rollback.

#### Change Plan

- Change the order command runtime resolver so Production defaults to Functions when no override is set.
- Keep non-production default as client for local development, while allowing explicit `functions` for emulator/manual verification.
- Add a static `check:order-functions-mainline` script that asserts the runtime policy and all expected callable command names stay wired.
- Update the existing functions/rules migration check so it no longer treats Functions as opt-in-only.
- Update docs/env example to describe the new mainline and rollback behavior.

#### Verification

- `npm run check:functions-rules-migration`
- `npm run check:order-functions-mainline`
- `node --check` for Functions command files.
- `npm run check`
- `npm run build`
- No Firebase deploy in this phase.

#### Verification Results

- `npm run check:functions-rules-migration` passed.
- `npm run check:order-functions-mainline` passed.
- `node --check functions/index.js functions/orderCommandApi.js functions/orderCommandAuth.js functions/orderCommandHandlers.js functions/orderCommandShared.js` passed.
- `npm run check` passed.
- `npm run build` passed.
- `.env.local` has no `VITE_ORDER_COMMAND_RUNTIME` override, so the local Production build used the default Functions runtime.
- No Firebase deploy was run.

## 2026-06-19 Order reliability architecture review

### Context

- User reported that the restaurant QR ordering system is in a repeated bug-fix cycle and may need to be reconsidered from the mechanism level.
- Current live symptom: when many customers come at once, orders can stop entering.
- User priority: reduce recurring bugs through a coherent ordering design, not patchwork fixes.

### Current Findings

- `npm run check` passes, so the current problem is not exposed by existing source checks.
- The order domain is still split across client services:
  - Customer order start creates `orders`, then updates `tables.currentOrderId`, then optionally creates an auto-added `orderItems` document.
  - Customer cart submit creates `orderItems`, then best-effort updates `tables.pendingCount`.
  - Staff ordering, kitchen served/cancel actions, table detail actions, checkout, and table move actions directly update both `orderItems` and `tables`.
  - Cloud Functions also update `tables.pendingAggregate*` when `orderItems` change.
- This means the same `tables/{tableId}` document is a hot coordination document for session state, pending counts, checkout reset, table move, and aggregate updates.
- Official Firestore guidance warns that high concurrent operations on one document can cause high latency or contention errors; this matches the reported "many customers at once" failure shape.
- Current security rules allow public `orders` and `orderItems` creation, while public `tables` update is only allowed for vacant-to-occupied entry. If two customers start the same table concurrently, one can create an orphan `orders` record and then fail to attach it to the table.
- Functions logs currently show scheduled reservation activity but not order write failures, which is expected because the critical customer order path is mostly client-side Firestore writes.

### Decision

- Do not start with a full UI rewrite. The first rewrite target is the ordering mechanism, because the UI can remain mostly stable while writes are centralized.
- Treat `orderItems` as the durable source of ordered products, and stop using `tables` as a high-frequency counter target.
- Introduce an order command boundary:
  - `startOrderSession`
  - `submitOrderItems`
  - `markItemServed`
  - `cancelOrderItem`
  - `checkoutOrder`
  - `moveOrderTable`
- Each command must be idempotent where customer retry or double-tap is possible.
- Each command must either complete its related writes atomically or leave a recoverable command/error record.
- Keep existing Firestore collections initially to avoid a risky data migration, then move callers behind the command boundary one slice at a time.

### Stabilization Plan

1. Add failure visibility before deeper rewrites.
   - Record customer/staff order write failures with operation name, table id, order id, store id, error code, and timestamp.
   - Keep the customer-facing message simple, but make the admin/debug trail inspectable.

2. Hotfix customer order start.
   - Make `createCustomerOrderSession` transaction/idempotency based.
   - If the table is already occupied with `currentOrderId`, return that order id instead of creating another orphan order.
   - If the table is vacant, create the order and attach it to the table in one transaction.

3. Remove high-frequency table counter dependence.
   - Stop treating `tables.pendingCount` as a source of truth.
   - Use `orderItems` query results or `pendingAggregate*` only for display, with a repair/rebuild path.
   - Avoid client-side `pendingCount` increments on every submit/served/cancel action.

4. Move core order writes to server commands.
   - Implement Cloud Functions callable/HTTPS commands for start, submit, serve, cancel, checkout, and move.
   - Clients call commands instead of writing multiple collections directly.
   - Firestore rules can then be tightened so public clients cannot create arbitrary order data.

5. Add concurrency and retry checks.
   - Emulator test: many customers start the same table at once.
   - Emulator test: many customers submit multiple cart lines for one active order.
   - Emulator test: duplicate submit idempotency key does not duplicate items.
   - Emulator test: checkout during late submit is rejected or queued consistently.
   - Emulator test: served/cancelled counts rebuild from `orderItems`.

6. Decide rebuild scope after the command layer.
   - If errors disappear after centralizing commands, keep the current UI and continue incremental cleanup.
   - If data model issues remain, rebuild backend/data model first and keep route/UI compatibility during migration.

### Investigation Results

- The highest-priority race is customer and staff seating creating an `orders` document before attaching it to `tables.currentOrderId`. A failed or competing table update can leave orphan open orders.
- `tables.pendingCount` is already non-authoritative, and `pendingAggregate*` can also become wrong when checkout resets aggregate fields while `orderItems` can still contain `itemStatus: 'ordered'`.
- Add `src/services/orderCommandService.js` and `src/lib/orderCommands.js` first, then delegate existing services to that boundary while keeping current UI/routes stable.
- Resolve the Functions runtime mismatch before deeper Functions work: `firebase.json` uses `nodejs20`, while `functions/package.json` declares Node `22`.

### Next Implementation Order

1. Hotfix `createCustomerOrderSession` with a Firestore transaction and conflict return, so customer starts cannot create orphan orders.
2. Hotfix `seatGuestsAtTable` with the same transaction guard for staff seating.
3. Add a stale-table confirmation guard to reservation table assignment before it overwrites an occupied table.
4. Add an aggregate audit/repair script before removing legacy `pendingCount` writes.
5. Introduce the order command service boundary and move cart/staff order submit behind it.
6. Add emulator/rules test tooling before tightening public `orders` / `orderItems` create rules.

### Verification Plan

- `npm run check`
- `npm run build`
- Firebase emulator concurrency tests for order commands before production deploy.
- Production deploy only after the command path can be verified without changing visible ordering flow.

### 2026-06-19 Functions command migration step

#### Purpose

- Take ownership of `docs/order-reliability/04-functions-rules-migration.md`.
- Prepare the next order-reliability stage by adding Cloud Functions callable command APIs that mirror the existing client-side command input/output shape.
- Keep existing customer/staff UI wrappers stable, so the runtime can switch from client transactions to Functions without changing route or button behavior.

#### Current Confirmation

- Client-side command/transaction wrappers are already in place for order start, submit, seating, checkout, served/unserved, cancel, and table move.
- The 04 migration doc explicitly forbids production deploy, premature rules tightening, and data migration in this step.
- `.firebaserc` default project is `qrproduct-3340b`; this step will not deploy to Firebase.
- `firebase.json` declares Functions runtime `nodejs20`, while `functions/package.json` still declares Node `22`.

#### Change Policy

- Add callable Functions for the order commands behind a server command module.
- Add an opt-in client runtime switch, defaulting to the existing client transaction implementation.
- Add server-side authorization for staff commands because Admin SDK bypasses Firestore rules.
- Keep public customer command compatibility while validating table/order/store consistency on the server.
- Align the Functions package engine with the configured Firebase runtime.

#### Impact Scope

- Functions source and package metadata.
- Client order command services only at the wrapper boundary.
- Static check scripts and documentation.
- No Firestore rules tightening, no data migration, no hosting/functions deploy.

#### Verification

- `node --check` for Functions files.
- `npm run check`
- `npm run build`
- Confirm `git diff` does not include Firebase deploy output or Firestore rules tightening.

#### Verification Results

- `node --check functions/index.js functions/orderCommandApi.js functions/orderCommandAuth.js functions/orderCommandHandlers.js functions/orderCommandShared.js` passed.
- `npm run check:functions-rules-migration` passed.
- `npm run check` passed.
- Initial `npm run build` failed because `node_modules/firebase/functions/dist/esm/index.esm.js` was OneDrive online-only and unreadable.
- Reinstalled the local `node_modules/firebase` package from the existing lockfile; no package dependency change was introduced.
- `npm run build` passed after dependency hydration.
- No Firebase deploy was run.

### 2026-06-19 Order command UI compatibility

#### Purpose

- Take ownership of `docs/order-reliability/05-ui-compatibility.md`.
- Keep the existing customer QR, staff table, kitchen, and checkout routes intact while command-layer errors become understandable and retryable from the current UI.

#### Current State

- Customer start/order submit, staff additional order, seating, table move, checkout, kitchen serve/cancel, and table-detail serve/cancel are already routed through the client command layer.
- The command layer exposes structured `error.code` values such as `target-table-not-vacant`, `table-order-mismatch`, and `order-not-open`.
- Several UI callers still show generic `alert` messages or leave command failures as unhandled promise errors.

#### Change Policy

- Add a small shared command-error presentation helper instead of duplicating message logic across pages.
- Show short user-facing messages next to existing action areas, preserving routes and button placement.
- Keep retry behavior on the same existing action button/request flow; do not add a new route or a duplicate order entry path.
- Log operation name, error code, and narrow metadata through a shared helper for investigation without exposing secret values.

#### Impact Scope

- Customer guest-count start and cart submit.
- Staff additional-order submit, table detail seat/serve/cancel/move actions, kitchen serve/cancel actions, and checkout submit.
- Shared component/style and source checks only; no Firestore rules, Functions, data migration, or Firebase deploy in this phase.

#### Verification

- `npm run check:customer-entry`
- `npm run check:customer-cart`
- `npm run check:staff-table-detail`
- `npm run check:kitchen-display`
- `npm run check`
- `npm run build`

#### Verification Results

- `npm run check:customer-entry` passed.
- `npm run check:customer-cart` passed.
- `npm run check:staff-table-detail` passed.
- `npm run check:kitchen-display` passed.
- `npm run check:order-command-ui` passed.
- `npm run check` passed.
- `npm run build` passed.
- Local Vite dev server is running at `http://127.0.0.1:5174/`; `/`, `/staff`, and `/staff/kitchen` returned HTTP 200.
- No Firebase deploy was run.

### 2026-06-19 Data preservation audit script

#### Current State

- Order command writes have been centralized without deleting or moving existing `orders`, `orderItems`, `checks`, `staffActions`, menu, reservation, or table data.
- `tables.pendingCount` is legacy display state, and `pendingAggregate*` is maintained from `orderItems`; either can drift from the durable `orderItems` rows.
- The data-preservation slice should add visibility only. It must not run Firestore writes, data cleanup, broad updates, rules changes, Functions changes, or production deploys.

#### Audit Plan

- Add a read-only script that loads `tables` and currently ordered `orderItems`.
- Rebuild per-table pending totals from `orderItems` using the same count semantics as the current aggregate function: one pending `orderItems` document counts as one pending entry.
- Compare rebuilt totals with `tables.pendingCount`, `pendingAggregateCount`, `pendingAggregateDrinkCount`, and `pendingAggregateFoodCount`.
- Report missing table references, table/store mismatches, and vacant tables that still have pending items.
- Leave any repair write or data correction as a separate explicit task.

#### Verification

- Confirm the diff contains only docs, package script wiring, and a read-only audit script.
- Run the source scan from `02-data-preservation.md`.
- Run `npm run check`.
- Run `npm run build`.

### 2026-06-19 Data consistency repair dry-run tooling

#### Purpose

- Take ownership of `docs/order-reliability/10-data-consistency-repair.md`.
- Allow pending count drift to be inspected and repaired without deleting or moving order history, menu data, checks, reservations, or staff actions.

#### Current State

- `scripts/audit-pending-counts.mjs` already reports drift between `orderItems` and `tables.pendingCount` / `pendingAggregate*`.
- The next required piece is a dry-run first repair command that can rebuild only derived table count fields from `orderItems`.
- This step must not run production repair, deploy Firebase assets, migrate data, or tighten rules.

#### Change Plan

- Extract shared pending-count audit logic into `scripts/lib/pending-count-audit.mjs`.
- Keep the audit command read-only.
- Add `scripts/repair-pending-counts.mjs` with `--store <storeId>` required and dry-run as the default.
- Allow writes only with `--apply`, and limit writes to:
  - `tables.pendingCount`
  - `tables.pendingAggregateVersion`
  - `tables.pendingAggregateCount`
  - `tables.pendingAggregateDrinkCount`
  - `tables.pendingAggregateFoodCount`
- Keep missing table references, store mismatches, and other history-judgment issues as report-only.

#### Verification

- `npm run check:data-consistency-repair`
- `npm run audit:pending-counts -- --help`
- `npm run repair:pending-counts -- --help`
- `npm run repair:pending-counts -- --json` should fail without `--store`.
- `npm run check`
- `npm run build`

### 2026-06-19 Command layer continuation from handoff

#### Current State

- `src/lib/orderCommands.js` and `src/services/orderCommandService.js` have been added as the first command boundary.
- Customer order start, customer cart submit, staff order submit, and staff seating now delegate to the command layer.
- No production deploy, Firestore data deletion, Firestore migration, rules change, or Functions change is part of this step.

#### Checkout Command Plan

- Move `completeCashCheckout` behind `completeCheckoutCommand`.
- Keep existing `checks`, `orders`, `tables`, and `staffActions` collections.
- Use a Firestore transaction to create the check, mark the order checked out, clear only the related table, and record the staff action together.
- Use a deterministic check document id per order so repeated checkout attempts do not create multiple checks.
- Reject mismatched table/order/store state instead of trying to repair live data in this client-side step.

#### Verification

- Review `git diff` for import drift and command-service size.
- Run `npm run check`.
- Run `npm run build`.
- Commit and push only after checks pass.

### 2026-06-19 Finish client command boundary

#### Current State

- Checkout is now delegated to `completeCheckoutCommand`.
- Remaining direct order writes are staff/kitchen served toggles, item cancellation, and table moves.

#### Command Plan

- Add transaction-backed commands for:
  - `markOrderItemServedCommand`
  - `markOrderItemOrderedCommand`
  - `cancelOrderItemCommand`
  - `moveTableOrderCommand`
- Adjust `tables.pendingCount` only from the current item status read inside the transaction:
  - `ordered -> served` decrements once.
  - `served -> ordered` increments once.
  - `ordered -> cancelled` decrements once.
  - Already `served` or `cancelled` states do not double-decrement.
- Keep passcode validation in the staff-table wrapper, then put the item update, table counter update, and `staffActions` write into the command transaction.
- Move table state, `orders.tableId`, and known `orderItems.tableId` together when a table is moved.
- Do not delete Firestore data, run migrations, change rules, change Functions, or deploy hosting/functions in this phase.

#### Verification

- Run `npm run check`.
- Run `npm run build`.
- Confirm no direct order mutation path remains outside the command wrapper except non-order table guest-count/admin flows.
- Commit and push after verification.

### 2026-06-19 Command failure logging for order boundary

#### Current State

- The client-side command boundary now covers customer start, customer/staff submit, staff seating, checkout, served/revert, cancel, and table move.
- The remaining gap in `01-command-boundary.md` is failure visibility: when a transaction or permission error happens, the current UI only sees a simple failure and there is no command-level debug trail.

#### Command Plan

- Add a small best-effort failure logger for order commands.
- Record command type, actor type, store id, table id, order id, item id, client request id, error code, error name, error message, command version, and timestamp where available.
- Keep logging outside the transaction so the original command outcome is not changed.
- If logging itself fails, do not replace the original order error.
- Add local Firestore rules for the new log collection, but do not deploy rules in this phase.
- Do not change visible UI, run data migrations, delete Firestore data, change Functions, or deploy production assets.

#### Verification

- Run `npm run check:order-command-boundary`.
- Run `npm run check`.
- Run `npm run build`.
- Commit and push after verification.

### 2026-06-19 Concurrency test responsibility

#### Purpose

- Cover `docs/order-reliability/03-concurrency-tests.md`.
- Add repeatable regression checks for crowded customer entry, retry/double-tap, delayed submit after checkout, and staff concurrent item/table operations.

#### Current State

- The repo uses lightweight `scripts/check-*.mjs` Node checks instead of a dedicated test runner.
- Command writes are already centralized enough to validate the expected semantics without touching production data.
- No Firebase deploy, Firestore migration, Functions change, or production load test is part of this step.

#### Change Plan

- Add a mock command-concurrency check script that models the command invariants with in-memory tables, orders, orderItems, and checks.
- Reuse production command id helpers for idempotent order item document ids.
- Add source guards so the mock expectations stay tied to the transaction/idempotency code paths in the real services.
- Register the check in `package.json` and include it in `npm run check`.

#### Impact Scope

- Test/check tooling and order reliability documentation only.
- Runtime UI and Firestore write behavior should not change in this phase.

#### Verification

- `npm run check:order-concurrency`
- `npm run check`
- `npm run build`

## 2026-06-14 Customer guest auto-add loading guard

### Context

- Customer QR order start can be shown before `storeConfig` finishes loading.
- The guest auto-add setting lives in `storeConfig.guestAutoAdd`.
- If a customer starts from the guest-count screen while the config is still at defaults, the order session is created with auto-add effectively OFF even though the store has configured it.

### Decision

- Treat table loading and store-config loading as separate required startup work.
- Do not render the guest-count, menu, cart, or complete routes until the current table's store config has loaded.
- Reset config state when a different QR token/store is loaded so stale config from another store cannot leak into the order start.
- Keep the existing guest auto-add UI and order creation shape unchanged.

### Verification Plan

- Add a source check that asserts the order entry route waits on `configLoading`.
- Run `npm run check:customer-entry`.
- Run `npm run check`.
- Run `npm run build`.
- Commit and push the fix.

### Verification Results

- `npm run check:customer-entry` passed.
- `npm run check` passed.
- `npm run build` passed.
- Local Vite served `/order/__codex_missing_qr__/guests`; the route rendered the expected invalid-QR state with no browser console errors.
- `npx --yes firebase-tools deploy --only hosting --project qrproduct-3340b --non-interactive` completed.
- Live hosting HTML references the deployed asset `assets/index-BmWfh4Tr.js`.

## 2026-06-14 Google login redirect hotfix

### Context

- Google login stopped working after the latest live update.
- Live verification showed the login page renders without app errors and OAuth can start, but popup completion is unreliable.
- User priority: fix login without disturbing people currently using the store screens.
- Follow-up report: desktop login works, but the Google login button can become unpressable in another environment.

### Decision

- Limit the change to Google login flow only.
- Replace popup-based Google sign-in with redirect-based sign-in.
- After redirect completion, send non-anonymous Google users back to `/staff`.
- Do not touch seat, kitchen, menu, order, or checkout behavior in this hotfix.
- Do not set the shared login `loading` state when Google redirect starts, because a stalled redirect can leave the button disabled.

### Verification Plan

- Run production build.
- Confirm `/login` renders locally without new console errors beyond existing React Router future warnings.
- Deploy hosting only after build succeeds.
- Confirm live `/login` returns the new asset and renders.
- Commit and push the hotfix.

### Verification Results

- `npm run build` passed.
- `npm run check` passed.
- Local `/login` rendered in the in-app browser; only existing React Router future warnings appeared.
- `npx --yes firebase-tools deploy --only hosting --project qrproduct-3340b --non-interactive` completed.
- Live `/login` returned `assets/index-YM8taRxf.js` and rendered the Google login button.
- Follow-up button-state fix deployed; live `/login` now returns `assets/index-CpJsCPKd.js`, and the Google button is enabled with no blocking overlay or console error.

## 2026-06-13 Seat and data loading performance guardrails

### Context

- Some staff/customer screens occasionally take a long time to load seat or store data.
- User priority: performance fixes must not change existing features, screen layout, visual design, navigation, button placement, or normal operation flow.
- Faster loading should feel like the same system becoming more responsive, not like a redesigned workflow.

### Decision

- Preserve current UI and behavior while improving Firestore reads.
- Start with low-risk infrastructure changes such as Firestore indexes and query narrowing.
- Do not remove an existing live subscription until a staged comparison confirms the replacement data path is accurate.
- Keep kitchen/order/detail screens functionally unchanged; optimize only the data-fetching layer unless a visible change is explicitly approved.
- If aggregate fields such as table pending counts are expanded, provide a repair or verification path before relying on them as the only source of truth.
- During live store use, avoid disruptive swaps: deploy additive fields/functions/indexes first, keep old reads as fallback for already-open sessions, and let new sessions move to the faster path.

### Verification Plan

- Confirm the staff table list, kitchen, table detail, customer menu, cart, and checkout flows still render the same visible states.
- Run the relevant source checks and production build before deploy.
- Commit and push every file change.

### Implementation Notes

- Add `pendingAggregateCount`, `pendingAggregateDrinkCount`, and `pendingAggregateFoodCount` beside legacy `pendingCount`; do not repurpose `pendingCount`.
- Use a Cloud Function to maintain aggregate fields from `orderItems`, so unauthenticated QR orders do not depend on table update permissions.
- Staff table list uses aggregate fields only when `pendingAggregateVersion` is present; already-open legacy sessions keep the old `orderItems` fallback.
- Add persistent Firestore web cache and query narrowing where the visible result is identical.

### Verification Results

- `npm run check` passed.
- `npm run build` passed.
- `node --check functions/index.js` passed.
- Local `/staff` rendered in the in-app browser with no console errors.
- `npx --yes firebase-tools deploy --only firestore:indexes --project qrproduct-3340b --non-interactive` completed.
- Added aggregate Cloud Functions were created in `asia-northeast1`; existing `notifyStaff` remained deployed.
- Artifact cleanup policy for `asia-northeast1` was set after the Functions deploy warning.
- `npx --yes firebase-tools deploy --only hosting --project qrproduct-3340b --non-interactive` completed.
- Live `/staff` returned the deployed asset `assets/index-D6kOGVZG.js` and rendered with no console errors.

## 2026-06-13 Staff store-management menu consolidation

### Context

- Staff header buttons had grown too wide as management actions were added individually.
- User priority: keep the operational UI smart and compact by grouping history, seats, menu management, register closing, and related admin tools under a single `店舗管理` entry.
- User priority: refresh should feel like Safari pull-to-refresh from the top of the staff page and must be visually understandable while pulling.
- In app/PWA use, the bottom staff navigation should sit just slightly above the physical bottom edge for readability.

### Decision

- Keep daily operation buttons visible: `注文`, staff switch, kitchen, and logout.
- Remove the header refresh button because it consumes prime action space and is not part of the normal order flow.
- Preserve refresh access in app use with a compact pull-to-refresh gesture on the staff shell, including `下に引いて更新`, `離すと更新`, and `更新中...` states.
- Move elevated/admin actions into one permission-aware `店舗管理` popover in the staff shell header.
- Move sound and device notification controls into the existing settings screen; remove the separate header gear button.
- Preserve the existing `/staff/...` routes and permission gates so deep links and current page behavior continue to work.
- Raise customer/staff fixed bottom navigation by a small offset while preserving safe-area padding.

### Verification Plan

- Update the staff permission source check to assert the grouped management menu remains wired.
- Assert the refresh button stays removed and the pull-to-refresh UI remains wired.
- Run `npm run check:staff-permissions`.
- Run `npm run build`.
- Verify the staff screen in a mobile viewport.
- Commit and push the change.

### Verification Results

- `npm run check:staff-permissions` passed.
- `npm run check` passed.
- `npm run build` passed.
- Local Vite served `/staff` in a mobile viewport and reached the existing store-code entry screen with only existing React Router future warnings.
- Source assertions confirm the staff shell no longer emits the direct `更新` button and keeps the pull-to-refresh DOM/CSS wired.

## 2026-06-13 Admin settings device sound controls

### Context

- The settings menu already hosts store-level workflow controls.
- Users expect call sound and notification sound choices to be reachable from that settings surface instead of only from per-screen popups.
- Existing sound preferences are device-local so hall and kitchen terminals can keep different sound and volume choices.
- The old header gear still owned only the device notification registration toggle, so keeping it would leave a duplicate settings path.

### Decision

- Add a device sound section to `SettingsPage`.
- Reuse `lib/sounds.js` sound IDs, preview playback, and localStorage persistence.
- Keep the store-wide notification toggle in the existing workflow settings.
- Show the device notification ON/OFF registration control inside settings when the page is opened from the staff shell.
- Remove the old staff header gear popup and its dead CSS/component files.

### Verification Plan

- Run `npm run check:settings`.
- Run `npm run build`.
- Commit and push the change.

### Verification Results

- `npm run check:settings` passed.
- `npm run check:staff-permissions` passed.
- `npm run build` passed.
- Local Vite served `/login` successfully with no new browser console errors; `/admin/settings` remains behind the existing logged-in protected route.

## 2026-06-13 Customer QR checkout reset guard

### Context

- After staff checkout, a customer revisiting an old QR child URL such as `/menu` or `/complete` could avoid the normal `/guests` entry route.
- A vacant table has no active `currentOrderId`, so those child screens should not load menu products or order status data.
- Live read-only verification confirmed the base QR URL redirects to `/guests`, while a stale `/menu` URL could still load the menu for a vacant table.

### Decision

- Guard customer QR child routes in `OrderEntryPage`.
- If there is no active `orderId`, redirect `/menu`, `/cart`, and `/complete` to `/guests`.
- If there is already an active `orderId`, redirect `/guests` to `/menu`.

### Verification Plan

- Run `npm run check:customer-entry`.
- Run `npm run build`.
- Verify a vacant table's stale `/menu` and `/complete` URLs redirect to `/guests` after deploy.

### Verification Results

- `npm run check:customer-entry` passed in a clean deploy worktree.
- `npm run check` passed in a clean deploy worktree.
- `npm run build` passed in a clean deploy worktree.
- `npx --yes firebase-tools deploy --only hosting --project qrproduct-3340b --non-interactive` completed from the clean deploy worktree.
- Live hosting HTML references `assets/index-wnV88Uo6.js`.
- A vacant table's stale `/menu` URL redirected to `/guests`.
- A vacant table's stale `/complete` URL redirected to `/guests`.

## 2026-06-13 Staff admin order-screen return button

### Context

- Staff management can be opened inside the staff shell at `/staff/staff-admin`.
- Users need an obvious way to return from staff/admin tools to the order-taking table list.
- The order-taking entry point is `/staff`.

### Decision

- Add a persistent `注文` button to the staff shell header.
- Keep the destination scoped to `/staff` and avoid changing staff permission or admin page logic.

### Verification Plan

- Run `npm run check:staff-permissions`.
- Run `npm run build`.
- Commit and push the change.

### Verification Results

- `npm run check:staff-permissions` passed.
- `npm run build` passed.
- Local Vite server loaded `/staff/staff-admin` to the staff entry screen; the logged-in header path is covered by the source assertion for `onOpenOrders` and the `注文` button.

## 2026-06-13 Customer order false error hotfix

### Context

- Users reported that QR customer orders reached kitchen/register screens, but the customer screen still showed an error.
- Local inspection found `submitCustomerCartOrder` creates `orderItems` first, then updates `tables.pendingCount`.
- Firestore rules allow public `orderItems` creation, while table updates are restricted except for initial seating.

### Decision

- Keep customer order item creation unchanged.
- Treat `tables.pendingCount` sync as non-critical after `orderItems` creation succeeds.
- Do not change Firestore rules during active production use.

### Verification Plan

- Run `npm run check:customer-cart`.
- Run `npm run check:customer-entry`.
- Run `npm run build`.
- Commit and push the hotfix.
- Deploy hosting only if Firebase tooling/auth is available from this machine.

### Verification Results

- `npm run check:customer-cart` passed.
- `npm run check:customer-entry` passed.
- `npm run check` passed.
- `npm run build` passed.
- `npx --yes firebase-tools deploy --only hosting --project qrproduct-3340b --non-interactive` completed.
- Live hosting HTML references the deployed build assets `assets/index-CzkQ-u9w.js` and `assets/index-D6g3bT6Z.css`.

## 2026-06-15 Reservation arrival notices and waiting guidance

### Context

- Reservations need two staff-wide notices: one when a reservation is registered, and one 10 minutes before the reservation time.
- Users want the staff floor to see unresolved reservation arrivals until someone intentionally handles them.
- Seat assignment must stay optional because seats may be created later, but a specified vacant seat can be used automatically.
- If the specified seat is occupied or the reservation has no seat, the system should not force a seat. It should leave a visible waiting notice with actions to open the seat, choose another seat, or dismiss the notice.

### Decision

- Store `reservationAt`, `arrivalNoticeAt`, `arrivalNoticeStatus`, and `waitingStatus` fields on new reservations.
- Use Cloud Functions to notify on creation and run the 10-minute-before arrival workflow every minute.
- Auto-seat only when a reservation has a specified table and that table is vacant.
- For seat conflicts or unassigned reservations, set `waitingStatus: pending` and show a staff-shell banner across staff pages.
- Staff can guide a waiting reservation to any table. Vacant tables create a new order session; occupied tables require confirmation and overwrite the table/current order guest count to the reservation count.
- Staff table list and kitchen show today's confirmed reservations as `予約あり`, including time and party size.
- Keep reservation edit permissions under `manageReservations`; only the narrow waiting-notice handling fields can be updated by logged-in store staff.

### Verification Plan

- Run `npm run check:reservation-display`.
- Run `npm run check`.
- Run `npm run build`.
- Browser-check `/staff/reservations`, `/staff`, and `/staff/kitchen`.
- Deploy Firestore rules/indexes, Functions, and Hosting, then commit and push `codex/reservation-arrival-notices`.

## 2026-06-20 Staff pull refresh nested scroll guard

### Context

- User feedback: while scrolling from lower content upward, the staff screen refreshes before the visible content reaches the top.
- Local confirmation: `src/hooks/usePullToRefresh.js` currently checks only `window.scrollY`. Recent staff table detail and checkout fixes added internal scroll containers, so `window.scrollY` can stay `0` while the touched content is still scrolled.

### Decision

- Keep the staff pull-to-refresh feature, but do not start it from an internal scroll container unless the gesture is truly at the document-level top.
- Avoid changes to orders, checkout commands, menus, QR URLs, Firestore rules, Functions, indexes, or storage.
- Add a source check so future scroll layout changes do not reintroduce this behavior.

### Verification Plan

- Run `npm run check:staff-permissions`.
- Run `npm run check:staff-table-detail`.
- Run `npm run check:checkout`.
- Run `npm run build`.
- Commit, push, then deploy Hosting only if checks pass.

## 2026-06-20 Kitchen crowded table visibility

### Context

- User feedback: when many items come from one table, the kitchen panel becomes too tall and requires excessive page scrolling, making orders hard to see.
- Current confirmation: `KitchenTableCard` renders all items in a single unbounded vertical list, so one busy table can dominate the entire kitchen grid.

### Decision

- Keep the previous kitchen panel look and served optimistic hide behavior.
- Bound each kitchen table card height so one table cannot stretch the whole kitchen screen.
- Make only the item list scroll inside the card; table name, guest count, item count, wait time, and all-served action remain visible.
- Let crowded cards span two grid columns on wider screens and render item rows in two columns to show more items at once.
- Do not change order data, menu data, QR URLs, Firestore rules, Functions, indexes, or storage.

### Verification Plan

- Run `npm run check:kitchen-display`.
- Run `npm run check:order-command-ui`.
- Run `npm run check`.
- Run `npm run build`.
- Commit, push, then deploy Hosting only if checks pass.

## 2026-06-20 Kitchen item attribution and compact option display

### Context

- User feedback: kitchen item details show `〇分前 ・ スタッフ`, but the actual staff member name is not shown.
- Local confirmation: staff order item payloads currently store only `orderedBy: 'staff'`; `activeStaff.name` is not passed through `StaffMenuPage -> submitStaffOrderItems -> orderItems`.
- User feedback: elapsed time is too close to the dark background and needs slightly better contrast.
- User feedback: option labels such as sauce/salt should sit next to the product name instead of occupying a separate row that makes the item taller.

### Decision

- For new staff-added order items, store `orderedByStaffId` and `orderedByStaffName` from the current active staff.
- Show `orderedByStaffName` on the kitchen panel when present, with `スタッフ` as a fallback for older items.
- Make the elapsed time a small higher-contrast chip, without making the row visually heavy.
- Move option text into the title line beside the product name/quantity and keep wrapping compact.
- Existing order history/menu/QR URLs remain untouched. Firestore rules/indexes/storage remain untouched. Deploy target is Hosting plus only `functions:submitStaffOrderItemsCommand`.

### Verification Plan

- Run `npm run check:kitchen-display`.
- Run `npm run check:order-command-ui`.
- Run `npm run check:order-functions-mainline`.
- Run `npm run check:order-functions-emulator`.
- Run `npm run check`.
- Run `npm run build`.
- Commit, push, deploy Hosting and `functions:submitStaffOrderItemsCommand`, then verify live assets and Functions list.

## 2026-06-20 Order menu internal scroll hardening

### Context

- User feedback: the order screen still does not behave like a proper scrollable screen.
- Local confirmation: the customer menu page has no bounded internal scroll container, and the staff order-add page relies on a weak viewport calculation around fixed bars.

### Decision

- Customer menu: make the page a viewport-height shell and put category tabs plus product rows in `customer-menu__scroll`.
- Staff order-add: keep the existing bounded scroll region but harden viewport height, max-height, mobile momentum scrolling, and bottom fixed-bar spacing.
- Keep product row behavior, cart behavior, option modal, order submission, menu data, order history, QR URLs, Firestore rules, Functions, indexes, and storage unchanged.

### Verification Plan

- Run `npm run check:staff-menu`.
- Run `npm run check:customer-cart`.
- Run `npm run check`.
- Run `npm run build`.
- Commit, push, then deploy Hosting only if checks pass.

## 2026-06-20 Customer order confirmation wording and category clarity

### Context

- User feedback: the customer-side bottom `会計` button looks like it starts checkout immediately; it should feel more like an order confirmation entrypoint first, then allow checkout from the confirmation screen.
- User feedback: customer category tabs may be easier to scan if food/drink grouping is shown a little more clearly.

### Decision

- Customer bottom nav: default checkout entry label becomes `注文確認`, and the icon label becomes `確認` until the customer is on the actual checkout request step.
- Order status checkout step: when the customer is confirming checkout, the bottom action reads `会計依頼` so the real checkout action is clear after entering order confirmation.
- Customer category tabs: show a compact `フード` / `ドリンク` badge from the existing `category.group` value. Keep the category name primary and avoid making the tabs visually heavy.
- Do not change order submission, order history data, menu records, category records, QR URLs, Firestore rules, Functions, indexes, or storage.

### Verification Plan

- Run `npm run check:customer-cart`.
- Run `npm run check:customer-order-status`.
- Run `npm run check`.
- Run `npm run build`.
- Commit, push, then deploy Hosting only if checks pass.
