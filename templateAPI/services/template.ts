export class SQL {
  status_booked: boolean = false;
  status_checkin: boolean = false;
  status_checkout: boolean = false;
  table_name: string = ''; 
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