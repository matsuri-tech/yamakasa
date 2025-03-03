import express, { Request, Response, NextFunction } from 'express';
import bodyParser from 'body-parser';
import { GuestAttribute, GuestJourneyPhase, GuestJourneyEvent } from './services/guest';
import { BigQueryUtility } from './services/utility'
import { SQL } from './services/template';          // SQL クラスをインポート
import { FilterTemplateByCode } from './services/template';  // FilterTemplateByCode クラスをインポート

const app = express();
app.use(bodyParser.json());

const authenticate = (req: Request, res: Response, next: NextFunction) => {
  const symmetricKey = req.headers['matsuri-symmetric-key'] as string | undefined;
  const planningKey = req.headers['from-planning-key'] as string | undefined;

  // 両方のキーが無い
  if (!symmetricKey && !planningKey) {
    return res.status(401).json({ message: 'キーが違うよorないよ' });
  }

  // 正しいキーの定義
  const VALID_SYMMETRIC_KEY = '3N37m-ZKYm0YJAj03iqqJrVgOl1-4_g1cmXMnvRIFh0';
  const VALID_PLANNING_KEY = 'f4491d6e-b601-0db4-7781-939690a798bd';

  if (symmetricKey && symmetricKey !== VALID_SYMMETRIC_KEY) {
    return res.status(401).json({ message: 'キーが違うよorないよ' });
  }
  if (planningKey && planningKey !== VALID_PLANNING_KEY) {
    return res.status(401).json({ message: 'キーが違うよorないよ' });
  }

  next();
};

// ミドルウェアをルートの前に挟む
app.use('/api/process', authenticate);

app.post('/api/process', async (req, res) => {
  const body = req.body as {
    confirmation_code: string;
    guest_review_submitted: boolean;
    guest_review_submitted_at: string | null;
    pre_checked_in: boolean;
    nationalities: string[];
  };
  const {
    confirmation_code,
    guest_review_submitted,
    guest_review_submitted_at,
    pre_checked_in,
    nationalities,
  } = body;

  const status_review = guest_review_submitted;
  const status_precheckin = pre_checked_in;
  const nationality = nationalities;

  if (!confirmation_code) {
    return res.status(400).json({ message: 'bad requestだにょデータ形式なおせよ' });
  }

  // BigQueryUtility をインスタンス化
  const bigQueryUtility = new BigQueryUtility();

  try {
    // 1. ゲストの属性を取得
    const guest = await GuestAttribute.get_listing_id(
      confirmation_code,
      bigQueryUtility,
      nationality
    );

    // 2. ゲストの予約関連データを取得
    const journey = await GuestJourneyPhase.fetchGuestJourneyData(
      confirmation_code,
      bigQueryUtility,
      status_precheckin
    );

    // 3. ゲストのイベントデータを取得
    const event = await GuestJourneyEvent.fetchGuestJourneyEventData(
      confirmation_code,
      guest_review_submitted_at,
      status_precheckin,
      status_review,
      bigQueryUtility
    );

    console.log("Guest:", guest);
    console.log("Journey:", journey);
    console.log("Event:", event);

    // 4. data_dictにGuest, Journey, Eventをまとめる
    const data_dict = {
      listing_id: guest?.listing_id ?? null,
      nationality: guest?.nationality ?? null,
      confirmation_code: confirmation_code,
      today_date: journey?.today_date ?? null,
      booked_date: journey?.booked_date ?? null,
      checkin_date: journey?.checkin_date ?? null,
      checkout_date: journey?.checkout_date ?? null,
      days_from_booking: journey?.days_from_booking ?? null,
      days_from_checkin: journey?.days_from_checkin ?? null,
      days_from_checkout: journey?.days_from_checkout ?? null,
      status_booked: journey?.status_booked ?? null,
      status_checkin: journey?.status_checkin ?? null,
      status_checkout: journey?.status_checkout ?? null,
      trouble_genre: event?.trouble_genre_user ?? null,
      days_from_precheckin: event?.days_from_precheckin ?? null,
      cleaning_delay: event?.cleaning_delay ?? null,
      guest_review_submitted_at: event?.guest_review_submitted_at ?? null,
      status_precheckin: status_precheckin,
      status_review: status_review,
      days_from_review: event?.days_from_review ?? null
    };

    // 5. SQL クラスを使って、条件付きのテンプレート情報を取得
    const status_booked = journey?.status_booked ?? false;
    const status_checkin = journey?.status_checkin ?? false;
    const status_checkout = journey?.status_checkout ?? false;

    // テーブル名は実際の要件に応じて修正
    const sql = new SQL("m2m-core.su_wo.test_condition_table", bigQueryUtility);
    const templateConditions = await sql.transformToTemplateConditions(
      status_booked,
      status_checkin,
      status_checkout
    );

    // 6. FilterTemplateByCode を使って data_dict を条件配列に変換 → compareConditions で突合
    const filter = new FilterTemplateByCode();
    const guestInformation = filter.transformDataToConditions(data_dict);
    const compareResults = filter.compareConditions(guestInformation, templateConditions);

    //7.ヘッダーに含まれるキーによってレスポンスを変更
    const symmetricKey = req.headers['matsuri-symmetric-key'] as string | undefined;
    const planningKey = req.headers['from-planning-key'] as string | undefined;

    let shapedResults: any[] = [];

    if (symmetricKey) {
      shapedResults = compareResults.map(item => {
        return {
          template_id: item.template_id,
          message: item.message
        };
      });
    } else if (planningKey) {
      shapedResults = compareResults.map(item => {
        return {
          template_id: item.template_id,
          priority: item.priority,
          message_posting_time: item.message_posting_time,
          is_force_send: item.is_force_send
        };
      });
    }

    // レスポンスとして shapedResults を返す
    return res.status(200).json({
      shapedResults
    });

  } catch (error) {
    console.error("Error:", error);
    return res.status(500).json({ message: "BigQueryエラー", error });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});