# YITU Partner API

The first API package exposes the safe read/search layer for approved distributors.

## Authentication

Send the issued key in either header:

```http
x-api-key: YOUR_PARTNER_API_KEY
```

Keys are configured server-side in `PARTNER_API_KEYS` as a comma-separated list. Do not put RCM, Stripe, Supabase, or Telegram credentials in a partner application.

## Endpoints

`GET /api/v1/partner/vehicles` returns the locally cached vehicle catalogue.

`POST /api/v1/partner/search` returns live availability, local pricing, cached images, and RCM fallback data. Required JSON fields are `pickupLocation`, `dropoffLocation`, `pickupDate`, and `dropoffDate`. Optional fields are `pickupTime`, `dropoffTime`, and `promoCode`.

OpenAPI JSON is available at `GET /api/v1/partner/openapi`.

Swagger-compatible JSON is also available at `GET /api/v1/partner/swagger.json`. The downloadable YAML definition is `docs/partner-api.yaml`; import it into Swagger UI, Postman, or Insomnia.

Booking creation and cancellation should be added only after a partner-specific permission and idempotency policy are agreed. The current internal booking endpoints are intentionally not exposed by this package.
