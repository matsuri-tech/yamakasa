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
            //console.log("Rows from SQL:", rows);
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

                /*
                console.log(`Adding condition to template ${template_id}:`, {
                    condition_id,
                    key: condition_key,
                    operator,
                    value: valueArray,
                });
                */

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

            // null または undefined の場合、null で処理
            if (value === null || value === undefined) {
                conditions.push({
                    key: key,
                    operator: "==",
                    value: ["null"] // null の場合、"null" という文字列で処理
                });
            }
            // 配列の場合（nationality など）
            else if (Array.isArray(value)) {
                conditions.push({
                    key: key,
                    operator: "==",
                    value: value.map((v: any) => String(v)) // 文字列配列に統一
                });
            }
            // オブジェクトの場合（trouble_genre_user など）
            else if (typeof value === "object") {
                // もし { genre: string[], user: string[] } 形式なら、まとめて一つの要素に包む
                if (Array.isArray(value.genre) && Array.isArray(value.user)) {
                    conditions.push({
                        key: key,
                        operator: "==",
                        value: [
                            {
                                genre: value.genre.map((v: any) => String(v)),
                                user: value.user.map((v: any) => String(v))
                            }
                        ]
                    });
                } else {
                    // それ以外のオブジェクトの場合は、
                    // どう扱うか要件次第。単に JSON.stringify して1要素配列に格納するなど。
                    conditions.push({
                        key: key,
                        operator: "==",
                        value: [JSON.stringify(value)]
                    });
                }
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
                    value: [String(value)]
                });
            }
        }

        return conditions;
    }

    compareTroubleGenreUser(
        guest: { trouble_genre_user: { genre: string[], user: string[] }[] },
        condition: { trouble_genre_user: { genre: string[], user: string[] }[] },
        operator: "==" | "!="
    ): boolean {
        for (const guestItem of guest.trouble_genre_user) {
            let matchFound = false;

            // ゲストの各組み合わせ（genre と user）を順番通りに確認
            for (let i = 0; i < guestItem.genre.length; i++) {
                const guestGenre = guestItem.genre[i];
                const guestUser = guestItem.user[i];

                // 条件の中で一致するものを探す
                for (const conditionItem of condition.trouble_genre_user) {
                    const genreMatch = conditionItem.genre.includes(guestGenre); // 条件の genre と一致するか
                    const userMatch = conditionItem.user.includes(guestUser);   // 条件の user と一致するか

                    // 一致する場合、matchFound を true に設定
                    if (genreMatch && userMatch) {
                        matchFound = true;
                        break;  // 一度一致すれば次のゲスト情報を確認
                    }
                }

                // 両方が一致すればループ終了
                if (matchFound) break;
            }

            // == の場合、一致しない場合は false
            if (operator === "==" && !matchFound) {
                return false;
            }

            // != の場合、一致があった場合は false
            if (operator === "!=" && matchFound) {
                return false;
            }
        }

        // すべてのゲスト情報が一致した場合は true
        return operator === "==" ? true : true;
    }

    // 比較のメインメソッド
    //戻り値に何を設定するかの分岐はメイン関数で行うため、ここでは戻り値になるものすべてを返す。
    compareConditions(
        guestInformation: any[],
        templateConditions: {
            [templateId: string]: {
                content: string;
                priority: number | null;
                message_posting_time: string | null;
                is_force_send: boolean; // is_force_sendを追加
                conditions: { key: string; operator: string; value: any[] }[];
            };
        }
    ): {
        template_id: string;
        message: string;
        priority: number | null;
        message_posting_time: string | null;
        is_force_send: boolean;  // 戻り値にis_force_sendを含める
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

            for (const condition of template.conditions) {
                const matchingCondition = guestInformation.find(guest => {
                    const guestValueArray = Array.isArray(guest.value) ? guest.value : [guest.value];
                    const conditionValueArray = Array.isArray(condition.value) ? condition.value : [condition.value];

                    // 普通のkey,valueでの比較（== と != の比較）
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
                    allConditionsMatch = false;
                    break;
                }
            }

            // trouble_genre_user に関する条件チェック
            const troubleGenreUserCondition = template.conditions.find(condition => condition.key === "trouble_genre_user");
            if (troubleGenreUserCondition) {
                const operator = troubleGenreUserCondition.operator as "==" | "!=";

                // guestInformation から "trouble_genre_user" を正しく取得
                const guestTrouble = guestInformation.find(guest => guest.key === "trouble_genre_user");

                // condition と guest の両方に "trouble_genre_user" が存在する場合のみ比較
                if (guestTrouble && guestTrouble.value && Array.isArray(guestTrouble.value)) {
                    const conditionTrouble = template.conditions.find(condition => condition.key === "trouble_genre_user");

                    // condition も確認して、trouble_genre_user のチェックを行う
                    if (conditionTrouble && conditionTrouble.value && Array.isArray(conditionTrouble.value)) {
                        const isMatch = this.compareTroubleGenreUser(
                            {
                                trouble_genre_user: guestTrouble.value as { genre: string[], user: string[] }[]
                            },
                            {
                                trouble_genre_user: conditionTrouble.value as { genre: string[], user: string[] }[]
                            },
                            operator
                        );
                        if (!isMatch) {
                            allConditionsMatch = false;
                        }
                    }
                }
            }

            // 条件が一致した場合、結果に追加
            if (allConditionsMatch) {
                templateResults.push({
                    template_id: templateId,
                    message: template.content,
                    priority: template.priority ?? null,
                    message_posting_time: template.message_posting_time ?? null,
                    is_force_send: template.is_force_send // is_force_sendを結果に含める
                });
            }
        }

        console.log("===== compareConditionsUnified 終了 =====");

        return templateResults;
    }
}