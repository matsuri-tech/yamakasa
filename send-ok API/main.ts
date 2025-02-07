import express, { Request, Response, NextFunction } from 'express';
import bodyParser from 'body-parser';
import { db } from './database'; // データベース接続モジュール（仮）

const app = express();
const PORT = process.env.PORT || 3000;

app.use(bodyParser.json());

// 認証ミドルウェア
const authenticate = (req: Request, res: Response, next: NextFunction) => {
  const secretKey = req.headers['matsuri-symmetric-key'];
  if (secretKey !== '3N37m-ZKYm0YJAj03iqqJrVgOl1-4_g1cmXMnvRIFh0') {
    return res.status(401).json({ error: 'キーが違うよorないよ' });
  }
  next();
};

// データベースから3Hカラムの値を取得する関数
const getTemplate3HStatus = async (confirmationCode: string): Promise<boolean> => {
  try {
    // ここのテーブル名とスキーマ名をなおす、3H以内に送信する場合をTとしているが、絶対に送る、をTにしているのでロジックを変更する
    const query = `
      SELECT yt.3H FROM m2m-core.su_wo.table sw
      JOIN m2m-core.su_wo.yamakasa_template yt ON sw.template_id = yt.id
      WHERE sw.confirmation_code = ?
    `;
    const result = await db.query(query, [confirmationCode]);
    return result.length > 0 ? result[0]['3H'] === true : false;
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

  // 追加ロジック: 3Hカラムの値がFALSEなら、isTimeValidをTRUEにする
  const template3HStatus = await getTemplate3HStatus(confirmationCode);
  if (!template3HStatus) {
    isTimeValid = true;
  }

  // すべての条件がTRUEなら送信OK
  return isStatusValid && isTimeValid;
};

// メインエンドポイント
app.post('/send', authenticate, async (req: Request, res: Response) => {
  const { confirmation_code, last_sent_at, reservation_status } = req.body;

  if (!confirmation_code || !last_sent_at || !reservation_status) {
    return res.status(400).json({ error: 'bad requestだにょデータ形式なおせよ' });
  }

  try {
    const isSendable = await canSendMessage(confirmation_code, last_sent_at, reservation_status);
    return res.json({
      status: isSendable ? 'OK' : 'NG'
    });
  } catch (error) {
    return res.status(500).json({ error: 'ごめんちょ' });
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
