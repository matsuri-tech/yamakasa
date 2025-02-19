import { BigQueryUtility } from './utility';

export class AirbnbReservationService {
  private bigQueryUtility: BigQueryUtility;

  constructor(bigQueryUtility: BigQueryUtility) {
    this.bigQueryUtility = bigQueryUtility;
  }

  //test_condition_table から日数条件を取得し、キーごとにまとめて返却する
  public async getDaysConditions(): Promise<{ [key: string]: number[] }> {
    const sql = `
      SELECT 
        condition_key,
        ARRAY_AGG(DISTINCT condition_value) AS distinct_values
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

    //row.distinct_values を利用し、まとめていく
    const conditionMap: { [key: string]: number[] } = {};
    for (const row of rows) {
      const k = row.condition_key;
      const distinctVals = row.distinct_values; // ARRAY_AGG(DISTINCT ...)の結果
      conditionMap[k] = distinctVals;
    }

    return conditionMap;
  }

  //getDaysConditionsメソッドで取得した日数を試用して、Airbnb の予約情報を取得する
  public async getAirbnbReservations(
    conditionValues: { [key: string]: number[] }
  ): Promise<any[]> {
    // メインのクエリ作成
    const sql = `
      SELECT 
        aa.confirmaton_code,
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
            a.code AS confirmaton_code,
            b.nationality
          FROM \`m2m-core.m2m_checkin_prod.reservation\` AS a
          LEFT OUTER JOIN \`m2m-core.m2m_checkin_prod.guest\` AS b
            ON a.id = b.reservation_id
          WHERE a.stay_state = '1'
      ) AS aa

      LEFT OUTER JOIN \`m2m-core.dx_m2m_core.reservations\` AS bb
        ON aa.confirmaton_code = bb.reservationCode

      LEFT OUTER JOIN \`m2m-core.m2m_systems.air_reservations\` AS a
        ON aa.confirmaton_code = a.confirmation_code

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

    // パラメータ作成
    const params = {
      days_from_precheckin: conditionValues['days_from_precheckin'] ?? [],
      days_from_book: conditionValues['days_from_book'] ?? [],
      days_from_checkin: conditionValues['days_from_checkin'] ?? [],
      days_from_checkout: conditionValues['days_from_checkout'] ?? [],
      days_from_review: conditionValues['days_from_review'] ?? [],
    };

    // 実行して結果を返却
    return this.bigQueryUtility.selectFromBQ(sql, params);
  }
}