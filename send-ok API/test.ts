import express, { Request, Response, NextFunction } from 'express';
import bodyParser from 'body-parser';
import { db } from './database.ts'; // データベース接続モジュール（仮）
import { RequestHandler } from 'express';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(bodyParser.json());

// 認証ミドルウェア
const authenticate: RequestHandler = (req, res, next) => {
  const secretKey = req.headers['matsuri-symmetric-key'];

  if (secretKey !== '3N37m-ZKYm0YJAj03iqqJrVgOl1-4_g1cmXMnvRIFh0') {
    // ここで実際にレスポンスを返している
    res.status(401).json({ error: 'キーが違うよorないよ' });
    return; 
    // ↑ 関数の戻り値としては「undefined」になる。Responseを"return"していない
  }

  // 認証OKの場合だけ next() を呼ぶ
  next();
};

// データベースから3Hカラムの値を取得する関数
const getTemplateIsForceSendStatus = async (confirmationCode: string): Promise<boolean> => {
  try {
    const query = `
      SELECT
        tsp.is_force_send
      FROM
        \`m2m-core.su_wo.today_send_planner_log\` AS tsp
      WHERE
        tsp.confirmation_code = @confirmation_code
    `;

    const result = await db.query(query, { confirmation_code: confirmationCode });
    return result.length > 0 && result[0].is_force_send === true;
    
  } catch (error) {
    console.error('Error fetching 3H status:', error);
    return false; // デフォルト値
  }
};

// 送信可否判定ロジック
const canSendMessage = async (confirmationCode: string, lastSentAt: string, reservationStatus: string): Promise<boolean> => {
  if (!confirmationCode || !lastSentAt || !reservationStatus) return false;

  // 条件1: 予約ステータスが適切であること
  const forbiddenStatuses = ['Canceled', 'Unknown'];
  const isStatusValid = !forbiddenStatuses.includes(reservationStatus);

  // 条件2: 最終送信から3時間以上経過していること
  const lastSentDate = new Date(lastSentAt);
  const now = new Date();
  const diffHours = (now.getTime() - lastSentDate.getTime()) / (1000 * 60 * 60);
  let isTimeValid = diffHours >= 3;

  // 追加ロジック: 3Hカラムの値がTRUEなら、isTimeValidをTRUEにする
  const templateIsForceSendStatus = await getTemplateIsForceSendStatus(confirmationCode);
  if (templateIsForceSendStatus) {
    isTimeValid = true;
  }

  // すべての条件がTRUEなら送信OK
  return isStatusValid && isTimeValid;
};

// メインエンドポイント
app.post('/send', authenticate, async (req: Request, res: Response): Promise<void> => {
  const { confirmation_code, last_sent_at, reservation_status } = req.body;

  if (!confirmation_code || !last_sent_at || !reservation_status) {
    // 400を返して、そこで処理終了
    res.status(400).json({ error: 'bad requestだにょデータ形式なおせよ' });
    return; // ← 関数としては何も（void）返さない
  }

  try {
    const isSendable = await canSendMessage(confirmation_code, last_sent_at, reservation_status);

    // クライアントへレスポンス送信
    res.json({ status: isSendable ? 'OK' : 'NG' });
    return;
  } catch (error) {
    // 500エラーを返して終了
    res.status(500).json({ error: 'ごめんちょ' });
    return;
  }
});


// 404ハンドリング
app.use((req, res) => {
  res.status(404).json({ error: '404 not foundだにょん' });
});

// サーバー起動
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
