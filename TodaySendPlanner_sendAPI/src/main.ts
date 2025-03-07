// main.ts (例: myPubSubHandler.ts に名前を変えてもよい)
import { PubSub } from '@google-cloud/pubsub';  
import { SendAPI } from './send_cueingAPI';
import { BigQueryUtility } from './utility';

// BigQueryUtility と SendAPI を準備
const bigQueryUtility = new BigQueryUtility();
const sendAPI = new SendAPI(bigQueryUtility);

/**
 * Pub/Sub トリガー用の関数。
 * 第2世代 Cloud Functions で Pub/Sub trigger にすると、イベント引数に data が入る。
 */
export async function TodaySendPlanner_sendAPI(event: any, context: any) {
  try {
    // Pub/Sub メッセージは Base64 エンコードされている
    const messageString = Buffer.from(event.data, 'base64').toString();
    console.log('Pub/Sub Raw Message:', messageString);

    // JSON としてパース
    const messageData = JSON.parse(messageString);
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

    console.log('Successfully processed message:', response);
  } catch (error) {
    console.error('Error processing message:', error);
    // Pub/Sub trigger の場合、ここで throw すると再試行されることがあります
    throw error;
  }
}