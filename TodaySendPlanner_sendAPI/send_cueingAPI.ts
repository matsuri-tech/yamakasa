import axios from 'axios';
import { BigQueryUtility } from './utility';

export class SendAPI {
  private bigQueryUtility: BigQueryUtility;
  private pubsub: any; // Pub/Sub クライアント
  private topicName: string;

  constructor(bigQueryUtility: BigQueryUtility, topicName: string) {
    this.bigQueryUtility = bigQueryUtility;
    this.pubsub = new (require('@google-cloud/pubsub').PubSub)();
    this.topicName = topicName;
  }

  // ① API1にリクエストを送信するメソッド
  async sendApiRequest1(data: any) {
    try {
      const headers = {
        'from-planning-key': 'f4491d6e-b601-0db4-7781-939690a798bd'
      };

      const body = {
        confirmation_code: data.confirmation_code,
        guest_review_submitted: data.guest_review_submitted,
        guest_review_submitted_at: data.guest_review_submitted_at,
        pre_checked_in: data.pre_checked_in,
        nationalities: data.nationalities
      };

      const response = await axios.post('https://api1.example.com', body, { headers });
      return response;
    } catch (error) {
      console.error('Error sending request to API 1:', error);
      throw error;
    }
  }

  // ② BigQuery にデータをインサート
  async insertIntoBigQuery(response: any): Promise<void> {
    try {
      const datasetId = 'su_wo';
      const tableId = 'today_send_planner_log';

      const rowsToInsert = [{
        template_id: response.template_id,
        confirmation_codes: response.confirmation_codes,
        priority: response.priority,
        message_posting_time: response.message_posting_time,
        is_force_send: response.is_force_send
      }];

      await this.bigQueryUtility.insertToBQ(datasetId, tableId, rowsToInsert);
      console.log(`Inserted data into ${datasetId}.${tableId}`);
    } catch (error) {
      console.error('Error inserting data into BigQuery:', error);
      throw error;
    }
  }

  // ③ API2にリクエストを送信
  async sendApiRequest2(response: any): Promise<void> {
    try {
      const body = {
        confirmation_codes: response.confirmation_codes,
        priority: response.priority,
        message_posting_time: response.message_posting_time
      };

      await axios.post('https://api2.example.com', body);
      console.log('Sent request to API 2');
    } catch (error) {
      console.error('Error sending request to API 2:', error);
      throw error;
    }
  }

  // ④ BigQueryからデータを取得するメソッド
  async fetchBigQueryData(): Promise<any[]> {
    try {
      const query = `SELECT confirmation_code, guest_review_submitted, guest_review_submitted_at, pre_checked_in, nationalities
        FROM \`m2m-core.su_wo.confirmation_codes_send_to_queingAPI\``;
      const rows = await this.bigQueryUtility.selectFromBQ(query);
      return rows;
    } catch (error) {
      console.error('Error fetching data from BigQuery:', error);
      throw error;
    }
  }

  // ⑤ Pub/Sub にデータを送信するメソッド
  async processAndPublish(data: any[]): Promise<void> {
    try {
      for (let i = 0; i < data.length; i++) {
        const chunk = data[i];
        const dataBuffer = Buffer.from(JSON.stringify(chunk)); // Buffer を使ってデータを送信
        const messageId = await this.pubsub.topic(this.topicName).publish(dataBuffer);
        console.log(`Published message with ID: ${messageId}`);
      }
    } catch (error) {
      console.error('Error publishing to Pub/Sub:', error);
      throw error;
    }
  }
}
