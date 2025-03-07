"use strict";
/*
guestファイルからうけとるデータ
data_dict = {
    "listing_id": None,  # boolean
    "nationality": [],  # string
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
    "trouble_genre": [],  # string
    "status_precheckin": None,  # boolean
    "days_from_precheckin": 0,  # number
    "status_review": None,  # boolean
    "days_from_review": 0,  # number
    "cleaning_delay": None,  # boolean
    "guest_review_submitted_at": "",  # string
}

*/
Object.defineProperty(exports, "__esModule", { value: true });
exports.FilterTemplateByCode = exports.SQL = void 0;
class SQL {
    constructor(table_name, bqUtility) {
        this.table_name = table_name;
        this.bqUtility = bqUtility;
    }
    // ステータスに応じた条件を決定する
    decide_status(status_booked, status_checkin, status_checkout) {
        let conditionKey = null;
        if (status_booked && !status_checkin && !status_checkout) {
            conditionKey = "status_booked";
        }
        else if (status_booked && status_checkin && !status_checkout) {
            conditionKey = "status_checkin";
        }
        else if (status_booked && status_checkin && status_checkout) {
            conditionKey = "status_checkout";
        }
        else {
            return null;
        }
        return `WHERE condition_key = "${conditionKey}"`;
    }
    // SQL クエリを生成する（配列フィールドに対応）
    generate_SQL(status_booked, status_checkin, status_checkout) {
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
            )
            AND B.is_active = true;
        `.trim();
    }
    // BigQueryからフィルタリングされたデータを取得
    async filter_template_by_SQL(status_booked, status_checkin, status_checkout) {
        try {
            const query = this.generate_SQL(status_booked, status_checkin, status_checkout);
            console.log(`Executing query: ${query}`);
            return await this.bqUtility.selectFromBQ(query);
        }
        catch (error) {
            console.error("Error executing filter_template_by_SQL:", error);
            throw new Error("Failed to retrieve data from BigQuery");
        }
    }
    // SQLの結果 (rows) をテンプレートIDごとに分類し、条件を一つの配列にまとめ templateConditions に格納
    async transformToTemplateConditions(status_booked, status_checkin, status_checkout) {
        try {
            const rows = await this.filter_template_by_SQL(status_booked, status_checkin, status_checkout);
            const templateConditions = {};
            // (1) 各行の条件をtemplate_idごとにグループ化
            rows.forEach((row) => {
                const { template_id, content, condition_id, condition_key, operator, condition_value, priority, message_posting_time, is_force_send, } = row;
                // condition_value を配列化
                const valueArray = Array.isArray(condition_value) ? condition_value : [condition_value];
                // priority を number | null に
                const parsedPriority = typeof priority === "string" ? parseFloat(priority) : priority;
                const validPriority = parsedPriority !== null && !isNaN(parsedPriority) ? parsedPriority : 0;
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
                const combined = [];
                // まだ使っていない条件を一時的に保持する配列
                const unused = [];
                // trouble_genre / trouble_user を探し出して組み合わせるための一時マップ
                const troubleGenreStore = {};
                const troubleUserStore = {};
                for (const cond of condArray) {
                    if (cond.key === "trouble_genre") {
                        troubleGenreStore[cond.operator] = cond;
                    }
                    else if (cond.key === "trouble_user") {
                        troubleUserStore[cond.operator] = cond;
                    }
                    else {
                        unused.push(cond);
                    }
                }
                // trouble_genre と trouble_user の両方があればまとめる
                for (const op in troubleGenreStore) {
                    if (troubleUserStore[op]) {
                        const genreValue = troubleGenreStore[op].value; // string[]
                        const userValue = troubleUserStore[op].value; // string[]
                        const combinedConditionId = troubleGenreStore[op].condition_id + "," + troubleUserStore[op].condition_id;
                        combined.push({
                            condition_id: combinedConditionId,
                            key: "trouble_genre_user",
                            operator: op,
                            value: {
                                genre: genreValue,
                                user: userValue,
                            },
                        });
                    }
                    else {
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
        }
        catch (error) {
            console.error("Error transforming SQL result to templateConditions:", error);
            throw new Error("Failed to transform data");
        }
    }
}
exports.SQL = SQL;
class FilterTemplateByCode {
    constructor() {
        this.status_review = false;
        this.days_from_review = null;
        this.days_from_booking = 0;
        this.days_from_checkin = 0;
        this.days_from_checkout = 0;
        this.trouble_genre_user = [];
        this.cleaning_delay = false;
        this.listing_id = '';
        this.nationality = [];
        this.confirmation_code = '';
        this.status_booked = false;
        this.status_checkin = false;
        this.status_checkout = false;
        this.days_from_precheckin = null;
        this.status_precheckin = false;
    }
    // data_dictの値を条件のリストに変換する
    transformDataToConditions(data_dict) {
        const conditions = [];
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
                                genre: value.genre.map((g) => String(g)),
                                user: value.user.map((u) => String(u))
                            }
                        ]
                    });
                }
                else {
                    // 想定外のオブジェクト形式なら、JSON.stringifyなどにする
                    conditions.push({
                        key,
                        operator: "==",
                        value: [JSON.stringify(value)]
                    });
                }
            }
            // 3) 配列（他のキー例: nationalityなど）
            else if (Array.isArray(value)) {
                conditions.push({
                    key,
                    operator: "==",
                    value: value.map((v) => String(v))
                });
            }
            // 4) boolean, number, string
            else if (typeof value === "boolean" || typeof value === "number" || typeof value === "string") {
                conditions.push({
                    key,
                    operator: "==",
                    value: [String(value)]
                });
            }
        }
        console.log("Final conditions:", JSON.stringify(conditions, null, 2));
        return conditions;
    }
    compareTroubleGenreUser(guest, condition, operator) {
        console.log("=== compareTroubleGenreUser START ===");
        // ゲストの trouble_genre_user を順番に見る
        for (const guestItem of guest.value) { // guest.value に変更
            console.log("Guest Item: ", guestItem); // guestItemの内容を確認
            // genre と user が配列かを確認し、undefined または null の場合は空配列にする
            if (!guestItem.genre || !Array.isArray(guestItem.genre)) {
                console.log("guestItem.genre is invalid, setting to empty array");
                guestItem.genre = []; // 空の配列にする
            }
            if (!guestItem.user || !Array.isArray(guestItem.user)) {
                console.log("guestItem.user is invalid, setting to empty array");
                guestItem.user = []; // 空の配列にする
            }
            // ペアとみなす要素数
            const pairLength = Math.min(guestItem.genre.length, guestItem.user.length);
            console.log("GuestItem =>", guestItem, ", pairLength:", pairLength);
            for (let i = 0; i < pairLength; i++) {
                const guestGenre = guestItem.genre[i];
                const guestUser = guestItem.user[i];
                console.log(`Check pair (genre=${guestGenre}, user=${guestUser}) against template...`);
                // テンプレート側
                for (const condItem of condition.trouble_genre_user) {
                    // genre と user が配列かを確認し、undefined または null の場合は空配列にする
                    if (!condItem.genre || !Array.isArray(condItem.genre)) {
                        condItem.genre = []; // 空の配列にする
                    }
                    if (!condItem.user || !Array.isArray(condItem.user)) {
                        condItem.user = []; // 空の配列にする
                    }
                    const genreMatch = condItem.genre.includes(guestGenre);
                    const userMatch = condItem.user.includes(guestUser);
                    if (genreMatch && userMatch) {
                        console.log("=> Found a match!");
                        if (operator === "==") {
                            console.log("=> Returning TRUE");
                            return true;
                        }
                        else if (operator === "!=") {
                            console.log("=> Returning FALSE (!= operator)");
                            return false;
                        }
                    }
                }
            }
        }
        // 最後まで見つからなかった場合
        if (operator === "==") {
            console.log("No match found => returning FALSE");
            return false;
        }
        else {
            console.log("No match found => returning TRUE (because !=)");
            return true;
        }
    }
    // 比較のメインメソッド
    compareConditions(guestInformation, // GuestInfo 型を使用
    templateConditions) {
        const templateResults = [];
        console.log("===== compareConditionsUnified 開始 =====");
        //東京時刻を取得してyyyy-mm-ddを作成
        const nowTokyo = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Tokyo" }));
        const year = nowTokyo.getFullYear();
        const month = String(nowTokyo.getMonth() + 1).padStart(2, "0");
        const day = String(nowTokyo.getDate()).padStart(2, "0");
        guestInformation.forEach(guest => {
            var _a, _b;
            console.log("Checking guest:", JSON.stringify(guest, null, 2));
            let allConditionsMatch = true;
            for (const templateId in templateConditions) {
                const template = templateConditions[templateId];
                // 通常の条件チェック
                for (const condition of template.conditions) {
                    if (condition.key === "trouble_genre_user") {
                        console.log(`Skipping condition ${condition.key} in normal logic`);
                        continue;
                    }
                    const matchingCondition = guestInformation.find(guest => {
                        const guestValueArray = Array.isArray(guest.value) ? guest.value : [guest.value];
                        const conditionValueArray = Array.isArray(condition.value) ? condition.value : [condition.value];
                        if (condition.operator === "==") {
                            return (guest.key === condition.key &&
                                guest.operator === condition.operator &&
                                guestValueArray.some((val) => conditionValueArray.includes(val)));
                        }
                        else if (condition.operator === "!=") {
                            return (guest.key === condition.key &&
                                guest.operator === condition.operator &&
                                !guestValueArray.some((val) => conditionValueArray.includes(val)));
                        }
                        return false;
                    });
                    if (!matchingCondition) {
                        allConditionsMatch = false;
                        break;
                    }
                }
                const troubleGenreUserCondition = template.conditions.find(c => c.key === "trouble_genre_user");
                if (troubleGenreUserCondition) {
                    if (allConditionsMatch) {
                        const operator = troubleGenreUserCondition.operator;
                        const guestTrouble = (_a = guest.value) === null || _a === void 0 ? void 0 : _a.find((val) => val.genre && val.user);
                        console.log("guestTrouble:", guestTrouble);
                        // 見つからなかったり、genre/userが無効なら不一致扱い
                        if (!guestTrouble || !guestTrouble.genre || !guestTrouble.user) {
                            console.log("=> guestTrouble is invalid => unmatched");
                            allConditionsMatch = false;
                        }
                        else {
                            const guestTroubleWrapped = [guestTrouble];
                            // これで { value: guestTroubleWrapped } が { value: [ { genre:..., user:... } ] } になる
                            // テンプレート側の "conditionValue" も単体かもしれないので配列に包む
                            const conditionValue = troubleGenreUserCondition.value;
                            const conditionTroubleArray = Array.isArray(conditionValue)
                                ? conditionValue
                                : [conditionValue];
                            // 最終的に compareTroubleGenreUser に「{ value: [ { genre, user } ] }」を渡す
                            const isMatch = this.compareTroubleGenreUser({ value: guestTroubleWrapped }, // ← 修正： 単体オブジェクトを配列に包む形
                            { trouble_genre_user: conditionTroubleArray }, operator);
                            if (!isMatch) {
                                console.log("=> trouble_genre_user was not matched => set allConditionsMatch = false");
                                allConditionsMatch = false;
                            }
                            else {
                                console.log("=> trouble_genre_user matched => keep allConditionsMatch = true");
                            }
                        }
                    }
                    else {
                        console.log("=> Already allConditionsMatch = false; skipping trouble_genre_user check");
                    }
                }
                // 最後の処理
                if (allConditionsMatch) {
                    const messagePostingDateTime = template.message_posting_time
                        ? `${year}-${month}-${day} ${template.message_posting_time}`
                        : null;
                    templateResults.push({
                        template_id: templateId,
                        message: template.content,
                        priority: (_b = template.priority) !== null && _b !== void 0 ? _b : null,
                        message_posting_time: messagePostingDateTime,
                        is_force_send: template.is_force_send
                    });
                }
            }
        });
        console.log("===== compareConditionsUnified 終了 =====");
        return templateResults;
    }
}
exports.FilterTemplateByCode = FilterTemplateByCode;
