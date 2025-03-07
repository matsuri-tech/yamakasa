"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TodaySendPlanner_sendAPI = TodaySendPlanner_sendAPI;
const send_cueingAPI_1 = require("./send_cueingAPI");
const utility_1 = require("./utility");
// BigQueryUtility と SendAPI を準備
const bigQueryUtility = new utility_1.BigQueryUtility();
const sendAPI = new send_cueingAPI_1.SendAPI(bigQueryUtility);
/**
 * Pub/Sub トリガー用の関数。
 * 第2世代 Cloud Functions で Pub/Sub trigger にすると、イベント引数に data が入る。
 */
async function TodaySendPlanner_sendAPI(event, context) {
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
    }
    catch (error) {
        console.error('Error processing message:', error);
        // Pub/Sub trigger の場合、ここで throw すると再試行されることがあります
        throw error;
    }
}
