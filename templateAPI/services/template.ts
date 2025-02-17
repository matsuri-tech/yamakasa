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

import { BigQueryUtility } from './BigQueryUtility';

export class SQL {
    status_booked: boolean = false;
    status_checkin: boolean = false;
    status_checkout: boolean = false;
    table_name: string = ''; 

    private bqUtility: BigQueryUtility;

    constructor() {
        this.bqUtility = new BigQueryUtility();
    }

    // ステータスに応じた条件を決定する
    decide_status(): string | null {
      let conditionKey: string | null = null;
  
      // book(T) in(F) out(F) → "status_book"
      if (this.status_booked && !this.status_checkin && !this.status_checkout) {
          conditionKey = "status_book";
      }
      // book(T) in(T) out(F) → "status_checkin"
      else if (this.status_booked && this.status_checkin && !this.status_checkout) {
          conditionKey = "status_checkin";
      }
      // book(T) in(T) out(T) → "status_checkout"
      else if (this.status_booked && this.status_checkin && this.status_checkout) {
          conditionKey = "status_checkout";
      }
      // 許可されていない組み合わせの場合は null を返す
      else {
          return null;
      }
  
      return `WHERE B.condition_key = "${conditionKey}"`;
  }
  
    // SQL クエリを生成する
    generate_SQL(): string {
      if (!this.table_name) {
          throw new Error("Table name is required");
      }
  
      const whereClause = this.decide_status();
      if (whereClause === null) {
          throw new Error("Invalid status combination. Only (T,F,F), (T,T,F), or (T,T,T) are allowed.");
      }
  
      return `
          SELECT B.template_id, B.content, A.condition_id, A.key, A.operator, A.value FROM 
          \`m2m-core.su_wo.test_condition_table\` AS A
          LEFT OUTER JOIN \`${this.table_name}\` AS B 
          ON A.template_id = B.template_id
          ${whereClause}
      `.trim();
  }  

    // BigQueryからフィルタリングされたデータを取得
    async filter_template_by_SQL(): Promise<any[]> {
        try {
            const query = this.generate_SQL();
            console.log(`Executing query: ${query}`);
            const rows = await this.bqUtility.selectFromBQ(query);
            return rows;
        } catch (error) {
            console.error("Error executing filter_template_by_SQL:", error);
            throw new Error("Failed to retrieve data from BigQuery");
        }
    }

    // SQLの結果をtemplateConditions形式に変換
    async transformToTemplateConditions(): Promise<{ [templateId: string]: { content: string, conditions: { condition_id: number, key: string, operator: string, value: string | boolean | null }[] } }> {
        try {
            const rows = await this.filter_template_by_SQL();
            
            // 結果をtemplateConditions形式に変換
            const templateConditions: { [templateId: string]: { content: string, conditions: { condition_id: number, key: string, operator: string, value: string | boolean | null }[] } } = {};

            rows.forEach(row => {
                const { template_id, content, condition_id, key, operator, value } = row;

                // template_idがまだtemplateConditionsにない場合、初期化
                if (!templateConditions[template_id]) {
                    templateConditions[template_id] = {
                        content: content,
                        conditions: []
                    };
                }

                // conditionsリストに新しい条件を追加
                templateConditions[template_id].conditions.push({
                    condition_id,
                    key,
                    operator,
                    value
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
  transformDataToConditions(data_dict: { [key: string]: any }): { key: string, operator: string, value: string | number | boolean | null | any[] }[] {
    const conditions: { key: string, operator: string, value: string | number | boolean | null | any[] }[] = []; // 型定義を明示的に指定

    for (const key in data_dict) {
      const value = data_dict[key];

      if (value === null) {
        conditions.push({
          key: key,
          operator: "==",
          value: null
        });
      }
      // 配列の場合でも==演算子を使用
      else if (Array.isArray(value)) {
        conditions.push({
          key: key,
          operator: "==",  // 配列でも==演算子を使用
          value: value
        });
      }
      // boolean, number, string の場合、通常の条件を追加
      else if (typeof value === "boolean" || typeof value === "number" || typeof value === "string") {
        conditions.push({
          key: key,
          operator: "==",
          value: value
        });
      }
    }

    return conditions;
  }

  // guest_informationとtemplateConditionsを比較して、判定する
  compareConditions(guestInformation: any[], templateConditions: { [templateId: string]: { content: string, conditions: { key: string, operator: string, value: any }[] } }) {
    const templateResults: { templateId: string, content: string }[] = [];

    for (const templateId in templateConditions) {
      const template = templateConditions[templateId];
      let allConditionsMatch = true;

      // 各条件を比較
      for (const condition of template.conditions) {
        const matchingCondition = guestInformation.find(guest => {
          // key, operator, valueがすべて一致するかを比較
          return guest.key === condition.key &&
                 guest.operator === condition.operator &&
                 JSON.stringify(guest.value) === JSON.stringify(condition.value);
        });

        // 一致する条件がなければ、判定をfalseに
        if (!matchingCondition) {
          allConditionsMatch = false;
          break;  // 条件が一致しない場合は次のtemplate_idへ
        }
      }

      // すべての条件が一致した場合、そのtemplate_idとcontentを返す
      if (allConditionsMatch) {
        templateResults.push({
          templateId: templateId,
          content: template.content
        });
      }
    }

    return templateResults;
  }
}

