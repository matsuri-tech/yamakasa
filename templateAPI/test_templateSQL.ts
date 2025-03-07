import { SQL } from './src/services/template';
import { BigQueryUtility } from './src/services/utility';

async function runTest() {
  // BigQueryUtilityインスタンスを作成（認証情報が設定されていることを前提）
  const bigQueryUtility = new BigQueryUtility();

  // SQLクラスをインスタンス化
  const sql = new SQL('m2m-core.su_wo.test_template_table', bigQueryUtility);

  // テストデータ
  const status_booked = true;
  const status_checkin = false;
  const status_checkout = false;

  try {
    // 実際のBigQueryからデータを取得して変換
    const templateConditions = await sql.transformToTemplateConditions(status_booked, status_checkin, status_checkout);

    // JSON.stringifyを使って、テンプレート条件を見やすい形式で出力
    console.log('Test Result:', JSON.stringify(templateConditions, null, 2));

  } catch (error) {
    console.error('Test Error:', error);
  }
}

// テストを実行
runTest();