import express from 'express';
import bodyParser from 'body-parser';
import { GuestAttribute, GuestJourneyPhase, GuestJourneyEvent } from './services/guest';
import { BigQueryUtility } from './services/utility'

const app = express();
app.use(bodyParser.json());

app.post('/api/process', async (req, res) => {
    const symmetricKey = req.headers['matsuri-symmetric-key'] as string; 
    const planningKey = req.headers['from-planning-key'] as string; 

    if (!symmetricKey && !planningKey) {
        return res.status(401).json({ message: 'キーが違うよorないよ' });
    }

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
    
    // 新しい変数名に代入しておく
    const status_review = guest_review_submitted;
    const status_precheckin = pre_checked_in;
    const nationality = nationalities;

    if (!confirmation_code) {
        return res.status(400).json({ message: 'bad requestだにょデータ形式なおせよ' });
    }

    // 1. BigQueryUtility をインスタンス化
    const bigQueryUtility = new BigQueryUtility();

    try {
        // 2. get_listing_id を呼び出して GuestAttribute インスタンスを取得
        const guest = await GuestAttribute.get_listing_id(
          confirmation_code,
          bigQueryUtility,
          nationality
        );
    
        // 3. fetchGuestJourneyData を呼び出して GuestJourneyPhase インスタンスを取得
        const journey = await GuestJourneyPhase.fetchGuestJourneyData(
          confirmation_code,
          bigQueryUtility,
          status_precheckin
        );

        // 3. fetchGuestJourneyEventDat を呼び出して GuestJourneyEvent インスタンスを取得
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

        //ここでdata_dictにGuest, Journey, Eventをまとめて入れる
        const data_dict = {
          // guest 由来のフィールドをまとめる
          listing_id: guest?.listing_id ?? null,
          nationality: guest?.nationality ?? null,
          confirmation_code: confirmation_code,
          // journey 由来のフィールドをまとめる
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
          // event 由来のフィールドをまとめる
          trouble_genre: event?.trouble_genre_user ?? null,
          days_from_precheckin: event?.days_from_precheckin ?? null,
          cleaning_delay: event?.cleaning_delay ?? null,
          guest_review_submitted_at: event?.guest_review_submitted_at ?? null,
          status_precheckin: status_precheckin,
          status_review: status_review,
          days_from_review: event?.days_from_review ?? null,
        };
    
        // 結果をレスポンスに含めるなど
        res.status(200).json(data_dict);
      } catch (error) {
        res.status(500).json({ message: "BigQueryエラー", error });
      }

    /*
    if (symmetricKey) {
        return res.status(200).json({
            template_id: 'checkInV2',
            message: 'ここにメッセージを入れてください'
        });
    } else if (planningKey) {
        return res.status(200).json({
            template_id: 'checkInV2',
            priority: 1,
            message_posting_time: '2025-01-15 17:30',
            "3H": false
        });
    }
        

    return res.status(500).json({ message: 'ごめんちょ' });
    */
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
