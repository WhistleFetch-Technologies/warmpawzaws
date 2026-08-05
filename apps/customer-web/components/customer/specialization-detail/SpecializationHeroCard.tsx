'use client';

import { motion } from 'framer-motion';
import { CachedImage } from '@/components/shared/CachedImage';
import type { SpecializationDetailContent } from '@/lib/specialization-detail';

type SpecializationHeroCardProps = {
  content: Pick<SpecializationDetailContent, 'title' | 'description' | 'heroImage'>;
  icon?: React.ReactNode;
};

export function SpecializationHeroCard({ content, icon }: SpecializationHeroCardProps) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="overflow-hidden rounded-[24px] border border-orange-100/80 bg-white shadow-[0_8px_32px_rgba(255,140,66,0.08)]"
    >
      <div className="relative h-44 sm:h-52">
        <CachedImage
          src={content.heroImage}
          alt=""
          fill
          className="object-cover"
          sizes="(max-width: 640px) 100vw, 480px"
          loading="eager"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/15 to-transparent" />
        {icon ? (
          <div className="absolute right-4 top-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-white/90 text-2xl shadow-md backdrop-blur-sm">
            {icon}
          </div>
        ) : null}
        <div className="absolute bottom-0 left-0 right-0 p-5">
          <h1 className="text-2xl font-bold tracking-tight text-white drop-shadow-sm">{content.title}</h1>
        </div>
      </div>

      <div className="p-5">
        <p className="text-[15px] leading-relaxed text-slate-600">{content.description}</p>
      </div>
    </motion.section>
  );
}
