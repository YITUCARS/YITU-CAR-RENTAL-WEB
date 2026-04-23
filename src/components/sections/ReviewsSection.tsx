'use client'

import React from 'react'
import Image from 'next/image'
import { Star, ExternalLink } from 'lucide-react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { STATIC_REVIEWS } from '@/lib/static-reviews'

const MAPS_URL = 'https://www.google.com/maps/place/?q=place_id:ChIJJxIZZNn1MW0Rk4kIt7fYHOc'

function StarRating({ rating }: { rating: number }) {
    return (
        <div className="flex gap-0.5">
            {[1, 2, 3, 4, 5].map((i) => (
                <Star key={i} size={13} className={i <= rating ? 'text-orange fill-orange' : 'text-black/15'} />
            ))}
        </div>
    )
}

export default function ReviewsSection() {
    const t = useTranslations()
    const { rating, user_ratings_total, reviews } = STATIC_REVIEWS

    return (
        <section className="py-16 px-10 border-t border-black/10 bg-off-white">
            <div className="max-w-[1100px] mx-auto">

                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 mb-10">
                    <div>
                        <div className="flex items-center gap-2 text-[11.5px] text-orange uppercase tracking-[2.5px] font-bold mb-2.5 before:content-[''] before:w-5 before:h-0.5 before:bg-orange">
                            {t('ReviewsSection.kicker')}
                        </div>
                        <h2 className="font-montserrat font-extrabold italic text-[clamp(1.8rem,3vw,2.8rem)] text-navy leading-[1.1]">
                            {t('ReviewsSection.titlePrefix')} <span className="text-orange">{t('ReviewsSection.titleAccent')}</span> {t('ReviewsSection.titleSuffix')}
                        </h2>
                    </div>

                    {/* Overall rating badge */}
                    <Link href={MAPS_URL} target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-4 bg-white border border-black/10 rounded-card px-6 py-4 hover:border-orange transition-colors flex-shrink-0">
                        <Image
                            src="https://upload.wikimedia.org/wikipedia/commons/2/2f/Google_2015_logo.svg"
                            alt="Google" width={60} height={20} className="h-5 w-auto"
                        />
                        <div className="border-l border-black/10 pl-4">
                            <div className="font-syne font-extrabold text-[2rem] text-navy leading-none">
                                {rating.toFixed(1)}
                            </div>
                            <StarRating rating={Math.round(rating)} />
                            <div className="text-[11px] text-muted mt-1">
                                {t('ReviewsSection.reviewsCount', { count: user_ratings_total })}
                            </div>
                        </div>
                        <ExternalLink size={14} className="text-muted ml-1" />
                    </Link>
                </div>

                {/* Reviews grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {reviews.map((review, i) => (
                        <div key={i}
                             className="bg-white border border-black/10 rounded-card p-5 flex flex-col gap-4 hover:border-orange/30 hover:shadow-card transition-all">
                            <div className="flex items-center gap-3">
                                {review.profile_photo_url ? (
                                    <Image src={review.profile_photo_url} alt={review.author_name}
                                           width={40} height={40} className="w-10 h-10 rounded-full object-cover flex-shrink-0" />
                                ) : (
                                    <div className="w-10 h-10 rounded-full bg-navy flex items-center justify-center flex-shrink-0 text-white font-syne font-bold text-[15px]">
                                        {review.author_name.charAt(0)}
                                    </div>
                                )}
                                <div>
                                    <div className="font-syne font-bold text-[13.5px] text-navy leading-tight">{review.author_name}</div>
                                    <div className="text-[11px] text-muted mt-0.5">{review.relative_time_description}</div>
                                </div>
                                <div className="ml-auto flex-shrink-0">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                                        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                                        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                                        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                                        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                                    </svg>
                                </div>
                            </div>

                            <StarRating rating={review.rating} />

                            <p className="text-[13.5px] text-muted leading-[1.7] line-clamp-4 flex-1">
                                {review.text}
                            </p>
                        </div>
                    ))}
                </div>

                {/* CTA */}
                <div className="text-center mt-8">
                    <Link href={MAPS_URL} target="_blank" rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 bg-transparent border-[1.5px] border-orange text-orange font-syne font-bold text-[14px] px-8 py-3 rounded-full transition-all hover:bg-orange hover:text-white">
                        {t('ReviewsSection.viewAll')}
                        <ExternalLink size={14} />
                    </Link>
                </div>

            </div>
        </section>
    )
}
