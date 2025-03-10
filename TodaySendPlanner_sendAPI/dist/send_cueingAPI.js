"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SendAPI = void 0;
const axios_1 = __importDefault(require("axios"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
class SendAPI {
    constructor(bigQueryUtility) {
        this.bigQueryUtility = bigQueryUtility;
    }
    // Airbnb APIトークンを取得するメソッド
    async getAirbnbTokenFromAPI() {
        const loginUrl = "https://api.m2msystems.cloud/login";
        const email = "yum.takahashi@matsuri-tech.com"; // メールアドレス
        const password = process.env.AIRBNB_PASSWORD; // 環境変数からパスワードを取得
        if (!password) {
            console.error('Error: Password not found.');
            return null;
        }
        const loginPayload = {
            'email': email,
            'password': password,
        };
        try {
            // レスポンスの型を LoginResponse として指定
            const response = await axios_1.default.post(loginUrl, loginPayload, {
                headers: {
                    'Content-Type': 'application/json',
                },
            });
            const loginData = response.data; // 型は LoginResponse
            return loginData.accessToken; // トークンを返す
        }
        catch (error) {
            console.error('Error during login:', error);
            return null;
        }
    }
    // ① templateAPIにリクエストを送信するメソッド
    async sendtemplateAPI(data) {
        try {
            const token = await this.getAirbnbTokenFromAPI();
            if (!token) {
                throw new Error('Failed to retrieve Airbnb token');
            }
            const headers = {
                'from-planning-key': 'f4491d6e-b601-0db4-7781-939690a798bd',
                'X-M2m-Access-Token': token, // トークンをヘッダーに追加
            };
            const body = {
                confirmation_code: data.confirmation_code,
                guest_review_submitted: data.guest_review_submitted,
                guest_review_submitted_at: data.guest_review_submitted_at,
                pre_checked_in: data.pre_checked_in,
                nationalities: data.nationalities,
            };
            const response = await axios_1.default.post('https://us-central1-m2m-core.cloudfunctions.net/templateAPI/api/process', body, { headers });
            return response;
        }
        catch (error) {
            console.error('Error sending request to templateAPI:', error);
            throw error;
        }
    }
    // ② BigQuery にデータをインサート
    async insertIntoBigQuery(response) {
        try {
            const datasetId = 'su_wo';
            const tableId = 'today_send_planner_log';
            const rowsToInsert = [{
                    template_id: response.template_id,
                    confirmation_codes: response.confirmation_codes,
                    priority: response.priority,
                    message_posting_time: response.message_posting_time,
                    is_force_send: response.is_force_send,
                }];
            await this.bigQueryUtility.insertToBQ(datasetId, tableId, rowsToInsert);
            console.log(`Inserted data into ${datasetId}.${tableId}`);
        }
        catch (error) {
            console.error('Error inserting data into BigQuery:', error);
            throw error;
        }
    }
    // ③ cueingAPIにリクエストを送信
    async sendcueingAPI(response) {
        try {
            const token = await this.getAirbnbTokenFromAPI();
            if (!token) {
                throw new Error('Failed to retrieve Airbnb token');
            }
            const body = {
                confirmation_codes: response.confirmation_codes,
                priority: response.priority,
                message_posting_time: response.message_posting_time,
            };
            const headers = {
                'X-M2m-Access-Token': token, // トークンをヘッダーに追加
                'Content-Type': 'application/json',
            };
            await axios_1.default.post('https://api2.example.com', body, { headers });
            console.log('Sent request to cueingAPI');
        }
        catch (error) {
            console.error('Error sending request to cueingAPI:', error);
            throw error;
        }
    }
}
exports.SendAPI = SendAPI;
