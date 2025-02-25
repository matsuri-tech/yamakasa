import { FilterTemplateByCode} from '../services/template';
const data = {
    listing_id: "81f63d83-a07b-4b9a-90d7-7059fb791227",  
    nationality: ["Japan"],
    confirmation_code: "ABC123",
    today_date: "2025-02-18",
    booked_date: "2025-01-10",
    checkin_date: "2025-02-15",
    checkout_date: "2025-02-20",
    days_from_book: 0,
    days_from_checkin: 0,
    days_from_checkout: 0,
    status_booked: true,
    status_checkin: false,
    status_checkout: false,
    status_precheckin: true,
    days_from_precheckin: 1,
    status_review: false,
    days_from_review: null,
    cleaning_delay: true,
    guest_review_submitted_at: null,
    trouble_genre_user:[
        { "user": "あ", "genre": "A" },
        { "user": "い", "genre": "B" }
    ]
  };
  
  // 3. 実行して結果を表示
  function main() {
    const filterInstance = new FilterTemplateByCode();
    const conditions = filterInstance.transformDataToConditions(data);
    console.log("Transformed Conditions:", JSON.stringify(conditions, null, 2));
  }
  
  main();