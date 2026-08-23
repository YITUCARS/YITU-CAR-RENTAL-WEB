/**
 * Shapes exposed by the Rental Car Manager (RCM) v3.2 booking engine on its
 * own public results page. These are RCM's field names, kept verbatim so the
 * mapping to our model is auditable against a real page dump.
 */

export interface RcmAvailableCar {
  vehiclecategorytypeid: number;
  vehiclecategoryid: number;
  available: number;
  availablemessage: string;
  errorcode: number;
  minimumage: number;
  maximumage: number;
  vehiclecategory: string;
  categoryfriendlydescription: string;
  numberofdays: number;
  numberofhours: string | number;
  hourlyrate: number;
  avgrate: number;
  totalratebeforediscount: number;
  discounteddailyrate: number;
  totalrateafterdiscount: number;
  totaldiscountamount: number;
  discountname: string;
  discounttype: string;
  imageurl: string;
  numberofadults: number;
  numberofchildren: number;
  numberoflargecases: number;
  numberofsmallcases: number;
  sippcode: string;
  numbervehiclesavailable?: number;
  vehiclesbookedpercent?: number;
  offerdescription?: string;
  [key: string]: unknown;
}

/** Despite the name, this array carries pickup/dropoff confirmation, not fees. */
export interface RcmLocationInfo {
  loctype: 'pickup' | 'dropoff' | string;
  locationid: number;
  location: string;
  locdate: string; // '01 Sep 2026'
  loctime: string; // '10:00'
  currencyname: string;
  currencysymbol: string;
  isavailable: boolean;
  [key: string]: unknown;
}

export interface RcmCategoryType {
  id: number;
  vehiclecategorytype: string;
  displayorder: string;
}

export interface RcmSeasonalRate {
  vehiclecategoryid: number;
  season: string;
  rateperiod: string;
  numberofdays: number;
  dailyratebeforediscount: number;
  dailyrateafterdiscount: number;
  ratesubtotal: number;
  [key: string]: unknown;
}

/** Everything we lift off one results page in a single evaluate() call. */
export interface RcmPageState {
  url: string;
  cars: RcmAvailableCar[];
  locations: RcmLocationInfo[];
  categoryTypes: RcmCategoryType[];
  seasonalRates: RcmSeasonalRate[];
  insuranceOptions: Array<Record<string, unknown>>;
  taxInclusive: boolean;
  errorMessage: string;
}
