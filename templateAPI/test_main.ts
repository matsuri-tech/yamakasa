import { SQL } from './services/template';         // SQL クラスがあるファイル (例)
import { BigQueryUtility } from './services/utility'; // BigQueryアクセス用ユーティリティ
import { FilterTemplateByCode } from './services/template'; // FilterTemplateByCode クラスがあるファイル (例)

async function main() {
  try {
    // 1. BigQueryUtility をインスタンス化
    const bqUtility = new BigQueryUtility();

    // 2. SQLクラスのインスタンスを作成（実際のテンプレートテーブル名を指定）
    const sql = new SQL('m2m-core.su_wo.test_template_table', bqUtility);

    // 3. BigQueryから実際のテンプレート情報を取得
    //    例として status_booked=true, status_checkin=false, status_checkout=false のパターン
    const status_booked = true;
    const status_checkin = false;
    const status_checkout = false;

    // transformToTemplateConditions で、template_idごとに条件をグループ化
    const templateConditions = await sql.transformToTemplateConditions(
      status_booked,
      status_checkin,
      status_checkout
    );
    console.log('=== Template Conditions from BQ ===');

    // 4. テスト用の data_dict（ゲスト側の情報）を用意（手動で作成）
    const data_dict = {
      status_review: false,
      days_from_review: null,
      days_from_booked: 0,
      days_from_checkin: -5,
      days_from_checkout: -7,
      // trouble_genre_userを配列またはオブジェクトで用意 (要件次第)
      trouble_genre_user: [
        {
          genre: ['C', 'B'],
          user:  ['あ', 'う']
        }
      ],
      cleaning_delay: true,
      listing_id: '12345',
      nationality: ['Japan'],
      confirmation_code: 'ABC123',
      status_booked: true,
      status_checkin: false,
      status_checkout: false,
      days_from_precheckin: 0,
      status_precheckin: true
    };

    // 5. ゲスト情報を FilterTemplateByCode で条件形式に変換
    const filter = new FilterTemplateByCode();
    const guestInformation = filter.transformDataToConditions(data_dict);

    // 6. templateConditions と guestInformation を比較
    const compareResults = filter.compareConditions(guestInformation, templateConditions);
    console.log('=== Compare Results ===');
    console.log(JSON.stringify(compareResults, null, 2));

  } catch (error) {
    console.error('Error in main:', error);
  }
}

// メイン関数実行
main();
