'use client';

import { motion } from 'framer-motion';

type SpecializationDetailSectionProps = {
  children: React.ReactNode;
  delay?: number;
  className?: string;
};

export function SpecializationDetailSection({
  children,
  delay = 0,
  className = '',
}: SpecializationDetailSectionProps) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay }}
      className={className}
    >
      {children}
    </motion.section>
  );
}
