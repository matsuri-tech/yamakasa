"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AirbnbReservationService = void 0;
const axios_1 = __importDefault(require("axios"));
class AirbnbReservationService {
    constructor(bigQueryUtility) {
        this.bigQueryUtility = bigQueryUtility;
    }
    // 0) テーブル m2m-core.su_wo.confirmation_codes_send_to_queingAPI の中身を削除するメソッド
    async clearBigqueryContent() {
        const datasetId = 'su_wo';
        const tableId = 'confirmation_codes_send_to_queingAPI';
        // truncateTable メソッドを呼び出す
        await this.bigQueryUtility.truncateTable(datasetId, tableId);
    }
    // 1) test_condition_table から日数条件を取得
    async getDaysConditions() {
        const sql = `
      SELECT 
        condition_key,
        ARRAY_AGG(DISTINCT CAST(condition_value AS INT64)) AS distinct_values
      FROM \`m2m-core.su_wo.test_condition_table\`
      WHERE condition_key IN (
        'days_from_book', 
        'days_from_precheckin', 
        'days_from_checkin', 
        'days_from_checkout', 
        'days_from_review'
      )
      GROUP BY condition_key
    `;
        const rows = await this.bigQueryUtility.selectFromBQ(sql);
        const conditionMap = {};
        for (const row of rows) {
            const k = row.condition_key;
            const vals = row.distinct_values;
            conditionMap[k] = vals;
        }
        return conditionMap;
    }
    // 2) getDaysConditions() で取得した日数を使って Airbnb の予約情報を取得する
    async getAirbnbReservations(conditionValues) {
        const sql = `
      SELECT 
        aa.confirmation_code,
        aa.nationality,
        aa.arrived_at AS precheckin_date,
        CASE WHEN aa.arrived_at IS NOT NULL THEN TRUE ELSE FALSE END AS pre_checked_in,
  
        bb.bookedAt AS booked_date,
        bb.checkin AS checkin_date,
        bb.checkout AS checkout_date,
  
        CASE WHEN b.air_reservation_id IS NOT NULL THEN TRUE ELSE FALSE END AS guest_review_submitted,
        FORMAT_DATETIME('%Y-%m-%d %H:%M:%S', b.submitted_at) AS guest_review_submitted_at
  
      FROM (
          SELECT 
            DATE(b.arrived_at) AS arrived_at,
            ROW_NUMBER() OVER (PARTITION BY a.id ORDER BY b.arrived_at ASC) AS row_num,
            a.code AS confirmation_code,
            b.nationality
          FROM \`m2m-core.m2m_checkin_prod.reservation\` AS a
          LEFT OUTER JOIN \`m2m-core.m2m_checkin_prod.guest\` AS b
            ON a.id = b.reservation_id
          WHERE a.stay_state = '1'
      ) AS aa
  
      LEFT OUTER JOIN \`m2m-core.dx_m2m_core.reservations\` AS bb
        ON aa.confirmation_code = bb.reservationCode
  
      LEFT OUTER JOIN \`m2m-core.m2m_systems.air_reservations\` AS a
        ON aa.confirmation_code = a.confirmation_code
  
      LEFT OUTER JOIN \`m2m-core.m2m_systems.air_official_reviews\` AS b
        ON CAST(a.id AS STRING) = CAST(b.air_reservation_id AS STRING)
        AND b.submitted = TRUE
        AND b.is_host = FALSE
  
      WHERE aa.row_num = 1
        AND bb.channel = 'Airbnb'
        AND (
          DATE_DIFF(CURRENT_DATE('Asia/Tokyo'), DATE(aa.arrived_at), DAY) IN UNNEST(@days_from_precheckin)
          OR DATE_DIFF(CURRENT_DATE('Asia/Tokyo'), DATE(bb.bookedAt), DAY) IN UNNEST(@days_from_book)
          OR DATE_DIFF(CURRENT_DATE('Asia/Tokyo'), DATE(bb.checkin), DAY) IN UNNEST(@days_from_checkin)
          OR DATE_DIFF(CURRENT_DATE('Asia/Tokyo'), DATE(bb.checkout), DAY) IN UNNEST(@days_from_checkout)
          OR DATE_DIFF(CURRENT_DATE('Asia/Tokyo'), DATE(b.submitted_at), DAY) IN UNNEST(@days_from_review)
        )
    `;
        const params = {
            days_from_precheckin: conditionValues['days_from_precheckin'] ?? [],
            days_from_book: conditionValues['days_from_book'] ?? [],
            days_from_checkin: conditionValues['days_from_checkin'] ?? [],
            days_from_checkout: conditionValues['days_from_checkout'] ?? [],
            days_from_review: conditionValues['days_from_review'] ?? [],
        };
        return this.bigQueryUtility.selectFromBQ(sql, params);
    }
    // 3) 上記の結果を m2m-core.su_wo.confirmation_codes_send_to_queingAPI にインサートする
    async insertReservationsToBigquery(reservations) {
        const datasetId = 'su_wo';
        const tableId = 'confirmation_codes_send_to_queingAPI';
        const rowsToInsert = reservations.map(row => {
            return {
                confirmation_code: row.confirmation_code,
                nationality: row.nationality,
                precheckin_date: row.precheckin_date?.value ?? row.precheckin_date,
                pre_checked_in: row.pre_checked_in,
                booked_date: row.booked_date,
                checkin_date: row.checkin_date,
                checkout_date: row.checkout_date,
                guest_review_submitted: row.guest_review_submitted,
                guest_review_submitted_at: row.guest_review_submitted_at || null
            };
        });
        try {
            await this.bigQueryUtility.insertToBQ(datasetId, tableId, rowsToInsert);
            console.log(`Inserted ${rowsToInsert.length} rows into ${datasetId}.${tableId}`);
        }
        catch (err) {
            console.error('Error inserting data into BigQuery:', err);
            throw err;
        }
    }
    // 4) 別の Cloud Function にリクエストを送信する
    async triggerAnotherCloudFunction() {
        try {
            await axios_1.default.post('https://us-central1-m2m-core.cloudfunctions.net/TodaySendPlanner_sendtoPubSub/api/airbnb');
            console.log('Triggered another Cloud Function');
        }
        catch (error) {
            console.error('Error triggering another Cloud Function:', error);
            throw error;
        }
    }
}
exports.AirbnbReservationService = AirbnbReservationService;
