const { BigQuery } = require('@google-cloud/bigquery');

class ReservationFetcher {
  constructor() {
    this.bigquery = new BigQuery();
  }

  async fetch(reservationCode) {
    const query = `
      SELECT review_status, days_since_booking, cleaning_delay
      FROM \`your_project.your_dataset.reservations\`
      WHERE reservation_code = @reservationCode
    `;

    const options = {
      query,
      params: { reservationCode },
    };

    const [rows] = await this.bigquery.query(options);
    return rows[0] || null;
  }

  async review_status(reservationCode) {
    // Review status logic here (dummy implementation)
    return false; // Example return value
  }

  async calculate_condition_date(reservationCode) {
    // Date calculation logic here
    return { days_since_booking: 5 }; // Example return value
  }

  async previous_checkin_status(reservationCode) {
    // Previous check-in status logic here
    return 'completed'; // Example return value
  }

  async nationality(reservationCode) {
    // Nationality logic here
    return 'Japan'; // Example return value
  }

  async cleaning_delay(reservationCode) {
    // Cleaning delay logic here
    return false; // Example return value
  }

  async trouble_genre(reservationCode) {
    // Trouble genre logic here
    return ['Cleaning', 'Key Issue']; // Example return value
  }

  async trouble_user(reservationCode) {
    // Trouble user logic here
    return ['user1', 'user2']; // Example return value
  }

  async listing_id(reservationCode) {
    // Listing ID logic here
    return ['listing123']; // Example return value
  }

  async specific_reservation_code(reservationCode) {
    // Specific reservation code logic here
    return ['code456']; // Example return value
  }

  async fetchAll(reservationCode) {
    // 各メソッドを呼び出して結果を統合
    const reservationData = await this.fetch(reservationCode);

    if (!reservationData) {
      return null; // データが見つからない場合は null を返す
    }

    // 各メソッドの結果を追加
    return {
      ...reservationData,
      review_status: await this.review_status(reservationCode),
      condition_date: await this.calculate_condition_date(reservationCode),
      previous_checkin_status: await this.previous_checkin_status(reservationCode),
      nationality: await this.nationality(reservationCode),
      cleaning_delay: await this.cleaning_delay(reservationCode),
      trouble_genre: await this.trouble_genre(reservationCode),
      trouble_user: await this.trouble_user(reservationCode),
      listing_id: await this.listing_id(reservationCode),
      specific_reservation_code: await this.specific_reservation_code(reservationCode),
    };
  }
}

module.exports = { ReservationFetcher };
