const { BigQuery } = require('@google-cloud/bigquery');

class TemplateFetcher {
  constructor() {
    this.bigquery = new BigQuery();
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
      this.templateData = {
        Key:
        value:
        operator:
      };

  }

  async fetch(query, params) {
    const options = { query, params };
    const [rows] = await this.bigquery.query(options);
    return rows[0] || null;
  }
}

module.exports = { TemplateFetcher };
