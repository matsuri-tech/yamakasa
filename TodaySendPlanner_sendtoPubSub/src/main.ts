import express from 'express';
import bodyParser from 'body-parser';
import { BigQueryUtility } from './utility';
import { DataProcessor } from './send_PubSub';

const app = express();
app.use(bodyParser.json());

// BigQueryUtility と DataProcessor を準備
const bigQueryUtility = new BigQueryUtility();
const topicName = 'TodaySendPlanner'; // Pub/Sub トピック名
const dataProcessor = new DataProcessor(bigQueryUtility, topicName);

// トピックが無い場合は作成しておく
dataProcessor.ensureTopicExists()
  .then(() => {
    console.log('Topic check/creation complete.');
  })
  .catch((err) => {
    console.error('Error ensuring topic exists:', err);
  });

// エンドポイントの定義
app.post('/api/airbnb', async (req, res) => {
  try {
    const data = await dataProcessor.fetchBigQueryData();
    await dataProcessor.processAndPublish(data);
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

const port = process.env.PORT || 8080;  // ここでポートを 8080 に設定
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});

// Cloud Functions では app.listen は不要、ただエクスポートするだけ
export const main = app;