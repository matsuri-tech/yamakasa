// ゲスト情報を取得するクラス
export class GuestAttribute {
  listing_id: string | null = null;
  nationality: string[];
  confirmation_code: string;

  constructor(nationality: string[], confirmation_code: string) {
    this.nationality = nationality;
    this.confirmation_code = confirmation_code;
  }

  // nationality を選択するためのメソッド
  static resolveNationality(nationalities: string[]): string[] {
    // もし何も渡されていない場合は空配列を返す
    if (!nationalities || nationalities.length === 0) {
      return [];
    }

    // 1つだけの場合はそのまま返す
    if (nationalities.length === 1) {
      return nationalities;
    }

    // 複数ある場合は"Japan"が含まれていれば ["Japan"] のみ返す
    if (nationalities.includes("Japan")) {
      return ["Japan"];
    }

    // "Japan"がない場合は先頭の要素のみを返す
    return [nationalities[0]];
  }

  // BigQueryUtility を使ってデータを取得する静的メソッド
  static async get_listing_id(
    confirmation_code: string, 
    bigQueryUtility: BigQueryUtility,
    nationality: string[]
  ): Promise<GuestAttribute> {
    const listingIdQuery = `
      SELECT b.core_listing_id
      FROM m2m-core.m2m_checkin_prod.reservation AS a
      LEFT OUTER JOIN m2m-core.m2m_checkin_prod.checkin_listing_core_listing_relation AS b
      ON a.listing_id = b.checkin_listing_id
      WHERE a.code = @confirmation_code
    `;
    
    try {
      // listing_id を取得
      const listingIdRows = await bigQueryUtility.selectFromBQ(listingIdQuery, { confirmation_code });
      const listing_id = listingIdRows.length > 0 ? listingIdRows[0].core_listing_id : null;

      // nationality を加工して反映
      const processedNationality = GuestAttribute.resolveNationality(nationality);

      // まずコンストラクタで GuestAttribute を作る
      const guest = new GuestAttribute(processedNationality, confirmation_code);

      // 後から代入
      guest.listing_id = listing_id;

      return guest;
    } catch (error) {
      console.error('Error fetching data from BigQuery:', error);
      throw new Error('Failed to fetch data from BigQuery');
    }
  }
}

// 今日の日付からphaseと各ポイントから何日離れているのかを計算するクラス
export class GuestJourneyPhase {
  today_date: string;
  booked_date: string | null;
  checkin_date: string | null;
  checkout_date: string | null;
  days_from_booking: number | null;
  days_from_checkin: number | null;
  days_from_checkout: number | null;
  status_booked: boolean | null;
  status_checkin: boolean | null;
  status_checkout: boolean | null;
  confirmation_code: string;

  constructor(confirmation_code: string) {
    this.today_date = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Tokyo' });
    this.confirmation_code = confirmation_code;

    // 後から取得する値をnullで初期化
    this.booked_date = null;
    this.checkin_date = null;
    this.checkout_date = null;
    this.days_from_booking = null;
    this.days_from_checkin = null;
    this.days_from_checkout = null;
    this.status_booked = null;
    this.status_checkin = null;
    this.status_checkout = null;
  }

  // SQLで日付を取得するメソッド
  private async getDatesFromBQ(
    confirmation_code: string, 
    bigQueryUtility: BigQueryUtility
  ): Promise<void> {
    const query = `
      SELECT bookedAt, checkin, checkout
      FROM m2m-core.dx_m2m_core.reservations
      WHERE reservationCode = @confirmation_code
    `;
    const rows = await bigQueryUtility.selectFromBQ(query, { confirmation_code });
    if (rows.length > 0) {
      this.booked_date = rows[0].bookedAt;
      this.checkin_date = rows[0].checkin;
      this.checkout_date = rows[0].checkout;
    }
  }

  // 今日の日付から何日離れているかの計算
  private calculateDays(today: string, eventDate: string | null): number | null {
    if (eventDate === null) {
      return null; // eventDate が null の場合は null を返す
    }
    return Math.floor(
      (new Date(today).getTime() - new Date(eventDate).getTime()) / (1000 * 60 * 60 * 24)
    );
  }

  // isStatusActiveで判定したT/Fをどのステータスに当てはめるか
  private setStatus(today: string, status_precheckin: boolean): void {
    this.status_booked = this.isStatusActive(this.booked_date!, today);

    // status_checkin は「isStatusActiveがtrue かつ status_precheckinがtrue」ならtrue
    this.status_checkin = this.isStatusActive(this.checkin_date!, today) && status_precheckin;

    this.status_checkout = this.isStatusActive(this.checkout_date!, today);
  }

  // ステータスのT/F判定を行う
  private isStatusActive(eventDate: string, today: string): boolean {
    return new Date(eventDate).getTime() <= new Date(today).getTime();
  }

  // GuestJourneyPhaseのデータをBigQueryから取得し、プロパティを設定する静的メソッド
  static async fetchGuestJourneyData(
    confirmation_code: string,
    bigQueryUtility: BigQueryUtility,
    status_precheckin: boolean
  ): Promise<GuestJourneyPhase> {
    const guestJourney = new GuestJourneyPhase(confirmation_code);

    await guestJourney.getDatesFromBQ(confirmation_code, bigQueryUtility);

    guestJourney.days_from_booking = guestJourney.calculateDays(
      guestJourney.today_date, 
      guestJourney.booked_date!
    );
    guestJourney.days_from_checkin = guestJourney.calculateDays(
      guestJourney.today_date, 
      guestJourney.checkin_date!
    );
    guestJourney.days_from_checkout = guestJourney.calculateDays(
      guestJourney.today_date, 
      guestJourney.checkout_date!
    );

    // setStatus呼び出し時に status_precheckin を渡して論理を反映
    guestJourney.setStatus(guestJourney.today_date, status_precheckin);

    return guestJourney;
  }
}

//トラブル、レビュー、清掃遅延、事前予約の情報を取得するクラス
export class GuestJourneyEvent {
  trouble_genre: string[];
  status_precheckin: boolean;
  days_from_precheckin: number | null;
  status_review: boolean;
  days_from_review: number | null;
  cleaning_delay: boolean;
  today_date: string;
  confirmation_code: string;
  guest_review_submitted_at: string | null; // このプロパティを追加

  constructor(
    status_precheckin: boolean,
    status_review: boolean,
    guest_review_submitted_at: string | null,
    confirmation_code: string,
    trouble_genre: string[] = []
  ) {
    this.trouble_genre = trouble_genre;
    this.status_precheckin = status_precheckin;
    this.status_review = status_review;
    
    // ここで日本時間のYYYY-MM-DDを生成
    this.today_date = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Tokyo' });
    
    this.confirmation_code = confirmation_code;
    this.guest_review_submitted_at = guest_review_submitted_at; 

    // 後から非同期で設定されるプロパティをnullで初期化
    this.days_from_precheckin = null;
    this.days_from_review = null;
    this.cleaning_delay = false; // 初期値
  }

  // SQLからデータを取得して初期化する静的メソッド
  static async fetchGuestJourneyEventData(
    confirmation_code: string,
    guest_review_submitted_at: string | null,
    status_precheckin: boolean,
    status_review: boolean,
    bigQueryUtility: BigQueryUtility
  ): Promise<GuestJourneyEvent> {
    const guestJourneyEvent = new GuestJourneyEvent(
      status_precheckin,
      status_review,
      guest_review_submitted_at,
      confirmation_code
    );

    try {
      // SQLからarrived_atを取得し、days_from_precheckinを計算
      const arrivedAt = await guestJourneyEvent.getArrivedAt(bigQueryUtility);
      if (arrivedAt) {
        guestJourneyEvent.days_from_precheckin = guestJourneyEvent.calculateDaysFromDate(arrivedAt);
      }

      // guest_review_submitted_atを元にdays_from_reviewを計算
      if (guest_review_submitted_at) {
        guestJourneyEvent.days_from_review = guestJourneyEvent.calculateDaysFromDate(guest_review_submitted_at);
      }

      // cleaning_delayをSQLから取得
      guestJourneyEvent.cleaning_delay = await guestJourneyEvent.checkCleaningDelay(bigQueryUtility);

    } catch (error) {
      console.error('Error initializing data:', error);
    }

    return guestJourneyEvent;
  }

  // SQLでarrived_atを取得する
  private async getArrivedAt(bigQueryUtility: BigQueryUtility): Promise<string | null> {
    const query = `
      SELECT arrived_at
      FROM (
        SELECT 
          DATE(b.arrived_at) AS arrived_at,
          ROW_NUMBER() OVER (PARTITION BY a.id ORDER BY b.arrived_at ASC) as row_num
        FROM 
          m2m-core.m2m_checkin_prod.reservation AS a
        LEFT OUTER JOIN 
          m2m-core.m2m_checkin_prod.guest AS b
        ON 
          a.id = b.reservation_id
        WHERE 
          b.arrived_at IS NOT NULL
          AND a.stay_state = '1'
          AND a.code = @confirmation_code
      )
      WHERE row_num = 1
    `;
    
    const result = await bigQueryUtility.selectFromBQ(query, { confirmation_code: this.confirmation_code });
    return result.length > 0 ? result[0].arrived_at : null;
  }

  // SQLでcleaning_delayを確認する
  private async checkCleaningDelay(bigQueryUtility: BigQueryUtility): Promise<boolean> {
    const query = `
      SELECT a.reservation_id
      FROM m2m-core.su_wo.new_delay_cleaning_notification AS a
      LEFT OUTER JOIN m2m-core.m2m_core_prod.reservation AS b
      ON a.reservation_id = b.id_on_ota
      WHERE b.ota_type = 'Airbnb'
        AND b.code = @confirmation_code
    `;
    
    const result = await bigQueryUtility.selectFromBQ(query, { confirmation_code: this.confirmation_code });
    return result.length > 0;
  }

  // 今日の日付と指定された日付との差を計算する（時刻は無視して日付だけにする）
  private calculateDaysFromDate(eventDate: string | null): number | null {
    if (!eventDate) {
      return null;
    }

    const eventDateOnly = eventDate.split(' ')[0];

    return Math.floor(
      (new Date(this.today_date).getTime() - new Date(eventDateOnly).getTime()) / (1000 * 60 * 60 * 24)
    );
  }
}