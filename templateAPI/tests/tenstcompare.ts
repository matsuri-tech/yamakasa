// testCompare.ts

import { FilterTemplateByCode } from '../services/template'; // パスは実際の構造に合わせて修正

// テスト用の guestInformation と templateConditions
const guestInformation = [
  { key: "listing_id", operator: "==", value: "81f63d83-a07b-4b9a-90d7-7059fb791227" },
  { key: "trouble_genre_user", operator: "==", value: [{ user: ["あ", "い"], genre: ["A", "B"] }] }
];

const templateConditions = {
  "2-1": {
    content: "2-1だよ",
    conditions: [
      {
        condition_id: "295",
        key: "trouble_genre_user",
        operator: "==",
        value: [
          { user: ["あ", "い"], genre: ["A", "B"] }
        ]
      }
    ]
  },
  "2-3": {
    content: "2-3だよ",
    conditions: [
      {
        condition_id: "296",
        key: "trouble_genre_user",
        operator: "==",
        value: [
          { user: ["あ"], genre: ["A"] }
        ]
      }
    ]
  }
};

// FilterTemplateByCode のインスタンスを生成
const filterInstance = new FilterTemplateByCode();

// compareConditions メソッドを呼び出して結果を表示
const result = filterInstance.compareConditions(guestInformation, templateConditions);
console.log("Matched Templates:", result);
