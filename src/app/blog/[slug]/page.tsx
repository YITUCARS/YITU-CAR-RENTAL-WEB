'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import ManageBookingModal from '@/components/ui/ManageBookingModal'
import { Calendar, Clock, ArrowLeft, Tag } from 'lucide-react'
import Link from 'next/link'
import BLOG_POSTS_DATA from '@/data/blog-posts.json'

interface BlogPost {
  id?: string
  slug: string
  title: string
  excerpt: string
  category: string
  date: string
  read_time?: string
  readTime?: string
  image_url?: string
  image?: string
  content?: string
  featured?: boolean
}

const CATEGORY_COLORS: Record<string, string> = {
  'Travel Guide': 'bg-sky-50 text-sky-700',
  'Driving Tips': 'bg-orange/10 text-orange',
  'Car Tips': 'bg-green-50 text-green-700',
}

function getImage(post: BlogPost) { return post.image_url || post.image || '' }
function getReadTime(post: BlogPost) { return post.read_time || post.readTime || '' }

export default function BlogPostPage() {
  const { slug } = useParams<{ slug: string }>()
  const [modalOpen, setModalOpen] = useState(false)
  const [post, setPost] = useState<BlogPost | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    if (!slug) return
    fetch(`/api/public/blog?slug=${encodeURIComponent(slug)}`)
      .then(r => r.json())
      .then((data: BlogPost | null) => {
        if (data && data.slug) {
          setPost(data)
        } else {
          // Fall back to static JSON
          const staticPost = (BLOG_POSTS_DATA as BlogPost[]).find(p => p.slug === slug)
          if (staticPost) setPost(staticPost)
          else setNotFound(true)
        }
      })
      .catch(() => {
        const staticPost = (BLOG_POSTS_DATA as BlogPost[]).find(p => p.slug === slug)
        if (staticPost) setPost(staticPost)
        else setNotFound(true)
      })
      .finally(() => setLoading(false))
  }, [slug])

  return (
    <>
      <Navbar onManageBooking={() => setModalOpen(true)} />
      <ManageBookingModal open={modalOpen} onClose={() => setModalOpen(false)} />

      <main className="pt-[120px] pb-24">
        {loading && (
          <div className="max-w-[780px] mx-auto px-6 lg:px-10 animate-pulse space-y-6 mt-10">
            <div className="h-4 bg-gray-100 rounded w-1/4" />
            <div className="h-8 bg-gray-100 rounded w-3/4" />
            <div className="h-64 bg-gray-100 rounded-2xl" />
            <div className="space-y-3">
              {[1,2,3,4].map(i => <div key={i} className="h-4 bg-gray-100 rounded" />)}
            </div>
          </div>
        )}

        {!loading && notFound && (
          <div className="max-w-[780px] mx-auto px-6 lg:px-10 text-center py-32">
            <h1 className="font-syne font-extrabold text-navy text-3xl mb-4">Post not found</h1>
            <p className="text-muted mb-8">This article doesn't exist or has been removed.</p>
            <Link href="/blog" className="inline-flex items-center gap-2 text-orange font-bold hover:underline">
              <ArrowLeft size={14} /> Back to Blog
            </Link>
          </div>
        )}

        {!loading && post && (
          <>
            {/* Hero image */}
            {getImage(post) && (
              <div className="max-w-[1100px] mx-auto px-6 lg:px-10 mb-10">
                <div className="rounded-[28px] overflow-hidden h-[320px] md:h-[440px]">
                  <img
                    src={getImage(post)}
                    alt={post.title}
                    className="w-full h-full object-cover"
                  />
                </div>
              </div>
            )}

            <div className="max-w-[780px] mx-auto px-6 lg:px-10">
              {/* Back link */}
              <Link href="/blog" className="inline-flex items-center gap-1.5 text-[13px] text-muted hover:text-orange transition-colors mb-6">
                <ArrowLeft size={14} /> All Articles
              </Link>

              {/* Meta */}
              <div className="flex flex-wrap items-center gap-3 mb-5">
                <span className={`text-[10px] font-bold uppercase tracking-[0.14em] px-2.5 py-1 rounded-full ${CATEGORY_COLORS[post.category] || 'bg-gray-100 text-gray-600'}`}>
                  <Tag size={10} className="inline mr-1" />{post.category}
                </span>
                {post.featured && (
                  <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-white bg-orange px-3 py-1 rounded-full">
                    Featured
                  </span>
                )}
              </div>

              <h1 className="font-syne font-extrabold text-navy text-3xl md:text-4xl leading-tight mb-4">
                {post.title}
              </h1>

              <div className="flex items-center gap-5 text-[12px] text-muted mb-8 pb-8 border-b border-black/[0.07]">
                <span className="flex items-center gap-1.5">
                  <Calendar size={13} className="text-orange" /> {post.date}
                </span>
                <span className="flex items-center gap-1.5">
                  <Clock size={13} className="text-orange" /> {getReadTime(post)}
                </span>
              </div>

              {/* Excerpt as lead */}
              <p className="text-[16px] text-navy/80 leading-relaxed mb-8 font-medium">
                {post.excerpt}
              </p>

              {/* Full content */}
              {post.content ? (
                <div
                  className="prose prose-navy max-w-none text-[15px] leading-relaxed text-muted [&_h2]:font-syne [&_h2]:font-extrabold [&_h2]:text-navy [&_h2]:text-xl [&_h2]:mt-10 [&_h2]:mb-4 [&_h3]:font-syne [&_h3]:font-bold [&_h3]:text-navy [&_h3]:mt-8 [&_h3]:mb-3 [&_p]:mb-4 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:mb-4 [&_li]:mb-1 [&_a]:text-orange [&_a]:underline [&_strong]:text-navy [&_strong]:font-semibold"
                  dangerouslySetInnerHTML={{ __html: post.content }}
                />
              ) : (
                <p className="text-muted text-[14px] italic">Full article coming soon.</p>
              )}

              {/* Back CTA */}
              <div className="mt-14 pt-8 border-t border-black/[0.07]">
                <Link
                  href="/blog"
                  className="inline-flex items-center gap-2 text-[13px] font-bold text-orange hover:text-orange-dark transition-colors"
                >
                  <ArrowLeft size={14} /> Back to all articles
                </Link>
              </div>
            </div>
          </>
        )}
      </main>

      <Footer onManageBooking={() => setModalOpen(true)} />
    </>
  )
}
