import express from 'express';
import bodyParser from 'body-parser';
import { BigQueryUtility } from './utility';
import { AirbnbReservationService } from './select_confirmation_code';

const app = express();
app.use(bodyParser.json());

// BigQueryUtility と AirbnbReservationService を準備
const bigQueryUtility = new BigQueryUtility();
const airbnbService = new AirbnbReservationService(bigQueryUtility);

app.post('/api/airbnb', async (req, res) => {
  try {
    // 0. まずテーブルの中身をクリア (clearBigqueryContent)
    await airbnbService.clearBigqueryContent();

    // A. 条件テーブル(test_condition_table) から条件を取得
    const conditionValues = await airbnbService.getDaysConditions();

    // B. 取得した条件を使って対象の予約情報を取得
    const results = await airbnbService.getAirbnbReservations(conditionValues);

    // C. その結果を BigQuery のテーブルにインサート
    await airbnbService.insertReservationsToBigquery(results);

    // D. 処理結果をレスポンスとして返す
    res.status(200).json({
      message: 'Successfully cleared table and inserted reservations into confirmation_codes_send_to_queingAPI',
      rowCount: results.length,
      data: results,
    });
  } catch (error) {
    console.error('Error while clearing table or fetching/inserting Airbnb reservations:', error);
    res.status(500).json({ message: 'Internal Server Error', error });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});