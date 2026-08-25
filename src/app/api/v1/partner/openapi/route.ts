import { NextResponse } from 'next/server'

export const dynamic = 'force-static'

export async function GET() {
  return NextResponse.json({
    openapi: '3.0.3',
    info: { title: 'YITU Partner API', version: '1.0.0', description: 'Vehicle search and catalogue API for approved distribution partners.' },
    servers: [{ url: 'https://www.yiturentalcars.co.nz/api/v1/partner' }],
    security: [{ ApiKeyAuth: [] }],
    components: { securitySchemes: { ApiKeyAuth: { type: 'apiKey', in: 'header', name: 'x-api-key' } } },
    paths: {
      '/vehicles': { get: { summary: 'Get cached vehicle catalogue', responses: { '200': { description: 'Vehicle catalogue' }, '401': { description: 'Invalid API key' } } } },
      '/search': { post: { summary: 'Search live availability and local prices', requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['pickupLocation', 'dropoffLocation', 'pickupDate', 'dropoffDate'], properties: { pickupLocation: { type: 'string', example: 'Christchurch' }, dropoffLocation: { type: 'string', example: 'Queenstown' }, pickupDate: { type: 'string', format: 'date' }, dropoffDate: { type: 'string', format: 'date' }, pickupTime: { type: 'string', example: '10:00' }, dropoffTime: { type: 'string', example: '10:00' }, promoCode: { type: 'string' } } } } } }, responses: { '200': { description: 'Available vehicles' }, '400': { description: 'Missing fields' }, '401': { description: 'Invalid API key' } } } },
    },
  })
}
