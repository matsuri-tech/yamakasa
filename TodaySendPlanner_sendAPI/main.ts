import express from 'express';
import bodyParser from 'body-parser';
import { BigQueryUtility } from './utility';
import { SendAPI } from './send_cueingAPI';

const app = express();
app.use(bodyParser.json());

// BigQueryUtility と SendAPI を準備
const bigQueryUtility = new BigQueryUtility();
const topicName = 'your-topic-name'; // Pub/Sub トピック名
const sendAPI = new SendAPI(bigQueryUtility, topicName);

// listenForMessages を app.post のハンドラーとして実装
app.post('/api/pubsub', async (req, res) => {
  try {
    // 受け取った Pub/Sub メッセージを処理
    const messageData = req.body; // POST のリクエストボディからメッセージデータを取得
    console.log('Received message from Pub/Sub:', messageData);

    // 1. Pub/Sub メッセージからデータを取得
    const data = messageData;

    // 2. 取得したデータを API1 に送信
    const api1Response = await sendAPI.sendApiRequest1(data);
    const response = api1Response.data;

    // 3. BigQuery にデータをインサート
    await sendAPI.insertIntoBigQuery(response);

    // 4. API2 にリクエストを送信
    await sendAPI.sendApiRequest2(response);

    // メッセージを処理した後のレスポンス
    res.status(200).json({
      message: 'Successfully processed Pub/Sub message and performed actions.',
      responseData: response,
    });
  } catch (error) {
    console.error('Error processing Pub/Sub message:', error);
    res.status(500).json({ message: 'Error processing Pub/Sub message', error });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});