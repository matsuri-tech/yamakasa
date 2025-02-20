import axios from 'axios';
import { BigQueryUtility } from './utility';

export class SendAPI {
  private bigQueryUtility: BigQueryUtility;

  constructor(bigQueryUtility: BigQueryUtility) {
    this.bigQueryUtility = bigQueryUtility;
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
}