'use client';

import { useState } from 'react';
import { Share2, Facebook, Twitter, Linkedin, MessageCircle, Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface SocialShareButtonsProps {
  url: string;
  title: string;
  description: string;
  variant?: 'vertical' | 'horizontal';
}

export function SocialShareButtons({ 
  url, 
  title, 
  description, 
  variant = 'vertical' 
}: SocialShareButtonsProps) {
  const [copied, setCopied] = useState(false);

  const encodedUrl = encodeURIComponent(url);
  const encodedTitle = encodeURIComponent(title);
  const encodedDescription = encodeURIComponent(description);

  const shareLinks = {
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
    twitter: `https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedTitle}`,
    linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`,
    whatsapp: `https://wa.me/?text=${encodedTitle}%20${encodedUrl}`,
  };

  const handleShare = (platform: keyof typeof shareLinks) => {
    const shareUrl = shareLinks[platform];
    window.open(shareUrl, '_blank', 'width=600,height=400');
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy link:', err);
    }
  };

  const containerClass = variant === 'horizontal' 
    ? 'flex items-center gap-2' 
    : 'flex flex-col gap-2';

  return (
    <div className={containerClass}>
      <Button
        onClick={() => handleShare('facebook')}
        variant="outline"
        size="sm"
        className="flex items-center gap-2"
        aria-label="Share on Facebook"
      >
        <Facebook className="w-4 h-4" />
        {variant === 'horizontal' && <span className="hidden sm:inline">Facebook</span>}
      </Button>

      <Button
        onClick={() => handleShare('twitter')}
        variant="outline"
        size="sm"
        className="flex items-center gap-2"
        aria-label="Share on Twitter"
      >
        <Twitter className="w-4 h-4" />
        {variant === 'horizontal' && <span className="hidden sm:inline">Twitter</span>}
      </Button>

      <Button
        onClick={() => handleShare('linkedin')}
        variant="outline"
        size="sm"
        className="flex items-center gap-2"
        aria-label="Share on LinkedIn"
      >
        <Linkedin className="w-4 h-4" />
        {variant === 'horizontal' && <span className="hidden sm:inline">LinkedIn</span>}
      </Button>

      <Button
        onClick={() => handleShare('whatsapp')}
        variant="outline"
        size="sm"
        className="flex items-center gap-2"
        aria-label="Share on WhatsApp"
      >
        <MessageCircle className="w-4 h-4" />
        {variant === 'horizontal' && <span className="hidden sm:inline">WhatsApp</span>}
      </Button>

      <Button
        onClick={handleCopyLink}
        variant="outline"
        size="sm"
        className="flex items-center gap-2"
        aria-label="Copy link"
      >
        {copied ? (
          <>
            <Check className="w-4 h-4 text-green-600" />
            {variant === 'horizontal' && <span className="hidden sm:inline">Copied!</span>}
          </>
        ) : (
          <>
            <Copy className="w-4 h-4" />
            {variant === 'horizontal' && <span className="hidden sm:inline">Copy Link</span>}
          </>
        )}
      </Button>
    </div>
  );
}
