'use client';

import { ArrowLeft } from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { CachedImage } from '@/components/shared/CachedImage';
import type { VetVisualVariant } from '@/lib/specialization-detail';
import { vetVariantClasses } from './vet-variant-styles';

type VetHeroCardProps = {
  title: string;
  description: string;
  heroImage: string;
  heroImagePosition?: string;
  variant?: VetVisualVariant;
  onBack: () => void;
  icon?: React.ReactNode;
};

export function VetHeroCard({
  title,
  description,
  heroImage,
  heroImagePosition,
  variant = 'default',
  onBack,
  icon,
}: VetHeroCardProps) {
  const styles = vetVariantClasses(variant);
  const isEmergency = variant === 'emergency';

  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: isEmergency ? 0.2 : 0.35 }}
      className={`overflow-hidden rounded-[24px] border ${styles.heroBorder} bg-white ${styles.heroShadow}`}
    >
      <div className="relative h-48 sm:h-56">
        <CachedImage
          src={heroImage}
          alt=""
          fill
          className="object-cover"
          style={
            heroImagePosition
              ? { objectFit: 'cover', objectPosition: heroImagePosition }
              : undefined
          }
          sizes="(max-width: 640px) 100vw, 480px"
          loading="eager"
        />
        <div
          className={`absolute inset-0 ${
            isEmergency
              ? 'bg-gradient-to-t from-red-950/70 via-red-900/25 to-red-900/10'
              : variant === 'palliative'
                ? 'bg-gradient-to-t from-stone-900/55 via-stone-800/15 to-transparent'
                : 'bg-gradient-to-t from-black/55 via-black/15 to-transparent'
          }`}
        />
        <Button
          variant="ghost"
          size="sm"
          onClick={onBack}
          className="absolute left-3 top-3 z-10 h-11 min-h-[44px] min-w-[44px] rounded-2xl bg-white/90 p-0 text-gray-900 shadow-md backdrop-blur-sm hover:bg-white touch-manipulation"
          aria-label="Go back"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        {icon ? (
          <div className="absolute right-4 top-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-white/90 text-2xl shadow-md backdrop-blur-sm">
            {icon}
          </div>
        ) : null}
        <div className="absolute bottom-0 left-0 right-0 p-5">
          <h1 className="text-2xl font-bold tracking-tight text-white drop-shadow-sm">{title}</h1>
        </div>
      </div>

      <div className="p-5">
        <p className="text-[15px] leading-relaxed text-slate-600">{description}</p>
      </div>
    </motion.section>
  );
}
