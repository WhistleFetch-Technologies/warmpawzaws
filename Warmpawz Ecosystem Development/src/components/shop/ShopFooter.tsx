import React from 'react';
import { Facebook, Twitter, Instagram, Mail, Phone, MapPin } from 'lucide-react';
import { Separator } from '../ui/separator';
import { Link } from 'react-router-dom';

export function ShopFooter() {
  return (
    <footer className="bg-white dark:bg-neutral-900 border-t pt-12 pb-6">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
          {/* Brand Column */}
          <div className="space-y-4">
            <h3 className="text-xl font-bold text-primary">Warmpawz</h3>
            <p className="text-sm text-muted-foreground">
              India's favorite destination for pet parents. We provide everything your furry friend needs, delivered with love.
            </p>
            <div className="flex space-x-4">
              <a href="#" className="text-muted-foreground hover:text-primary transition-colors"><Facebook className="h-5 w-5" /></a>
              <a href="#" className="text-muted-foreground hover:text-primary transition-colors"><Twitter className="h-5 w-5" /></a>
              <a href="#" className="text-muted-foreground hover:text-primary transition-colors"><Instagram className="h-5 w-5" /></a>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="font-semibold mb-4">Shop</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><Link to="/shop?category=food" className="hover:text-primary">Food & Treats</Link></li>
              <li><Link to="/shop?category=toys" className="hover:text-primary">Toys</Link></li>
              <li><Link to="/shop?category=accessories" className="hover:text-primary">Accessories</Link></li>
              <li><Link to="/shop?category=health" className="hover:text-primary">Healthcare</Link></li>
              <li><Link to="/shop?deals=true" className="hover:text-primary">Flash Sales</Link></li>
            </ul>
          </div>

          {/* Customer Service */}
          <div>
            <h4 className="font-semibold mb-4">Customer Care</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><Link to="/track-order" className="hover:text-primary">Track Order</Link></li>
              <li><Link to="/returns" className="hover:text-primary">Returns & Refunds</Link></li>
              <li><Link to="/shipping-policy" className="hover:text-primary">Shipping Policy</Link></li>
              <li><Link to="/help" className="hover:text-primary">Help Center</Link></li>
              <li><Link to="/contact" className="hover:text-primary">Contact Us</Link></li>
            </ul>
          </div>

          {/* Contact Info */}
          <div>
            <h4 className="font-semibold mb-4">Contact Us</h4>
            <ul className="space-y-3 text-sm text-muted-foreground">
              <li className="flex items-center gap-2">
                <MapPin className="h-4 w-4 shrink-0" />
                <span>123 Pet Street, Indiranagar,<br/>Bangalore 560038</span>
              </li>
              <li className="flex items-center gap-2">
                <Phone className="h-4 w-4 shrink-0" />
                <span>+91 98765 43210</span>
              </li>
              <li className="flex items-center gap-2">
                <Mail className="h-4 w-4 shrink-0" />
                <span>support@warmpawz.com</span>
              </li>
            </ul>
          </div>
        </div>

        <Separator className="my-8" />

        <div className="flex flex-col md:flex-row justify-between items-center gap-4 text-xs text-muted-foreground">
          <p>© 2025 Warmpawz. All rights reserved.</p>
          <div className="flex gap-6">
            <Link to="/privacy" className="hover:text-primary">Privacy Policy</Link>
            <Link to="/terms" className="hover:text-primary">Terms of Service</Link>
            <Link to="/sitemap" className="hover:text-primary">Sitemap</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
