import express from 'express';
import bodyParser from 'body-parser';
import { PubSub } from '@google-cloud/pubsub';  // Pub/Sub クライアント
import { SendAPI } from './send_cueingAPI';
import { BigQueryUtility } from './utility';

const app = express();
app.use(bodyParser.json());

// BigQueryUtility と SendAPI を準備
const bigQueryUtility = new BigQueryUtility();
const sendAPI = new SendAPI(bigQueryUtility);

// Pub/Sub クライアントとサブスクリプションの設定
const pubsub = new PubSub();
const subscriptionName = 'your-subscription-name';  // Pub/Sub のサブスクリプション名

// サブスクリプションを使ってメッセージを受け取る処理
async function listenForMessages() {
  const subscription = pubsub.subscription(subscriptionName);

  const messageHandler = async (message: any) => {
    try {
      console.log('Received message:', message.data.toString());

      const messageData = JSON.parse(message.data.toString());
      console.log('Parsed message:', messageData);

      // 1. Pub/Sub メッセージからデータを取得
      const data = messageData;

      // 2. 取得したデータを API1 に送信
      const api1Response = await sendAPI.sendtemplateAPI(data);
      const response = api1Response.data;

      // 3. BigQuery にデータをインサート
      await sendAPI.insertIntoBigQuery(response);

      // 4. API2 にリクエストを送信
      await sendAPI.sendcueingAPI(response);

      // メッセージ処理完了後に ack を送信
      message.ack();
      console.log('Message acknowledged.');
    } catch (error) {
      console.error('Error processing message:', error);
      message.nack();  // エラーの場合はメッセージをnackして再試行させる
    }
  };

  // サブスクリプションにメッセージハンドラを設定
  subscription.on('message', messageHandler);
  console.log('Listening for messages...');
}

// サーバーのエンドポイント設定
app.post('/api/pubsub', async (req, res) => {
  try {
    res.status(200).json({
      message: 'Successfully triggered API flow, but Pub/Sub messages are handled by listener.',
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ message: 'Error', error });
  }
});

// サブスクリプションのメッセージをリスン開始
listenForMessages();

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});