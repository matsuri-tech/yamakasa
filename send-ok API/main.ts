import express, { Request, Response, NextFunction } from 'express';
import bodyParser from 'body-parser';
import { db } from './database'; // データベース接続モジュール（仮）

const app = express();
const PORT = process.env.PORT || 3000;

app.use(bodyParser.json());

// 認証ミドルウェア
const authenticate = (req: Request, res: Response, next: NextFunction): void => {
  const secretKey = req.headers['matsuri-symmetric-key'];
  if (secretKey !== '3N37m-ZKYm0YJAj03iqqJrVgOl1-4_g1cmXMnvRIFh0') {
    res.status(401).json({ error: 'キーが違うよorないよ' });
    return; // ここで明示的に関数を終了
  }
  next();
};


// データベースから3Hカラムの値を取得する関数
const getTemplateIsForceSendStatus = async (confirmationCode: string): Promise<boolean> => {
  try {
    const query = `
      SELECT tsp.is_force_send 
      FROM m2m-core.su_wo.today_send_planner_log AS tsp
      WHERE tsp.confirmation_code = ?
    `;
    const result = await db.query(query, [confirmationCode]);

    // レコードが見つからない場合はエラーを投げる（404扱い）
    if (result.length === 0) {
      throw { status: 404, message: 'confirmation_code が見つからない' };
    }

    return result[0]['is_force_send'] === true;
  } catch (error) {
    console.error('Error fetching is_force_send status:', error);

    // 404エラーが発生した場合はそのまま投げる
    if (error.status === 404) {
      throw error;
    }

    return false; // その他のエラー時はデフォルトで false を返す
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
    res.status(400).json({ error: 'bad requestだにょデータ形式なおせよ' });
    return; // 明示的に関数を終了する
  }

  try {
    const isSendable = await canSendMessage(confirmation_code, last_sent_at, reservation_status);
    res.json({
      status: isSendable ? 'OK' : 'NG'
    });
    return;
  } catch (error) {
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
