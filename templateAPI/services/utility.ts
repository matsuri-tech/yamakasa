//insertToBQメソッドにはdatasetId, tableId, 挿入するデータ（object[] 型）が必要
//selectFromBQメソッドにはクエリが必要

import { BigQuery } from '@google-cloud/bigquery';

export class BigQueryUtility {
    private bigQuery: BigQuery;

    constructor() {
        // クライアントの作成時に 'm2m-core' プロジェクトIDを指定
        this.bigQuery = new BigQuery({ projectId: 'm2m-core' });
    }

    // 任意のテーブルにデータを挿入するメソッド
    async insertToBQ(datasetId: string, tableId: string, rows: object[]): Promise<void> {
        try {
            await this.bigQuery
                .dataset(datasetId)
                .table(tableId)
                .insert(rows);

            // データ挿入後のログ
            console.log(`Inserted ${rows.length} rows into ${tableId} in project ${this.bigQuery.projectId}`);
        } catch (error) {
            console.error(`Error inserting data into ${tableId} in project ${this.bigQuery.projectId}:`, error);
            throw new Error('Insert operation failed');
        }
    }

    // 任意のクエリを実行してデータを取得するメソッド
    async selectFromBQ(query: string): Promise<any[]> {
        try {
            const [rows] = await this.bigQuery.query(query);
            return rows;
        } catch (error) {
            console.error('Error querying BigQuery:', error);
            throw new Error('Query operation failed');
        }
    }
}