'use client'

import { useState } from 'react'
import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import ManageBookingModal from '@/components/ui/ManageBookingModal'
import { Calendar, Clock, ArrowRight, Tag } from 'lucide-react'
import Link from 'next/link'

interface BlogPost {
  slug: string
  title: string
  excerpt: string
  category: string
  date: string
  readTime: string
  image: string
  featured?: boolean
}

const BLOG_POSTS: BlogPost[] = [
  {
    slug: 'south-island-road-trip-guide',
    title: 'The Ultimate South Island Road Trip Guide',
    excerpt: 'From Christchurch to Queenstown via the scenic Milford Sound — discover the most breathtaking drives New Zealand has to offer, with tips on timing, stops, and what to pack.',
    category: 'Travel Guide',
    date: 'April 15, 2026',
    readTime: '8 min read',
    image: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&q=80',
    featured: true,
  },
  {
    slug: 'queenstown-winter-driving-tips',
    title: 'Driving in Queenstown in Winter: What You Need to Know',
    excerpt: 'Snow chains, alpine road closures, and AWD essentials — everything to stay safe and stress-free on New Zealand\'s most dramatic winter roads.',
    category: 'Driving Tips',
    date: 'March 28, 2026',
    readTime: '6 min read',
    image: 'https://images.unsplash.com/photo-1418985991508-e47386d96a71?w=800&q=80',
  },
  {
    slug: 'auckland-day-trips-by-car',
    title: '5 Perfect Day Trips from Auckland You Can Only Do by Car',
    excerpt: 'Skip the tour buses. Rent a car and explore Waiheke Island, the Coromandel, and Cape Reinga on your own schedule — with hidden stops along the way.',
    category: 'Travel Guide',
    date: 'March 10, 2026',
    readTime: '5 min read',
    image: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800&q=80',
  },
  {
    slug: 'choosing-the-right-rental-car',
    title: 'Sedan, SUV, or MPV? How to Choose the Right Rental Car',
    excerpt: 'Travelling as a family, couple, or solo adventurer each calls for a different vehicle. Here\'s how to match your car to your trip — and avoid paying for more than you need.',
    category: 'Car Tips',
    date: 'February 20, 2026',
    readTime: '4 min read',
    image: 'https://images.unsplash.com/photo-1449965408869-eaa3f722e40d?w=800&q=80',
  },
  {
    slug: 'nz-road-rules-for-visitors',
    title: 'New Zealand Road Rules Every Visitor Should Know',
    excerpt: 'Drive on the left, give way rules, one-lane bridges — a clear guide to the rules of the road that will keep you safe and fine-free across New Zealand.',
    category: 'Driving Tips',
    date: 'February 5, 2026',
    readTime: '7 min read',
    image: 'https://images.unsplash.com/photo-1568605117036-5fe5e7bab0b7?w=800&q=80',
  },
  {
    slug: 'christchurch-hidden-gems',
    title: 'Christchurch Beyond the City: Hidden Gems Worth the Drive',
    excerpt: 'The Garden City is just the start. Head out to Akaroa, Arthur\'s Pass, or the Banks Peninsula for landscapes that most visitors never see.',
    category: 'Travel Guide',
    date: 'January 18, 2026',
    readTime: '6 min read',
    image: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&q=80',
  },
]

const CATEGORIES = ['All', 'Travel Guide', 'Driving Tips', 'Car Tips']

const CATEGORY_COLORS: Record<string, string> = {
  'Travel Guide': 'bg-sky-50 text-sky-700',
  'Driving Tips': 'bg-orange/10 text-orange',
  'Car Tips': 'bg-green-50 text-green-700',
}

export default function BlogPage() {
  const [modalOpen, setModalOpen] = useState(false)
  const [activeCategory, setActiveCategory] = useState('All')

  const featured = BLOG_POSTS.find(p => p.featured)
  const filtered = BLOG_POSTS.filter(p => {
    if (p.featured) return false
    return activeCategory === 'All' || p.category === activeCategory
  })

  return (
    <>
      <Navbar onManageBooking={() => setModalOpen(true)} />
      <ManageBookingModal open={modalOpen} onClose={() => setModalOpen(false)} />

      <main className="pt-[120px] pb-20">
        {/* Hero */}
        <div className="max-w-[1100px] mx-auto px-6 lg:px-10 mb-14">
          <div className="text-[11px] uppercase tracking-[0.22em] text-orange font-bold mb-3">
            YITU Blog
          </div>
          <h1 className="font-syne font-extrabold text-navy text-4xl md:text-5xl leading-tight mb-4">
            Travel Stories &{' '}
            <span className="text-orange">Driving Tips</span>
          </h1>
          <p className="text-muted text-[15px] max-w-xl leading-relaxed">
            Road trip guides, local driving advice, and inspiration for your next New Zealand adventure.
          </p>
        </div>

        {/* Featured Post */}
        {featured && (
          <div className="max-w-[1100px] mx-auto px-6 lg:px-10 mb-14">
            <div className="rounded-[28px] overflow-hidden bg-white border border-black/10 shadow-[0_8px_32px_rgba(15,23,42,0.08)] flex flex-col lg:flex-row">
              <div className="lg:w-[55%] flex-shrink-0 overflow-hidden">
                <img
                  src={featured.image}
                  alt={featured.title}
                  className="w-full h-64 lg:h-full object-cover"
                />
              </div>
              <div className="flex flex-col justify-center p-8 lg:p-10">
                <div className="flex items-center gap-3 mb-4">
                  <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-white bg-orange px-3 py-1 rounded-full">
                    Featured
                  </span>
                  <span className={`text-[10px] font-bold uppercase tracking-[0.14em] px-2.5 py-1 rounded-full ${CATEGORY_COLORS[featured.category] || 'bg-gray-100 text-gray-600'}`}>
                    {featured.category}
                  </span>
                </div>
                <h2 className="font-syne font-extrabold text-navy text-2xl md:text-3xl leading-snug mb-4">
                  {featured.title}
                </h2>
                <p className="text-muted text-[14px] leading-relaxed mb-6">
                  {featured.excerpt}
                </p>
                <div className="flex items-center gap-5 text-[12px] text-muted mb-7">
                  <span className="flex items-center gap-1.5">
                    <Calendar size={13} className="text-orange" />
                    {featured.date}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Clock size={13} className="text-orange" />
                    {featured.readTime}
                  </span>
                </div>
                <Link
                  href={`/blog/${featured.slug}`}
                  className="inline-flex items-center gap-2 bg-orange hover:bg-orange-dark text-white font-syne font-bold text-[13px] px-6 py-3 rounded-full transition-all hover:scale-[1.03] shadow-orange-glow self-start"
                >
                  Read Article <ArrowRight size={14} />
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* Category Filter */}
        <div className="max-w-[1100px] mx-auto px-6 lg:px-10 mb-8">
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map(cat => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`flex items-center gap-1.5 text-[12px] font-bold px-4 py-2 rounded-full border transition-all ${
                  activeCategory === cat
                    ? 'bg-navy text-white border-navy'
                    : 'border-black/10 text-muted hover:border-navy hover:text-navy'
                }`}
              >
                {cat !== 'All' && <Tag size={11} />}
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Post Grid */}
        <div className="max-w-[1100px] mx-auto px-6 lg:px-10">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.map(post => (
              <Link
                key={post.slug}
                href={`/blog/${post.slug}`}
                className="group bg-white rounded-[20px] border border-black/10 overflow-hidden hover:border-orange/30 hover:shadow-card transition-all flex flex-col"
              >
                <div className="overflow-hidden h-48">
                  <img
                    src={post.image}
                    alt={post.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                </div>
                <div className="p-6 flex flex-col flex-1">
                  <span className={`self-start text-[10px] font-bold uppercase tracking-[0.14em] px-2.5 py-1 rounded-full mb-3 ${CATEGORY_COLORS[post.category] || 'bg-gray-100 text-gray-600'}`}>
                    {post.category}
                  </span>
                  <h3 className="font-syne font-bold text-navy text-[16px] leading-snug mb-2 group-hover:text-orange transition-colors">
                    {post.title}
                  </h3>
                  <p className="text-muted text-[13px] leading-relaxed mb-4 flex-1">
                    {post.excerpt}
                  </p>
                  <div className="flex items-center gap-4 text-[11px] text-muted pt-4 border-t border-black/[0.07]">
                    <span className="flex items-center gap-1">
                      <Calendar size={11} className="text-orange" />
                      {post.date}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock size={11} className="text-orange" />
                      {post.readTime}
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>

          {filtered.length === 0 && (
            <div className="text-center py-20 text-muted">
              <p className="text-[15px]">No posts in this category yet.</p>
            </div>
          )}
        </div>
      </main>

      <Footer onManageBooking={() => setModalOpen(true)} />
    </>
  )
}
