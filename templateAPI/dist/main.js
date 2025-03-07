"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.main = void 0;
const express_1 = __importDefault(require("express"));
const body_parser_1 = __importDefault(require("body-parser"));
const guest_1 = require("./services/guest");
const utility_1 = require("./services/utility");
const template_1 = require("./services/template"); // SQL クラスをインポート
const template_2 = require("./services/template"); // FilterTemplateByCode クラスをインポート
const app = (0, express_1.default)();
app.use(body_parser_1.default.json());
const authenticate = (req, res, next) => {
    const symmetricKey = req.headers['matsuri-symmetric-key'];
    const planningKey = req.headers['from-planning-key'];
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
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v;
    const body = req.body;
    const { confirmation_code, guest_review_submitted, guest_review_submitted_at, pre_checked_in, nationalities, } = body;
    const status_review = guest_review_submitted;
    const status_precheckin = pre_checked_in;
    const nationality = nationalities;
    if (!confirmation_code) {
        return res.status(400).json({ message: 'bad requestだにょデータ形式なおせよ' });
    }
    // BigQueryUtility をインスタンス化
    const bigQueryUtility = new utility_1.BigQueryUtility();
    try {
        // 1. ゲストの属性を取得
        const guest = await guest_1.GuestAttribute.get_listing_id(confirmation_code, bigQueryUtility, nationality);
        // 2. ゲストの予約関連データを取得
        const journey = await guest_1.GuestJourneyPhase.fetchGuestJourneyData(confirmation_code, bigQueryUtility, status_precheckin);
        // 3. ゲストのイベントデータを取得
        const event = await guest_1.GuestJourneyEvent.fetchGuestJourneyEventData(confirmation_code, guest_review_submitted_at, status_precheckin, status_review, bigQueryUtility);
        console.log("Guest:", guest);
        console.log("Journey:", journey);
        console.log("Event:", event);
        // 4. data_dictにGuest, Journey, Eventをまとめる
        const data_dict = {
            listing_id: (_a = guest === null || guest === void 0 ? void 0 : guest.listing_id) !== null && _a !== void 0 ? _a : null,
            nationality: (_b = guest === null || guest === void 0 ? void 0 : guest.nationality) !== null && _b !== void 0 ? _b : null,
            confirmation_code: confirmation_code,
            today_date: (_c = journey === null || journey === void 0 ? void 0 : journey.today_date) !== null && _c !== void 0 ? _c : null,
            booked_date: (_d = journey === null || journey === void 0 ? void 0 : journey.booked_date) !== null && _d !== void 0 ? _d : null,
            checkin_date: (_e = journey === null || journey === void 0 ? void 0 : journey.checkin_date) !== null && _e !== void 0 ? _e : null,
            checkout_date: (_f = journey === null || journey === void 0 ? void 0 : journey.checkout_date) !== null && _f !== void 0 ? _f : null,
            days_from_booking: (_g = journey === null || journey === void 0 ? void 0 : journey.days_from_booking) !== null && _g !== void 0 ? _g : null,
            days_from_checkin: (_h = journey === null || journey === void 0 ? void 0 : journey.days_from_checkin) !== null && _h !== void 0 ? _h : null,
            days_from_checkout: (_j = journey === null || journey === void 0 ? void 0 : journey.days_from_checkout) !== null && _j !== void 0 ? _j : null,
            status_booked: (_k = journey === null || journey === void 0 ? void 0 : journey.status_booked) !== null && _k !== void 0 ? _k : null,
            status_checkin: (_l = journey === null || journey === void 0 ? void 0 : journey.status_checkin) !== null && _l !== void 0 ? _l : null,
            status_checkout: (_m = journey === null || journey === void 0 ? void 0 : journey.status_checkout) !== null && _m !== void 0 ? _m : null,
            trouble_genre_user: (_o = event === null || event === void 0 ? void 0 : event.trouble_genre_user) !== null && _o !== void 0 ? _o : null,
            days_from_precheckin: (_p = event === null || event === void 0 ? void 0 : event.days_from_precheckin) !== null && _p !== void 0 ? _p : null,
            cleaning_delay: (_q = event === null || event === void 0 ? void 0 : event.cleaning_delay) !== null && _q !== void 0 ? _q : null,
            guest_review_submitted_at: (_r = event === null || event === void 0 ? void 0 : event.guest_review_submitted_at) !== null && _r !== void 0 ? _r : null,
            status_precheckin: status_precheckin,
            status_review: status_review,
            days_from_review: (_s = event === null || event === void 0 ? void 0 : event.days_from_review) !== null && _s !== void 0 ? _s : null
        };
        console.log("data_dict before transform:", JSON.stringify(data_dict, null, 2));
        // 5. SQL クラスを使って、条件付きのテンプレート情報を取得
        const status_booked = (_t = journey === null || journey === void 0 ? void 0 : journey.status_booked) !== null && _t !== void 0 ? _t : false;
        const status_checkin = (_u = journey === null || journey === void 0 ? void 0 : journey.status_checkin) !== null && _u !== void 0 ? _u : false;
        const status_checkout = (_v = journey === null || journey === void 0 ? void 0 : journey.status_checkout) !== null && _v !== void 0 ? _v : false;
        // テーブル名は実際の要件に応じて修正
        const sql = new template_1.SQL("m2m-core.su_wo.test_template_table", bigQueryUtility);
        const templateConditions = await sql.transformToTemplateConditions(status_booked, status_checkin, status_checkout);
        // 6. FilterTemplateByCode を使って data_dict を条件配列に変換 → compareConditions で突合
        const filter = new template_2.FilterTemplateByCode();
        const guestInformation = filter.transformDataToConditions(data_dict);
        const compareResults = filter.compareConditions(guestInformation, templateConditions);
        //7.ヘッダーに含まれるキーによってレスポンスを変更
        const symmetricKey = req.headers['matsuri-symmetric-key'];
        const planningKey = req.headers['from-planning-key'];
        let shapedResults = [];
        if (symmetricKey) {
            shapedResults = compareResults.map(item => {
                return {
                    template_id: item.template_id,
                    message: item.message
                };
            });
        }
        else if (planningKey) {
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
    }
    catch (error) {
        console.error("Error:", error);
        return res.status(500).json({ message: "BigQueryエラー", error });
    }
});
exports.main = app;
