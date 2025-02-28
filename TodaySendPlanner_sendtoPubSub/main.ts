import express from 'express';
import bodyParser from 'body-parser';
import { BigQueryUtility } from './utility';
import { DataProcessor } from './send_PubSub';

const app = express();
app.use(bodyParser.json());

// BigQueryUtility と DataProcessor を準備
const bigQueryUtility = new BigQueryUtility();
const topicName = 'test-TodaySendPlanner'; // Pub/Sub トピック名
const dataProcessor = new DataProcessor(bigQueryUtility, topicName);

/* ▼ 追加: トピックが無い場合は作成しておく ▼ */
dataProcessor.ensureTopicExists()
  .then(() => {
    console.log('Topic check/creation complete.');
  })
  .catch((err) => {
    console.error('Error ensuring topic exists:', err);
  });
/* ▲ 追加ここまで ▲ */

// エンドポイントの定義
app.post('/api/airbnb', async (req, res) => {
  try {
    // 1. BigQuery からデータを取得
    const data = await dataProcessor.fetchBigQueryData();

    // 2. 取得したデータを 30 件ずつに分割し Pub/Sub に送信
    await dataProcessor.processAndPublish(data);

    // 3. 処理結果をレスポンスとして返す
    res.status(200).json({
      message: 'Successfully fetched data and published to Pub/Sub.',
      rowCount: data.length,
      data: data,
    });
  } catch (error) {
    console.error('Error while processing Airbnb reservations:', error);
    res.status(500).json({ message: 'Internal Server Error', error });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
