import createMiddleware from 'next-intl/middleware'
import {routing} from './src/i18n/routing'

export default createMiddleware(routing)

export const config = {
  // /h5 pages are Chinese-only mobile pages shared in WeChat, outside the locale routes.
  matcher: ['/((?!api|admin|h5|_next|_vercel|.*\\..*).*)'],
}
