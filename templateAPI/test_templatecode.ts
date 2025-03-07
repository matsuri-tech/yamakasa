import { FilterTemplateByCode } from './src/services/template'; // クラスのあるファイルパスに合わせて

async function main() {
  // 1. FilterTemplateByCode のインスタンスを作成
  const filter = new FilterTemplateByCode();

  // 2. テスト用の data_dict を用意（ゲスト側の情報）
  const data_dict = {
    status_review: false,
    days_from_review: null,
    days_from_booking: 7,
    days_from_checkin: 1,
    days_from_checkout: 2,
    trouble_genre_user: [{genre: ['wifi', 'key'], user:['D', 'B']}],
    cleaning_delay: false,
    listing_id: '12345',
    nationality: ['Japan'],
    confirmation_code: 'ABC123',
    status_booked: true,
    status_checkin: true,
    status_checkout: true,
    days_from_precheckin: null,
    status_precheckin: false
  };

  // 3. data_dictを条件形式に変換
  const guestInformation = filter.transformDataToConditions(data_dict);

  // 4. テンプレート側の条件（DBから取得した想定）を用意
  const templateConditions = {
    // テンプレートID: template_1
    'template_1': {
      content: "Hello from template_1",
      priority: 1,
      message_posting_time: "2025-01-01T00:00:00Z",
      is_force_send: false,
      conditions: [
        { key: 'trouble_genre_user', operator: '==', value: [{genre: ['wifi', 'garbage','key'], user: ['A', 'B', 'C']} ]},
        { key: 'nationality', operator: '==', value: ['USA'] }
      ]
    },
    // テンプレートID: template_2
    'template_2': {
      content: "Hello from template_2",
      priority: 2,
      message_posting_time: "2025-01-01T12:00:00Z",
      is_force_send: true,
      conditions: [
        { key: 'status_checkout', operator: '==', value: ['true'] }
      ]
    },
  };

  // 5. ゲスト条件とテンプレート条件を比較
  const compareResults = filter.compareConditions(guestInformation, templateConditions);

  // 6. テスト結果をコンソールに出力
  console.log('=== Compare Results ===');
  console.log(JSON.stringify(compareResults, null, 2));
}

// メイン関数を実行
main().catch((err) => {
  console.error('Error in main:', err);
});
