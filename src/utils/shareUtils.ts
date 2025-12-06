/**
 * Utility functions for sharing content
 * Handles Web Share API with proper fallbacks
 */

import { toast } from 'sonner@2.0.3';

interface ShareData {
  title?: string;
  text?: string;
  url?: string;
}

/**
 * Share content using Web Share API with fallback to clipboard
 * @param data - Share data (title, text, url)
 * @returns Promise<boolean> - true if shared successfully, false if cancelled or failed
 */
export async function shareContent(data: ShareData): Promise<boolean> {
  try {
    // Check if Web Share API is available and the data can be shared
    if (
      typeof navigator !== 'undefined' &&
      navigator.share &&
      typeof navigator.canShare === 'function'
    ) {
      // Try to share if canShare returns true
      try {
        if (navigator.canShare(data)) {
          await navigator.share(data);
          return true;
        }
      } catch (canShareError) {
        // canShare might throw, fall through to clipboard fallback
        console.log('canShare check failed, falling back to clipboard');
      }
    }

    // Fallback: Copy to clipboard
    return await copyToClipboard(data);
  } catch (error: any) {
    // Handle user cancellation (not an error)
    if (error.name === 'AbortError') {
      console.log('User cancelled share');
      return false;
    }

    // Handle permission errors
    if (error.name === 'NotAllowedError') {
      console.log('Share permission denied, falling back to clipboard');
      return await copyToClipboard(data);
    }

    // Other errors - fall back to clipboard
    console.error('Share error:', error);
    return await copyToClipboard(data);
  }
}

/**
 * Copy content to clipboard as fallback
 * @param data - Share data
 * @returns Promise<boolean> - true if copied successfully
 */
async function copyToClipboard(data: ShareData): Promise<boolean> {
  try {
    // Build the text to copy
    let textToCopy = '';
    
    if (data.title) {
      textToCopy += `${data.title}\n`;
    }
    
    if (data.text) {
      textToCopy += `${data.text}\n`;
    }
    
    if (data.url) {
      textToCopy += data.url;
    }

    // Use Clipboard API if available
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(textToCopy.trim());
      toast.success('Copied to clipboard!');
      return true;
    }

    // Fallback: Use old-school method
    const textarea = document.createElement('textarea');
    textarea.value = textToCopy.trim();
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    
    const success = document.execCommand('copy');
    document.body.removeChild(textarea);
    
    if (success) {
      toast.success('Copied to clipboard!');
      return true;
    } else {
      toast.error('Could not copy to clipboard');
      return false;
    }
  } catch (error) {
    console.error('Clipboard error:', error);
    toast.error('Could not copy to clipboard');
    return false;
  }
}

/**
 * Check if sharing is supported on this device
 * @returns boolean
 */
export function isShareSupported(): boolean {
  return typeof navigator !== 'undefined' && 
         typeof navigator.share === 'function';
}

/**
 * Check if clipboard is supported
 * @returns boolean
 */
export function isClipboardSupported(): boolean {
  return typeof navigator !== 'undefined' && 
         typeof navigator.clipboard?.writeText === 'function';
}
