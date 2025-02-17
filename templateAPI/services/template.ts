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
          SELECT * FROM 
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
}


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


}