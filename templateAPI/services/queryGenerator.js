class QueryGenerator {
    /**
     * コンストラクタで予約データを初期化
     * @param {Object} reservationData - 予約データ
     */
    constructor(reservationData = {}) {
      // 
      this.reservationData = {
        review_status: reservationData.review_status ?? undefined,
        days_since_reviewed: reservationData.days_since_reviewed ?? undefined,
        days_since_checkin: reservationData.days_since_checkin ?? undefined,
        days_since_checkout: reservationData.days_since_checkout ?? undefined,
        days_since_booking: reservationData.days_since_booking ?? undefined,
        previous_checkin_status: reservationData.previous_checkin_status ?? undefined,
        nationality: reservationData.nationality ?? undefined,
        cleaning_delay: reservationData.cleaning_delay ?? undefined,
        trouble_genre: reservationData.trouble_genre ?? [],
        trouble_user: reservationData.trouble_user ?? [],
        listing_id: reservationData.listing_id ?? [],
        specific_reservation_code: reservationData.specific_reservation_code ?? [],
      };
    }
  
    /**
     * 動的クエリを生成する
     * @returns {Object} - SQLクエリとパラメータ
     */
    generate() {
      const baseQuery = `
        SELECT 
          t.template_id, 
          t.template_name, 
          t.content
        FROM 
          \`your_project.your_dataset.templates\` t
        JOIN 
          \`your_project.your_dataset.conditions\` c
        ON 
          t.template_id = c.template_id
        WHERE 
          t.is_active = TRUE
      `;
  
      const dynamicConditions = [];
      const params = {};
  
      // review_status の条件を追加
      if (this.reservationData.review_status !== undefined) {
        dynamicConditions.push('c.condition_key = @reviewStatusKey  AND c.condition__value = @reviewStatus');
        params.reviewStatusKey = 'reviewed';
        params.reviewStatus = this.reservationData.review_status;
      }

      // days_since_reviewed の条件を追加 
      if (this.reservationData.days_since_reviewed !== undefined) {
        dynamicConditions.push('c.condition_key = @daysSinceReviewedKey   AND c.condition__value <= @daysSinceReviewed');
        params.daysSinceReviewedKey = 'reviwed';
        params.aysSinceReviewed = this.reservationData.days_since_reviewed;
      }

      // days_since_checkin の条件を追加 
      if (this.reservationData.days_since_checkin !== undefined) {
        dynamicConditions.push('c.condition_key = @daysSinceCheckinKey    AND c.condition__value <= @daysSinceCheckin');
        params.daysSinceCheckinKey = 'checkin';
        params.daysSinceCheckin = this.reservationData.days_since_checkin;
      }

      // days_since_checkout の条件を追加 
      if (this.reservationData.days_since_checkout !== undefined) {
        dynamicConditions.push('c.condition_key = @daysSinceCheckoutKey  AND c.condition__value <= @daysSinceCheckout');
        params.daysSinceCheckoutKey = 'checkout';
        params.daysSinceCheckout = this.reservationData.days_since_checkout;
      }

      // days_since_booking の条件を追加
      if (this.reservationData.days_since_booking !== undefined) {
        dynamicConditions.push('c.condition_key = @daysSinceBookingKey  AND c.condition__value <= @daysSinceBooking');
        params.daysSinceBookingKey = 'checkout';
        params.daysSinceBooking = this.reservationData.days_since_booking;
      }
  
      
      // previous_checkin_status の条件を追加
      if (this.reservationData.previous_checkin_status !== undefined) {
        dynamicConditions.push('c.condition_key = @PreviousCheckinStatusKey  AND c.condition__value = @PreviousCheckinStatus');
        params.PreviousCheckinStatusKey = 'previous_checkin_status';
        params.PreviousCheckinStatus = this.reservationData.previous_checkin_status;
      }

      // nationality の条件を追加
      if (this.reservationData.nationality !== undefined) {
        dynamicConditions.push('c.condition_key = @nationalityKey  AND c.condition__value = @nationality');
        params.nationalityKey = 'nationality';
        params.nationality = this.reservationData.nationality;
      }
  
      // cleaning_delay の条件を追加
      if (this.reservationData.cleaning_delay !== undefined) {
        dynamicConditions.push('c.condition_key = @cleaningDelayKey  AND c.condition__value = @cleaningDelay');
        params.cleaningDelayKey = 'cleaning_delay';
        params.cleaningDelay = this.reservationData.cleaning_delay;
      }

      // trouble_genre の条件を追加
      if (this.reservationData.trouble_genre.length > 0) {
        dynamicConditions.push('c.condition_key = @troubleGenreKey  AND c.condition__value IN UNNEST(@troubleGenre)');
        params.troubleGenreKey = 'trouble_genre';
        params.troubleGenre = this.reservationData.trouble_genre;
      }

      // trouble_user の条件を追加
      if (this.reservationData.trouble_user.length > 0) {
        dynamicConditions.push('c.condition_key = @troubleUserKey   AND c.condition__value IN UNNEST(@troubleUser)');
        params.troubleUserKey = 'trouble_user';
        params.troubleUser = this.reservationData.trouble_user;
      }

      // listing_id の条件を追加
      if (this.reservationData.listing_id.length > 0) {
        dynamicConditions.push('c.condition_key = @listingIdKey  AND c.condition__value IN UNNEST(@listingId)');
        params.listingIdKey = 'listing_id';
        params.listingId = this.reservationData.listing_id;
      }

      // specific_reservation_code の条件を追加
      if (this.reservationData.specific_reservation_code.length > 0) {
        dynamicConditions.push('c.condition_key = @specificReservationCodeKey  AND c.condition__value IN UNNEST(@specificReservationCode)');
        params.specificReservationCodeKey = 'specific_reservation_code';
        params.specificReservationCode = this.reservationData.specific_reservation_code;
      }

      
  
      // 条件を結合
      const whereClause = dynamicConditions.length > 0 ? `AND (${dynamicConditions.join(' OR ')})` : '';
      const query = `${baseQuery} ${whereClause}`;
  
      return { query, params };
    }
  }
  
  module.exports = { QueryGenerator };
  