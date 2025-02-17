import express, { Request, Response } from 'express';
import bodyParser from 'body-parser';
import { GuestAttribute, GuestJourneyPhase, GuestJourneyEvent } from './services/guest';

const app = express();
app.use(bodyParser.json());

app.post('/api/process', (req: Request, res: Response) => {
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

    const guest = new GuestAttribute(listing_id, nationality, confirmation_code);
    const journey = new GuestJourneyPhase(new Date().toISOString(), booked_date, checkin_date, checkout_date, confirmation_code);

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
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
