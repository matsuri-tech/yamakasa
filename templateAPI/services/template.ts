/*
guestファイルからうけとるデータ
data_dict = {
    "listing_id": None,  # boolean
    "nationality": None,  # boolean
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
                A.template_id,
                B.content,
                A.condition_id,
                A.condition_key,
                A.operator,
                A.condition_value,
                B.priority,
                B.message_posting_time,
                B.is_force_send
            FROM m2m-core.su_wo.test_condition_table AS A
            INNER JOIN m2m-core.su_wo.test_template_table AS B
                ON A.template_id = B.template_id
            WHERE A.template_id IN (
                SELECT template_id
                FROM m2m-core.su_wo.test_condition_table
                ${whereClause}
            );
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

    // SQLの結果 (rows) をテンプレートIDごとに分類し、条件を一つの配列にまとめ templateConditions に格納
    async transformToTemplateConditions(
        status_booked: boolean,
        status_checkin: boolean,
        status_checkout: boolean
    ): Promise<{
        [templateId: string]: {
            content: string;
            priority: number | null;
            message_posting_time: string | null;
            is_force_send: boolean;
            conditions: {
                condition_id: string;
                key: string;
                operator: string;
                value: any;
            }[];
        };
    }> {
        try {
            const rows = await this.filter_template_by_SQL(status_booked, status_checkin, status_checkout);
            const templateConditions: { [templateId: string]: any } = {};

            // (1) 各行の条件をtemplate_idごとにグループ化
            rows.forEach((row) => {
                const {
                    template_id,
                    content,
                    condition_id,
                    condition_key,
                    operator,
                    condition_value,
                    priority,
                    message_posting_time,
                    is_force_send,
                } = row;

                // condition_value を配列化
                const valueArray = Array.isArray(condition_value) ? condition_value : [condition_value];

                // priority を number | null に
                const parsedPriority: number | null = typeof priority === "string" ? parseFloat(priority) : priority;
                const validPriority: number = parsedPriority !== null && !isNaN(parsedPriority) ? parsedPriority : 0;

                // template_idがまだない場合は初期化
                if (!templateConditions[template_id]) {
                    templateConditions[template_id] = {
                        content,
                        priority: validPriority,
                        message_posting_time,
                        is_force_send,
                        conditions: [],
                    };
                }

                // 条件を条件配列に追加
                templateConditions[template_id].conditions.push({
                    condition_id: String(condition_id),
                    key: condition_key,
                    operator,
                    value: valueArray,
                });
            });

            // (2) trouble_genre と trouble_user の条件を組み合わせる処理
            for (const tId in templateConditions) {
                const condArray = templateConditions[tId].conditions;

                // 新たにまとめた条件を格納するための配列
                const combined: any[] = [];
                // まだ使っていない条件を一時的に保持する配列
                const unused: any[] = [];

                // trouble_genre / trouble_user を探し出して組み合わせるための一時マップ
                const troubleGenreStore: { [op: string]: any } = {};
                const troubleUserStore: { [op: string]: any } = {};

                for (const cond of condArray) {
                    if (cond.key === "trouble_genre") {
                        troubleGenreStore[cond.operator] = cond;
                    } else if (cond.key === "trouble_user") {
                        troubleUserStore[cond.operator] = cond;
                    } else {
                        unused.push(cond);
                    }
                }

                // trouble_genre と trouble_user の両方があればまとめる
                for (const op in troubleGenreStore) {
                    if (troubleUserStore[op]) {
                        const genreValue = troubleGenreStore[op].value; // string[]
                        const userValue = troubleUserStore[op].value;  // string[]
                        const combinedConditionId =
                            troubleGenreStore[op].condition_id + "," + troubleUserStore[op].condition_id;

                        combined.push({
                            condition_id: combinedConditionId,
                            key: "trouble_genre_user",
                            operator: op,
                            value: {
                                genre: genreValue,
                                user: userValue,
                            },
                        });
                    } else {
                        unused.push(troubleGenreStore[op]);
                    }
                }

                // trouble_user のほうが余っているケース
                for (const op in troubleUserStore) {
                    if (!troubleGenreStore[op]) {
                        unused.push(troubleUserStore[op]);
                    }
                }

                // 最終的に combined + unused を conditions に再格納
                templateConditions[tId].conditions = [...unused, ...combined];
            }

            // 最終結果を返す
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

type GuestTroubleItem = {
    genre: string[];
    user:  string[];
};
    
  type ConditionTroubleItem = {
    genre: string[];
    user:  string[];
};
  
export class FilterTemplateByCode {
    status_review: boolean = false;
    days_from_review: number | null = null;
    days_from_booking: number = 0;
    days_from_checkin: number = 0;
    days_from_checkout: number = 0;
    trouble_genre: string[] = [];
    cleaning_delay: boolean = false;
    listing_id: string = '';
    nationality: string[] = [];
    confirmation_code: string = '';
    status_booked: boolean = false;
    status_checkin: boolean = false;
    status_checkout: boolean = false;
    days_from_precheckin: number | null = null;
    status_precheckin: boolean = false;
  
    // data_dictの値を条件のリストに変換する
    transformDataToConditions(data_dict: { [key: string]: any }): { key: string, operator: string, value: any[] }[] {
        const conditions: { key: string, operator: string, value: any[] }[] = [];
      
        for (const key in data_dict) {
          let value = data_dict[key];
      
          // 1) null / undefined
          if (value === null || value === undefined) {
            conditions.push({
              key,
              operator: "==",
              value: ["null"]
            });
          }
          // 2) trouble_genre_userが単一オブジェクト { genre: string[], user: string[] } の場合
          else if (key === "trouble_genre_user" && typeof value === "object" && !Array.isArray(value)) {
            // 例: trouble_genre_user: { genre: [...], user: [...] }
            if (Array.isArray(value.genre) && Array.isArray(value.user)) {
              // { genre:[], user:[] } をそのまま1つのオブジェクトとして value に格納
              conditions.push({
                key,
                operator: "==",
                value: [
                  {
                    genre: value.genre.map((g: any) => String(g)),
                    user:  value.user.map((u: any) => String(u))
                  }
                ]
              });
            } else {
              // 想定外のオブジェクト形式なら、JSON.stringifyなどにする
              conditions.push({
                key,
                operator: "==",
                value: [JSON.stringify(value)]
              });
            }
          }
          // 3) trouble_genre_userが配列の形（例: [{ genre:[], user:[] }, ...]）の場合
          else if (key === "trouble_genre_user" && Array.isArray(value)) {
            // 例: trouble_genre_user: [ { genre: [...], user: [...] } ]
            const mappedArray = value.map((item: any) => {
              if (item && Array.isArray(item.genre) && Array.isArray(item.user)) {
                return {
                  genre: item.genre.map(String),
                  user:  item.user.map(String)
                };
              } else {
                // 想定外データならJSON.stringify等に変換
                return JSON.stringify(item);
              }
            });
      
            conditions.push({
              key,
              operator: "==",
              value: mappedArray
            });
          }
          // 4) 配列（他のキー例: nationalityなど）
          else if (Array.isArray(value)) {
            conditions.push({
              key,
              operator: "==",
              value: value.map((v: any) => String(v))
            });
          }
          // 5) オブジェクト
          else if (typeof value === "object") {
            if (Array.isArray(value.genre) && Array.isArray(value.user)) {
              // { genre: [], user: [] } という形
              conditions.push({
                key,
                operator: "==",
                value: [
                  {
                    genre: value.genre.map((g: any) => String(g)),
                    user:  value.user.map((u: any) => String(u))
                  }
                ]
              });
            } else {
              // それ以外のオブジェクトはJSON.stringifyなど
              conditions.push({
                key,
                operator: "==",
                value: [JSON.stringify(value)]
              });
            }
          }
          // 6) boolean, number, string
          else if (typeof value === "boolean" || typeof value === "number" || typeof value === "string") {
            conditions.push({
              key,
              operator: "==",
              value: [String(value)]
            });
          }
        }
      
        return conditions;
    }
      
      
  
    compareTroubleGenreUser(
      guest: { trouble_genre_user: { genre: string[]; user: string[] }[] },
      condition: { trouble_genre_user: { genre: string[]; user: string[] }[] },
      operator: "==" | "!="
    ): boolean {
  
      console.log("=== compareTroubleGenreUser START ===");
  
      // ゲストの trouble_genre_user を順番に見る
      for (const guestItem of guest.trouble_genre_user) {
        // エッジケース: genre,userが配列であるかを確認
        if (!Array.isArray(guestItem.genre) || !Array.isArray(guestItem.user)) {
          console.log("Guest item is invalid =>", guestItem);
          continue;
        }
  
        // ペアとみなす要素数
        const pairLength = Math.min(guestItem.genre.length, guestItem.user.length);
        console.log("GuestItem =>", guestItem, ", pairLength:", pairLength);
  
        for (let i = 0; i < pairLength; i++) {
          const guestGenre = guestItem.genre[i];
          const guestUser  = guestItem.user[i];
  
          console.log(`Check pair (genre=${guestGenre}, user=${guestUser}) against template...`);
  
          // テンプレート側
          for (const condItem of condition.trouble_genre_user) {
            if (!Array.isArray(condItem.genre) || !Array.isArray(condItem.user)) {
              console.log("CondItem is invalid =>", condItem);
              continue;
            }
            const genreMatch = condItem.genre.includes(guestGenre);
            const userMatch  = condItem.user.includes(guestUser);
  
            if (genreMatch && userMatch) {
              console.log("=> Found a match!");
              if (operator === "==") {
                console.log("=> Returning TRUE");
                return true;  
              } else if (operator === "!=") {
                console.log("=> Returning FALSE (!= operator)");
                return false;
              }
            }
          }
        }
      }
  
      // 最後まで見つからなかった
      if (operator === "==") {
        console.log("No match found => returning FALSE");
        return false;
      } else {
        console.log("No match found => returning TRUE (because !=)");
        return true;
      }
    }
  
    // 比較のメインメソッド
    compareConditions(
        guestInformation: any[],
        templateConditions: {
          [templateId: string]: {
            content: string;
            priority: number | null;
            message_posting_time: string | null;
            is_force_send: boolean;
            conditions: { key: string; operator: string; value: any[] }[];
          };
        }
      ): {
        template_id: string;
        message: string;
        priority: number | null;
        message_posting_time: string | null;
        is_force_send: boolean;
      }[] {
        const templateResults: {
          template_id: string;
          message: string;
          priority: number | null;
          message_posting_time: string | null;
          is_force_send: boolean;
        }[] = [];
      
        console.log("===== compareConditionsUnified 開始 =====");
      
        for (const templateId in templateConditions) {
          const template = templateConditions[templateId];
          let allConditionsMatch = true;
      
          // 1) 普通の条件チェック (trouble_genre_user以外)
          for (const condition of template.conditions) {
            if (condition.key === 'trouble_genre_user') {
              console.log(`Skipping condition ${condition.key} in normal logic`);
              continue;
            }
            console.log(`Checking normal condition => key: ${condition.key}, operator: ${condition.operator}, value: ${JSON.stringify(condition.value)}`);
      
            const matchingCondition = guestInformation.find(guest => {
              // guest.value と condition.value が配列かどうかは不定。とりあえず配列に包む
              const guestValueArray = Array.isArray(guest.value) ? guest.value : [guest.value];
              const conditionValueArray = Array.isArray(condition.value) ? condition.value : [condition.value];
      
              if (condition.operator === "==") {
                return guest.key === condition.key &&
                  guest.operator === condition.operator &&
                  guestValueArray.some((val: string | number | boolean) => conditionValueArray.includes(val));
              } else if (condition.operator === "!=") {
                return guest.key === condition.key &&
                  guest.operator === condition.operator &&
                  !guestValueArray.some((val: string | number | boolean) => conditionValueArray.includes(val));
              }
              return false;
            });
      
            // 条件に一致するゲスト情報がない場合、false
            if (!matchingCondition) {
              console.log("=> No matching condition found; set allConditionsMatch = false");
              allConditionsMatch = false;
              break;
            } else {
              console.log("=> Found matching condition =>", matchingCondition);
            }
          }
      
          // 2) trouble_genre_user の特別チェック
          const troubleGenreUserCondition = template.conditions.find(c => c.key === "trouble_genre_user");
          if (troubleGenreUserCondition) {
            console.log("Now checking trouble_genre_user separately =>", troubleGenreUserCondition);
      
            if (allConditionsMatch) {
              const operator = troubleGenreUserCondition.operator as "==" | "!=";
              const guestTrouble = guestInformation.find(g => g.key === "trouble_genre_user");
      
              // ① ゲスト側を配列に包む/単一オブジェクトなら配列にする
              if (!guestTrouble || !guestTrouble.value) {
                console.log("=> guestTrouble not found => unmatched");
                allConditionsMatch = false;
              } else {
                // たとえば、トラブル情報が配列か単体オブジェクトかを吸収
                const guestTroubleArray = Array.isArray(guestTrouble.value)
                  ? guestTrouble.value
                  : [ guestTrouble.value ];  // 単体なら配列に包む
      
                // ② テンプレ側を配列に包む
                const conditionValue = troubleGenreUserCondition.value;
                const conditionTroubleArray = Array.isArray(conditionValue)
                  ? conditionValue
                  : [ conditionValue ];  // 単体なら配列に包む
      
                if (!Array.isArray(conditionTroubleArray)) {
                  console.log("=> conditionTrouble.value is invalid => unmatched");
                  allConditionsMatch = false;
                } else {
                  // ③ compareTroubleGenreUser に配列を渡す
                  const isMatch = this.compareTroubleGenreUser(
                    { trouble_genre_user: guestTroubleArray },
                    { trouble_genre_user: conditionTroubleArray },
                    operator
                  );
                  if (!isMatch) {
                    console.log("=> trouble_genre_user was not matched => set allConditionsMatch = false");
                    allConditionsMatch = false;
                  } else {
                    console.log("=> trouble_genre_user matched => keep allConditionsMatch = true");
                  }
                }
              }
            } else {
              console.log("=> Already allConditionsMatch = false; skipping trouble_genre_user check");
            }
          }
      
          if (allConditionsMatch) {
            console.log(`=== Template ${templateId} matched! ===`);
            templateResults.push({
              template_id: templateId,
              message: template.content,
              priority: template.priority ?? null,
              message_posting_time: template.message_posting_time ?? null,
              is_force_send: template.is_force_send
            });
          } else {
            console.log(`=== Template ${templateId} did NOT match ===`);
          }
        }
      
        console.log("===== compareConditionsUnified 終了 =====");
        console.log("templateResults:", JSON.stringify(templateResults, null, 2));
      
        return templateResults;
    }   
}  