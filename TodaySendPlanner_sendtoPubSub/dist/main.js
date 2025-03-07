"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.main = void 0;
const express_1 = __importDefault(require("express"));
const body_parser_1 = __importDefault(require("body-parser"));
const utility_1 = require("./utility");
const send_PubSub_1 = require("./send_PubSub");
const app = (0, express_1.default)();
app.use(body_parser_1.default.json());
// BigQueryUtility と DataProcessor を準備
const bigQueryUtility = new utility_1.BigQueryUtility();
const topicName = 'TodaySendPlanner'; // Pub/Sub トピック名
const dataProcessor = new send_PubSub_1.DataProcessor(bigQueryUtility, topicName);
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
    }
    catch (error) {
        console.error('Error while processing Airbnb reservations:', error);
        res.status(500).json({ message: 'Internal Server Error', error });
    }
});
const port = process.env.PORT || 8080; // ここでポートを 8080 に設定
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
// Cloud Functions では app.listen は不要、ただエクスポートするだけ
exports.main = app;
