/*
guestファイルからうけとるデータ
data_dict = {
    "listing_id": None,  # boolean
    "processedNationality": None,  # boolean
    "confirmation_code": "",  # string
    "today_date": "",  # string
    "booked_date": "",  # string
    "checkin_date": "",  # string
    "checkout_date": "",  # string
    "days_from_booking": 0,  # number
    "days_from_checkin": 0,  # number
    "days_from_checkout": 0,  # number
    "status_booked": None,  # boolean
    "status_checkin": None,  # boolean
    "status_checkout": None,  # boolean
    "trouble_genre": "",  # string
    "status_precheckin": None,  # boolean
    "days_from_precheckin": 0,  # number
    "status_review": None,  # boolean
    "days_from_review": 0,  # number
    "cleaning_delay": None,  # boolean
    "guest_review_submitted_at": "",  # string
}

*/ 


import { BigQueryUtility } from './utility';

export class SQL {
    table_name: string;
    private bqUtility: BigQueryUtility;

    constructor(table_name: string, bqUtility: BigQueryUtility) {
        this.table_name = table_name;
        this.bqUtility = bqUtility;
    }

    // ステータスに応じた条件を決定する
    decide_status(status_booked: boolean, status_checkin: boolean, status_checkout: boolean): string | null {
        let conditionKey: string | null = null;

        if (status_booked && !status_checkin && !status_checkout) {
            conditionKey = "status_booked";
        } else if (status_booked && status_checkin && !status_checkout) {
            conditionKey = "status_checkin";
        } else if (status_booked && status_checkin && status_checkout) {
            conditionKey = "status_checkout";
        } else {
            return null;
        }

        return `WHERE condition_key = "${conditionKey}"`;
    }

    // SQL クエリを生成する（配列フィールドに対応）
    generate_SQL(
        status_booked: boolean,
        status_checkin: boolean,
        status_checkout: boolean
    ): string {
        if (!this.table_name) {
            throw new Error("Table name is required");
        }

        const whereClause = this.decide_status(status_booked, status_checkin, status_checkout);
        if (whereClause === null) {
            throw new Error("Invalid status combination. Only (T,F,F), (T,T,F), or (T,T,T) are allowed.");
        }

        return `
            SELECT 
            B.template_id, 
            B.content, 
            A.condition_id, 
            A.condition_key, 
            A.operator, 
            A.condition_value, 
            B.priority,
            B.message_posting_time,
            B.is_force_send 
            FROM \`m2m-core.su_wo.test_condition_table\` AS A
            INNER JOIN \`${this.table_name}\` AS B 
            ON A.template_id = B.template_id
            ${whereClause}
        `.trim();
    }

    // BigQueryからフィルタリングされたデータを取得
    async filter_template_by_SQL(
        status_booked: boolean,
        status_checkin: boolean,
        status_checkout: boolean
    ): Promise<any[]> {
        try {
            const query = this.generate_SQL(status_booked, status_checkin, status_checkout);
            console.log(`Executing query: ${query}`);
            return await this.bqUtility.selectFromBQ(query);
        } catch (error) {
            console.error("Error executing filter_template_by_SQL:", error);
            throw new Error("Failed to retrieve data from BigQuery");
        }
    }

    // SQLの結果を `templateConditions` 形式に変換
    async transformToTemplateConditions(
        status_booked: boolean,
        status_checkin: boolean,
        status_checkout: boolean
    ): Promise<{ [templateId: string]: { content: string, priority: number | null, message_posting_time: string | null, is_force_send: boolean, conditions: { condition_id: string, key: string, operator: string, value: string[] }[] } }> {
        try {
            const rows = await this.filter_template_by_SQL(status_booked, status_checkin, status_checkout);
            const templateConditions: { [templateId: string]: any } = {};

            rows.forEach(row => {
                const { template_id, content, condition_id, condition_key, operator, condition_value, priority, message_posting_time, is_force_send } = row;

                // `condition_value` を `ARRAY<STRING>` 型として処理
                const valueArray = Array.isArray(condition_value) ? condition_value : [condition_value];

                // `priority` を `number | null` に統一
                const parsedPriority: number | null = typeof priority === "string" ? parseFloat(priority) : priority;
                const validPriority: number = parsedPriority !== null && !isNaN(parsedPriority) ? parsedPriority : 0;

                if (!templateConditions[template_id]) {
                    templateConditions[template_id] = {
                        content,
                        priority: validPriority,
                        message_posting_time,
                        is_force_send,
                        conditions: []
                    };
                }

                templateConditions[template_id].conditions.push({
                    condition_id: condition_id.toString(), // `STRING` に統一
                    key: condition_key,
                    operator,
                    value: valueArray // `REPEATED` 型に適合
                });
            });

            return templateConditions;
        } catch (error) {
            console.error("Error transforming SQL result to templateConditions:", error);
            throw new Error("Failed to transform data");
        }
    }
}


  


/*
const templateConditions: { [templateId: string]: { content: string, conditions: { condition_id: number, key: string, operator: string, value: string | boolean | null }[] } } = {
  "1-1": {
    content: "Content for template 1-1",  // template_id 1-1 に紐づく content
    conditions: [
      { condition_id: 1, key: "status_book", operator: "==", value: true },
      { condition_id: 2, key: "days_from_book", operator: "==", value: 0 },
      { condition_id: 3, key: "status_precheckin", operator: "==", value: true },
      { condition_id: 4, key: "cleaning_delay", operator: "==", value: true }
    ]
  },
  "1-2": {
    content: "Content for template 1-2",  // template_id 1-2 に紐づく content
    conditions: [
      { condition_id: 5, key: "status_book", operator: "==", value: true },
      { condition_id: 6, key: "days_from_book", operator: "==", value: 0 },
      { condition_id: 7, key: "status_precheckin", operator: "==", value: true },
      { condition_id: 8, key: "cleaning_delay", operator: "==", value: false }
    ]
  }
};

guest_information側
[
  { key: "listing_id", operator: "==", value: null },
  { key: "processedNationality", operator: "==", value: ["US", "JP"] },
  { key: "confirmation_code", operator: "==", value: "XYZ123" },
  { key: "status_review", operator: "==", value: true },
  { key: "days_from_booking", operator: "==", value: 10 }
]


*/ 
export class FilterTemplateByCode {
  status_review: boolean = false;
  days_from_review: number = 0;
  days_from_booking: number = 0;
  days_from_checkin: number = 0;
  days_from_checkout: number = 0;
  trouble_genre: string[] = [];
  cleaning_delay: boolean = false;
  listing_id: string = '';
  nationality: string[] = [];
  confirmation_code: string = '';

  // data_dictの値を条件のリストに変換する
  transformDataToConditions(data_dict: { [key: string]: any }): { key: string, operator: string, value: string[] }[] {
    const conditions: { key: string, operator: string, value: string[] }[] = [];
  
    for (const key in data_dict) {
      const value = data_dict[key];
  
      // null の場合
      if (value === null) {
        conditions.push({
          key: key,
          operator: "==",
          value: ["null"] // null を文字列 "null" に変換
        });
      }
      // 配列の場合は、各要素を string に変換
      else if (Array.isArray(value)) {
        conditions.push({
          key: key,
          operator: "==",
          value: value.map((v: any) => String(v)) // 各要素を String() で変換
        });
      }
      // boolean, number, string の場合
      else if (
        typeof value === "boolean" ||
        typeof value === "number" ||
        typeof value === "string"
      ) {
        conditions.push({
          key: key,
          operator: "==",
          value: [String(value)] // 単一の値を String() で変換
        });
      }
    }
  
    return conditions;
  }
  

compareConditions(
  guestInformation: any[], 
  templateConditions: { [templateId: string]: { content: string, conditions: { key: string, operator: string, value: any[] }[] } }
) {
  const templateResults: { templateId: string, content: string }[] = [];
  console.log("===== compareConditions 開始 =====");
  //console.log("受け取った guestInformation:", JSON.stringify(guestInformation, null, 2));
  //console.log("受け取った templateConditions:", JSON.stringify(templateConditions, null, 2));

  for (const templateId in templateConditions) {
      const template = templateConditions[templateId];
      let allConditionsMatch = true;
      //console.log(`\n🔹 テンプレート ${templateId} のチェック開始`);

      // 各条件を比較
      for (const condition of template.conditions) {
          //console.log(`  🔍 条件チェック: ${JSON.stringify(condition)}`);
          
          const matchingCondition = guestInformation.find(guest => {
              //console.log(`    📌 ゲスト情報チェック: ${JSON.stringify(guest)}`);
              
              const guestValueArray = Array.isArray(guest.value) ? guest.value : [guest.value];
              const conditionValueArray = Array.isArray(condition.value) ? condition.value : [condition.value];

              if (condition.operator === "==") {
                  const match = guest.key === condition.key &&
                      guest.operator === condition.operator &&
                      guestValueArray.some((val: string | number | boolean) => conditionValueArray.includes(val));

                  //console.log(`      ✅ 条件一致: ${match}`);
                  return match;
              } else if (condition.operator === "!=") {
                  const match = guest.key === condition.key &&
                      guest.operator === condition.operator &&
                      !guestValueArray.some((val: string | number | boolean) => conditionValueArray.includes(val));

                  //console.log(`      ❌ 条件不一致: ${match}`);
                  return match;
              }

              return false;
          });

          if (!matchingCondition) {
              //console.log(`  ❌ 条件が一致しませんでした。テンプレート ${templateId} は適用不可。`);
              allConditionsMatch = false;
              break;
          }
      }

      if (allConditionsMatch) {
          //console.log(`✅ テンプレート ${templateId} は全条件を満たしました。`);
          templateResults.push({
              templateId: templateId,
              content: template.content
          });
      }
  }

  console.log("===== compareConditions 終了 =====");
  return templateResults;
}

compareConditionsforplanner(
  guestInformation: any[],
  templateConditions: { 
    [templateId: string]: { 
      content: string, 
      priority: number | null, 
      message_posting_time: string | null, 
      conditions: { key: string, operator: string, value: any[] }[] 
    } 
  }
): { confirmation_codes: string, priority: number, message_posting_time: string }[] {

  const templateResults: { confirmation_codes: string, priority: number, message_posting_time: string }[] = [];
  console.log("===== compareConditionsforplanner 開始 =====");
  //console.log("受け取った guestInformation:", JSON.stringify(guestInformation, null, 2));
  //console.log("受け取った templateConditions:", JSON.stringify(templateConditions, null, 2));

  for (const templateId in templateConditions) {
      const template = templateConditions[templateId];
      let allConditionsMatch = true;
      //console.log(`\n🔹 テンプレート ${templateId} のチェック開始`);

      for (const condition of template.conditions) {
          //console.log(`  🔍 条件チェック: ${JSON.stringify(condition)}`);

          const matchingCondition = guestInformation.find(guest => {
              //console.log(`    📌 ゲスト情報チェック: ${JSON.stringify(guest)}`);

              const guestValueArray = Array.isArray(guest.value) ? guest.value : [guest.value];
              const conditionValueArray = Array.isArray(condition.value) ? condition.value : [condition.value];

              if (condition.operator === "==") {
                  const match = guest.key === condition.key &&
                      guest.operator === condition.operator &&
                      guestValueArray.some((val: string | number | boolean) => conditionValueArray.includes(val));

                  //console.log(`      ✅ 条件一致: ${match}`);
                  return match;
              } else if (condition.operator === "!=") {
                  const match = guest.key === condition.key &&
                      guest.operator === condition.operator &&
                      !guestValueArray.some((val: string | number | boolean) => conditionValueArray.includes(val));

                  //console.log(`      ❌ 条件不一致: ${match}`);
                  return match;
              }

              return false;
          });

          if (!matchingCondition) {
              //console.log(`  ❌ 条件が一致しませんでした。テンプレート ${templateId} は適用不可。`);
              allConditionsMatch = false;
              break;
          }
      }

      if (allConditionsMatch) {
          //console.log(`✅ テンプレート ${templateId} は全条件を満たしました。`);
          templateResults.push({
              confirmation_codes: templateId,
              priority: template.priority ?? 0,  // null の場合 0 に置き換える
              message_posting_time: template.message_posting_time ?? ""  // null の場合 空文字に置き換える
          });
      }
  }

  console.log("===== compareConditionsforplanner 終了 =====");
  return templateResults;
}




}
