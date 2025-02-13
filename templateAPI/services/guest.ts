export class GuestAttribute {
  listing_id: string;
  nationality: string[];
  confirmation_code: string;

  constructor(listing_id: string, nationality: string[], confirmation_code: string) {
      this.listing_id = listing_id;
      this.nationality = nationality;
      this.confirmation_code = confirmation_code;
  }
}

export class GuestJourneyPhase {
  today_date: string;
  booked_date: string;
  checkin_date: string;
  checkout_date: string;
  days_from_booking: number;
  days_from_checkin: number;
  days_from_checkout: number;
  status_booked: boolean;
  status_checkin: boolean;
  status_checkout: boolean;
  confirmation_code: string;

  constructor(today_date: string, booked_date: string, checkin_date: string, checkout_date: string, confirmation_code: string) {
      this.today_date = today_date;
      this.booked_date = booked_date;
      this.checkin_date = checkin_date;
      this.checkout_date = checkout_date;
      this.days_from_booking = this.calculateDays(today_date, booked_date);
      this.days_from_checkin = this.calculateDays(today_date, checkin_date);
      this.days_from_checkout = this.calculateDays(today_date, checkout_date);
      this.status_booked = !!booked_date;
      this.status_checkin = !!checkin_date;
      this.status_checkout = !!checkout_date;
      this.confirmation_code = confirmation_code;
  }

  private calculateDays(today: string, eventDate: string): number {
      return Math.floor((new Date(today).getTime() - new Date(eventDate).getTime()) / (1000 * 60 * 60 * 24));
  }
}

export class GuestJourneyEvent {
  trouble_genre: string[];
  status_review: boolean;
  days_since_review: number;
  today_date: string;
  confirmation_code: string;

  constructor(trouble_genre: string[], status_review: boolean, days_since_review: number, today_date: string, confirmation_code: string) {
      this.trouble_genre = trouble_genre;
      this.status_review = status_review;
      this.days_since_review = days_since_review;
      this.today_date = today_date;
      this.confirmation_code = confirmation_code;
  }
}