export type SeoLandingPageKey = 'new-zealand' | 'christchurch' | 'queenstown'

export interface SeoLandingPageData {
  slug: string
  title: string
  metaTitle: string
  description: string
  kicker: string
  h1: string
  intro: string
  highlights: string[]
  locationName: string
  locationCopy: string
  routeIdeas: string[]
  fleetCopy: string
  faqs: Array<{question: string; answer: string}>
}

export const seoLandingPages: Record<SeoLandingPageKey, SeoLandingPageData> = {
  'new-zealand': {
    slug: 'new-zealand-car-rental',
    title: 'New Zealand Car Rental',
    metaTitle: 'New Zealand Car Rental & Car Hire | YITU Car Rental',
    description:
      'Book reliable New Zealand car rental with YITU. Unlimited kilometres, clean cars, SUVs and vans, plus Christchurch and Queenstown pick-up locations.',
    kicker: 'New Zealand Car Rental',
    h1: 'New Zealand Car Rental for South Island Road Trips',
    intro:
      'YITU Car Rental helps travellers book dependable car hire in New Zealand with unlimited kilometres, transparent pricing and friendly bilingual support. Our Christchurch and Queenstown locations are designed for South Island holidays, business travel and one-way self-drive routes.',
    highlights: [
      'Unlimited kilometres for scenic New Zealand drives',
      'Christchurch and Queenstown pick-up options',
      'Compact cars, SUVs, people movers and vans',
      'Local support before, during and after your rental',
    ],
    locationName: 'Christchurch and Queenstown',
    locationCopy:
      'Start from Christchurch for Canterbury, Lake Tekapo and Mount Cook, or pick up in Queenstown for Fiordland, Wanaka and Central Otago.',
    routeIdeas: [
      'Christchurch to Queenstown via Lake Tekapo',
      'Queenstown to Milford Sound day trip',
      'Christchurch, Kaikoura and the Canterbury coast',
    ],
    fleetCopy:
      'Choose from fuel-efficient city cars, comfortable SUVs, 7-seat people movers and larger vans for family or group travel.',
    faqs: [
      {
        question: 'What is included in YITU New Zealand car rental?',
        answer:
          'YITU rentals include unlimited kilometres, a clean and well-maintained vehicle, standard insurance cover and support from our local team.',
      },
      {
        question: 'Can I rent a car one way in New Zealand?',
        answer:
          'Selected one-way rentals are available between Christchurch and Queenstown, depending on vehicle availability and route rules.',
      },
      {
        question: 'Do I need an international driving permit in New Zealand?',
        answer:
          'If your licence is not in English, New Zealand visitors usually need an approved English translation or an International Driving Permit.',
      },
    ],
  },
  christchurch: {
    slug: 'christchurch-car-rental',
    title: 'Christchurch Car Rental',
    metaTitle: 'Christchurch Car Rental & Car Hire | YITU Car Rental',
    description:
      'Book Christchurch car rental with YITU. Pick up from Hornby near Christchurch Airport, with unlimited kilometres and cars, SUVs and vans for South Island travel.',
    kicker: 'Christchurch Car Rental',
    h1: 'Christchurch Car Rental Near the South Island Touring Routes',
    intro:
      'YITU offers Christchurch car rental from Hornby, a practical starting point for Christchurch Airport arrivals and South Island road trips. Book a modern rental car, SUV or people mover with unlimited kilometres and helpful local support.',
    highlights: [
      'Convenient Hornby branch in Christchurch',
      'Easy access to Lake Tekapo, Mount Cook and Queenstown routes',
      'Unlimited kilometres on every rental',
      'Vehicle options for couples, families and groups',
    ],
    locationName: 'Christchurch',
    locationCopy:
      'Our Christchurch branch is located at 222 Main South Road, Hornby, with access to SH1 and the main routes south and west.',
    routeIdeas: [
      'Christchurch to Lake Tekapo and Mount Cook',
      'Christchurch to Queenstown one-way rental',
      'Christchurch to Kaikoura coastal drive',
    ],
    fleetCopy:
      'Christchurch travellers can choose compact cars for city driving, SUVs for alpine routes and vans or people movers for family holidays.',
    faqs: [
      {
        question: 'Where can I pick up a YITU rental car in Christchurch?',
        answer:
          'YITU Car Rental operates from 222 Main South Road, Hornby, Christchurch 8042.',
      },
      {
        question: 'Is Christchurch a good place to start a New Zealand road trip?',
        answer:
          'Yes. Christchurch is one of the best South Island starting points for Lake Tekapo, Mount Cook, Queenstown, Kaikoura and the West Coast.',
      },
      {
        question: 'Can I return a Christchurch rental car in Queenstown?',
        answer:
          'Selected Christchurch to Queenstown one-way rentals are available when route and vehicle rules allow.',
      },
    ],
  },
  queenstown: {
    slug: 'queenstown-car-rental',
    title: 'Queenstown Car Rental',
    metaTitle: 'Queenstown Car Rental & Car Hire | YITU Car Rental',
    description:
      'Book Queenstown car rental with YITU. Pick up from Frankton near Queenstown Airport for Milford Sound, Wanaka and South Island road trips.',
    kicker: 'Queenstown Car Rental',
    h1: 'Queenstown Car Rental for Alpine Roads and Scenic Drives',
    intro:
      'YITU Queenstown car rental gives travellers a flexible way to explore Lake Wakatipu, Wanaka, Arrowtown, Fiordland and the wider South Island. Pick up from Frankton and choose a clean, comfortable vehicle prepared for New Zealand touring.',
    highlights: [
      'Frankton location near Queenstown Airport',
      'Great for Milford Sound, Wanaka and Arrowtown trips',
      'Unlimited kilometres for flexible sightseeing',
      'SUVs and people movers available for alpine travel',
    ],
    locationName: 'Queenstown',
    locationCopy:
      'Our Queenstown branch is at 1 Gray Street, Frankton, close to the airport area and main roads into Queenstown and Central Otago.',
    routeIdeas: [
      'Queenstown to Milford Sound',
      'Queenstown to Wanaka and Cardrona',
      'Queenstown to Christchurch one-way rental',
    ],
    fleetCopy:
      'For Queenstown, many travellers choose SUVs or people movers for luggage space, comfort and confidence on longer scenic routes.',
    faqs: [
      {
        question: 'Where is YITU Car Rental in Queenstown?',
        answer:
          'YITU Car Rental Queenstown is located at 1 Gray Street, Frankton, near the airport area.',
      },
      {
        question: 'What type of car is best for Queenstown road trips?',
        answer:
          'SUVs and larger vehicles are popular for Queenstown because they provide more luggage space and comfort for alpine sightseeing routes.',
      },
      {
        question: 'Can I book Queenstown to Christchurch one-way car hire?',
        answer:
          'Selected Queenstown to Christchurch one-way rentals may be available depending on vehicle availability and route settings.',
      },
    ],
  },
}

export const seoLandingPageList = Object.values(seoLandingPages)
