/*
テストデータ
{
  "listing_id": "123456",  
  "nationality": ["Japan"],
  "confirmation_code": "ABC123",
  "today_date": "2025-02-18",
  "booked_date": "2025-01-10",
  "checkin_date": "2025-02-15",
  "checkout_date": "2025-02-20",
  "days_from_booking": 39,
  "days_from_checkin": 3,
  "days_from_checkout": -2,
  "status_booked": true,
  "status_checkin": true,
  "status_checkout": false,
  "status_precheckin": true,
  "days_from_precheckin": 5,
  "status_review": false,
  "days_from_review": null,
  "cleaning_delay": false,
  "guest_review_submitted_at": null,
  "trouble_genre_user": [
    "{genre: A, B}",
    "{user: X, Y}"
  ]
}


*/

import { SQL } from '../services/template';
import { BigQueryUtility } from '../services/utility';


// BigQuery のインスタンスを作成
const bqUtility = new BigQueryUtility();
const sqlInstance = new SQL("m2m-core.su_wo.test_template_table", bqUtility);

// メインデータ
const data = {
    listing_id: "123456",  
    nationality: ["Japan"],
    confirmation_code: "ABC123",
    today_date: "2025-02-18",
    booked_date: "2025-01-10",
    checkin_date: "2025-02-15",
    checkout_date: "2025-02-20",
    days_from_booking: 39,
    days_from_checkin: 3,
    days_from_checkout: -2,
    status_booked: true,
    status_checkin: true,
    status_checkout: false,
    status_precheckin: true,
    days_from_precheckin: 5,
    status_review: false,
    days_from_review: null,
    cleaning_delay: false,
    guest_review_submitted_at: null,
    trouble_genre_user: ["{genre: A, B}", "{user: X, Y}"]
};

// 1. ステータスに応じた WHERE 句を取得
// 1. WHERE 句の取得
const whereClause: string | null = sqlInstance.decide_status(
    data.status_booked,
    data.status_checkin,
    data.status_checkout
);
console.log("WHERE Clause:", whereClause);

// 2. SQL クエリの生成
const sqlQuery: string = sqlInstance.generate_SQL(
    data.status_booked,
    data.status_checkin,
    data.status_checkout
);
console.log("Generated SQL Query:", sqlQuery);

// 3. BigQuery からデータ取得 (型を明示)
sqlInstance.filter_template_by_SQL(
    data.status_booked,
    data.status_checkin,
    data.status_checkout
).then((rows: any[]) => {  // ← `rows` の型を `any[]` に指定
    console.log("Fetched Data from BigQuery:", rows);
}).catch((error: unknown) => {  // ← `error` の型を `unknown` に指定
    console.error("Error fetching data:", error);
});

// 4. BigQuery のデータを `templateConditions` に変換 (型を明示)
sqlInstance.transformToTemplateConditions(
    data.status_booked,
    data.status_checkin,
    data.status_checkout
).then((templateConditions) => {  
    console.log("Transformed Template Conditions:", JSON.stringify(templateConditions, null, 2));
}).catch((error: unknown) => {  
    console.error("Error transforming template conditions:", error);
});

