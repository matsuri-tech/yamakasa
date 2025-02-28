import { PubSub } from '@google-cloud/pubsub';
import { BigQueryUtility } from './utility';

export class DataProcessor {
  private bigQueryUtility: BigQueryUtility;
  private pubsub: PubSub;
  private topicName: string;

  constructor(bigQueryUtility: BigQueryUtility, topicName: string) {
    this.bigQueryUtility = bigQueryUtility;
    // ▼ 追加/修正：projectId を明示したい場合は設定
    this.pubsub = new PubSub({
      apiEndpoint: 'localhost:8085',
      projectId: 'm2m-core', // 必要ならご利用のprojectIdに合わせる
    });
    // ▲ 追加/修正：ローカルエミュレーターを使う際にprojectIdがずれると見つからない場合がある

    this.topicName = topicName;
  }

  // ▼ 追加: トピックがなければ作成するメソッド
  public async ensureTopicExists(): Promise<void> {
    // 現在存在するトピック一覧を取得
    const [topics] = await this.pubsub.getTopics();
    // トピック名は "projects/<projectId>/topics/<topicName>" の形式になっている
    const fullTopicName = `projects/${this.pubsub.projectId}/topics/${this.topicName}`;

    const found = topics.some((t) => t.name === fullTopicName);
    if (!found) {
      await this.pubsub.createTopic(this.topicName);
      console.log(`Created topic: ${this.topicName}`);
    } else {
      console.log(`Topic already exists: ${this.topicName}`);
    }
  }
  // ▲ 追加ここまで

  // BigQueryからデータを取得するメソッド
  async fetchBigQueryData(): Promise<any[]> {
    try {
      const query = `
        SELECT confirmation_code, guest_review_submitted, guest_review_submitted_at, pre_checked_in, nationality
        FROM \`m2m-core.su_wo.confirmation_codes_send_to_queingAPI\`
      `;
      const rows = await this.bigQueryUtility.selectFromBQ(query);
      console.log(`Fetched ${rows.length} rows from BigQuery.`);
      return rows;
    } catch (error) {
      console.error('Error fetching data from BigQuery:', error);
      throw error;
    }
  }

  // データを指定したサイズで分割するメソッド
  chunkData(data: any[], size: number): any[][] {
    const result: any[][] = [];
    for (let i = 0; i < data.length; i += size) {
      result.push(data.slice(i, i + size));
    }
    return result;
  }

  // Pub/Sub にデータを送信するメソッド
  async processAndPublish(data: any[]): Promise<void> {
    try {
      const chunkedData = this.chunkData(data, 30);  // 30件ずつに分割
      for (let i = 0; i < chunkedData.length; i++) {
        const chunk = chunkedData[i];
        const dataBuffer = Buffer.from(JSON.stringify(chunk));
        const messageId = await this.pubsub.topic(this.topicName).publish(dataBuffer);
        console.log(`Published message with ID: ${messageId}`);
      }
    } catch (error) {
      console.error('Error publishing to Pub/Sub:', error);
      throw error;
    }
  }
}