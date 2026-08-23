/**
 * Milestone 5 lives here: the recommendation engine that combines this
 * competitor dataset with our own fleet availability, utilisation, bookings,
 * lead time and seasonal demand.
 *
 * Deliberately empty for now. The inputs it will read already exist:
 *   - market_intel.v_market_daily      market min/median/max by class and day
 *   - market_intel.v_lead_time_curve   how a pickup date reprices as it nears
 *   - market_intel.v_supplier_daily    per-competitor positioning, de-duplicated
 *                                      across OTA channels
 *
 * Nothing else in the system imports this module, so the collection pipeline
 * stays independent of whatever pricing model we end up choosing.
 */
export {};
