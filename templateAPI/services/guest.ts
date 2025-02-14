//ゲスト情報を取得するクラス
export class GuestAttribute {
  listing_id: string;
  nationality: string[];
  confirmation_code: string;

  constructor(listing_id: string, nationality: string[], confirmation_code: string) {
    this.listing_id = listing_id;
    this.nationality = nationality;
    this.confirmation_code = confirmation_code;
  }

  // BigQueryUtility を使ってデータを取得する静的メソッド
  static async get_nationality_and_listindid(confirmation_code: string, bigQueryUtility: BigQueryUtility): Promise<GuestAttribute> {
    const nationalityQuery = `
      SELECT nationality
      FROM (
        SELECT ROW_NUMBER() OVER (PARTITION BY a.id ORDER BY b.arrived_at ASC) as row_num,
               b.nationality
        FROM m2m-core.m2m_checkin_prod.reservation AS a
        LEFT OUTER JOIN m2m-core.m2m_checkin_prod.guest AS b
        ON a.id = b.reservation_id
        WHERE b.arrived_at IS NOT NULL
          AND a.stay_state = '1'
          AND a.code = @confirmation_code
      )
      WHERE row_num = 1
    `;
    
    const listingIdQuery = `
      SELECT b.core_listing_id
      FROM m2m-core.m2m_checkin_prod.reservation AS a
      LEFT OUTER JOIN m2m-core.m2m_checkin_prod.checkin_listing_core_listing_relation AS b
      ON a.listing_id = b.checkin_listing_id
      WHERE a.code = @confirmation_code
    `;
    
    try {
      // nationality を取得
      const nationalityRows = await bigQueryUtility.selectFromBQ(nationalityQuery, { confirmation_code });
      const nationality = nationalityRows.length > 0 ? nationalityRows.map((row: any) => row.nationality) : null;

      // listing_id を取得
      const listingIdRows = await bigQueryUtility.selectFromBQ(listingIdQuery, { confirmation_code });
      const listing_id = listingIdRows.length > 0 ? listingIdRows[0].core_listing_id : null;

      // 取得したデータで GuestAttribute インスタンスを作成
      return new GuestAttribute(listing_id, nationality, confirmation_code);
    } catch (error) {
      console.error('Error fetching data from BigQuery:', error);
      throw new Error('Failed to fetch data from BigQuery');
    }
  }
}

export class GuestJourneyPhase {
  today_date: string;
  booked_date: string;
  checkin_date: string;
  checkout_date: string;
  days_from_booking: number;
  days_from_checkin: number;
  days_from_checkout: number;
  status_booked: boolean;
  status_checkin: boolean;
  status_checkout: boolean;
  confirmation_code: string;

  constructor(confirmation_code: string) {
      this.today_date = new Date().toISOString().split('T')[0]; // yyyy-mm-dd形式で今日の日付を取得
      this.confirmation_code = confirmation_code;
  }

  // SQLで日付を取得するメソッド
  private async getDatesFromBQ(confirmation_code: string, bigQueryUtility: BigQueryUtility): Promise<void> {
      const query = `
          SELECT bookedAt, checkin, checkout
          FROM m2m-core.dx_m2m_core.reservations
          WHERE reservationCode = @confirmation_code
      `;
      
      try {
          const rows = await bigQueryUtility.selectFromBQ(query, { confirmation_code });
          if (rows.length > 0) {
              this.booked_date = rows[0].bookedAt;
              this.checkin_date = rows[0].checkin;
              this.checkout_date = rows[0].checkout;
          } else {
              throw new Error('No reservation data found');
          }
      } catch (error) {
          console.error('Error fetching dates from BigQuery:', error);
          throw new Error('Failed to fetch dates from BigQuery');
      }
  }

  // 日付計算
  private calculateDays(today: string, eventDate: string): number {
      return Math.floor((new Date(today).getTime() - new Date(eventDate).getTime()) / (1000 * 60 * 60 * 24));
  }

  // isStatusActiveで設定したステータスがどのenentDateに当てはまるのか
  private setStatus(today: string): void {
      this.status_booked = this.isStatusActive(this.booked_date, today);
      this.status_checkin = this.isStatusActive(this.checkin_date, today);
      this.status_checkout = this.isStatusActive(this.checkout_date, today);
  }

  // 今日の日付と比較して、ステータスを設定
  private isStatusActive(eventDate: string, today: string): boolean {
      return new Date(eventDate).getTime() <= new Date(today).getTime();
  }

  // GuestJourneyPhaseのデータをBigQueryから取得し、プロパティを設定する静的メソッド
  static async fetchGuestJourneyData(confirmation_code: string, bigQueryUtility: BigQueryUtility): Promise<GuestJourneyPhase> {
      const guestJourney = new GuestJourneyPhase(confirmation_code);

      // BigQueryからデータを取得
      await guestJourney.getDatesFromBQ(confirmation_code, bigQueryUtility);

      // 日付差やステータスを設定
      guestJourney.days_from_booking = guestJourney.calculateDays(guestJourney.today_date, guestJourney.booked_date);
      guestJourney.days_from_checkin = guestJourney.calculateDays(guestJourney.today_date, guestJourney.checkin_date);
      guestJourney.days_from_checkout = guestJourney.calculateDays(guestJourney.today_date, guestJourney.checkout_date);
      guestJourney.setStatus(guestJourney.today_date);

      return guestJourney;
  }
}

export class GuestJourneyEvent {
  trouble_genre: string[];
  status_review: boolean;
  days_since_review: number;
  today_date: string;
  confirmation_code: string;

  constructor(trouble_genre: string[], status_review: boolean, days_since_review: number, today_date: string, confirmation_code: string) {
      this.trouble_genre = trouble_genre;
      this.status_review = status_review;
      this.days_since_review = days_since_review;
      this.today_date = today_date;
      this.confirmation_code = confirmation_code;
  }
}