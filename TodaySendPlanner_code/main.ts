import express from 'express';
import bodyParser from 'body-parser';
import { BigQueryUtility } from './utility';
import { AirbnbReservationService } from './select_confirmation_code';

const app = express();
app.use(bodyParser.json());

const bigQueryUtility = new BigQueryUtility();
const airbnbService = new AirbnbReservationService(bigQueryUtility);

app.post('/api/trigger', async (req, res) => {
  try {
    // 1. BigQuery テーブルをクリア
    await airbnbService.clearBigqueryContent();

    // 2. 日数条件を取得
    const conditionValues = await airbnbService.getDaysConditions();

    // 3. Airbnb の予約情報を取得
    const reservations = await airbnbService.getAirbnbReservations(conditionValues);

    // 4. 予約情報を BigQuery にインサート
    await airbnbService.insertReservationsToBigquery(reservations);

    // 5. 別の Cloud Function をトリガー
    await airbnbService.triggerAnotherCloudFunction();

    // メッセージを処理した後のレスポンス
    res.status(200).json({
      message: 'Successfully processed and triggered another Cloud Function.',
    });
  } catch (error) {
    console.error('Error processing the request:', error);
    res.status(500).json({ message: 'Error processing the request', error });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});