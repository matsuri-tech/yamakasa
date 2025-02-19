import { SQL } from '../services/template';
import { BigQueryUtility } from '../services/utility';
import { FilterTemplateByCode } from '../services/template';

// BigQuery のインスタンスを作成
const bqUtility = new BigQueryUtility();
const sqlInstance = new SQL("m2m-core.su_wo.test_template_table", bqUtility);

// メインデータ
const data = {
    listing_id: "81f63d83-a07b-4b9a-90d7-7059fb791227",  
    nationality: ["Japan"],
    confirmation_code: "ABC123",
    today_date: "2025-02-18",
    booked_date: "2025-01-10",
    checkin_date: "2025-02-15",
    checkout_date: "2025-02-20",
    days_from_book: 0,
    days_from_checkin: 0,
    days_from_checkout: 0,
    status_booked: true,
    status_checkin: false,
    status_checkout: false,
    status_precheckin: true,
    days_from_precheckin: 1,
    status_review: false,
    days_from_review: null,
    cleaning_delay: true,
    guest_review_submitted_at: null,
    trouble_genre_user: ["{genre: A, B}", "{user: X, Y}"]
};

// SQLから取得したデータを `templateData` にセットする関数
async function fetchAndProcessTemplateData() {
    try {
        // 1. BigQuery からテンプレート条件を取得
        const templateData = await sqlInstance.transformToTemplateConditions(
            data.status_booked,
            data.status_checkin,
            data.status_checkout
        );

        //console.log("Transformed Template Conditions:", JSON.stringify(templateData, null, 2));

        // 2. `FilterTemplateByCode` の処理を実行
        const filter = new FilterTemplateByCode();

        // guestInfoData を変換
        const guestConditions = filter.transformDataToConditions(data);
        //console.log("Guest Conditions:", guestConditions);

        // compareConditions の結果を確認
        const matchedTemplates = filter.compareConditions(guestConditions, templateData);
        console.log("Matched Templates:", matchedTemplates);

        // compareConditionsforplanner の結果を確認
        const plannerResults = filter.compareConditionsforplanner(guestConditions, templateData);
        console.log("Planner Results:", plannerResults);

    } catch (error) {
        console.error("Error processing template conditions:", error);
    }
}

// データ取得 & フィルタ処理を実行
fetchAndProcessTemplateData();
