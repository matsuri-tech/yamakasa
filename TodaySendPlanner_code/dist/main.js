"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.main = void 0;
const express_1 = __importDefault(require("express"));
const body_parser_1 = __importDefault(require("body-parser"));
const utility_1 = require("./utility");
const select_confirmation_code_1 = require("./select_confirmation_code");
const app = (0, express_1.default)();
app.use(body_parser_1.default.json());
const bigQueryUtility = new utility_1.BigQueryUtility();
const airbnbService = new select_confirmation_code_1.AirbnbReservationService(bigQueryUtility);
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
    }
    catch (error) {
        console.error('Error processing the request:', error);
        res.status(500).json({ message: 'Error processing the request', error });
    }
});
exports.main = app;
