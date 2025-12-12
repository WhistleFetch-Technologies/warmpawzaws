import React from 'react';
import { Link } from 'react-router-dom';
import { Search, ShoppingCart, Heart, User, Menu, MapPin } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetHeader,
  SheetTitle,
} from "../ui/sheet";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuLabel, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from "../ui/dropdown-menu";
import { Separator } from '../ui/separator';

interface ShopHeaderProps {
  onNavigate?: (path: string) => void;
}

export function ShopHeader({ onNavigate }: ShopHeaderProps = {}) {
  // Mock cart count - will be connected to store later
  const cartCount = 2;

  const handleNavigation = (path: string) => {
    if (onNavigate) {
      onNavigate(path);
    } else {
      window.location.href = path;
    }
  };

  return (
    <header className="w-full">
      {/* Top Bar - Utility Links (Like Amazon Top Nav) */}
      <div className="bg-primary text-primary-foreground px-4 py-1 text-xs flex justify-between items-center">
        <div className="flex items-center gap-2">
          <span className="hidden sm:inline">Welcome to Warmpawz</span>
          <Separator orientation="vertical" className="h-3 bg-primary-foreground/30" />
          <span className="flex items-center gap-1">
            <MapPin className="w-3 h-3" />
            Deliver to: <strong>Bangalore 560001</strong>
          </span>
        </div>
        <div className="flex gap-4">
          <Link to="/seller/register" className="hover:underline">Become a Seller</Link>
          <Link to="/help" className="hover:underline">Help Center</Link>
        </div>
      </div>

      {/* Main Header */}
      <div className="container mx-auto px-4 py-3 flex items-center gap-4 md:gap-8">
        {/* Mobile Menu */}
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="md:hidden">
              <Menu className="h-6 w-6" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left">
            <SheetHeader>
              <SheetTitle>Categories</SheetTitle>
            </SheetHeader>
            <nav className="flex flex-col gap-4 mt-4">
              <Link to="/shop" className="text-lg font-medium">All Products</Link>
              <Link to="/shop/category/food" className="text-lg text-muted-foreground">Pet Food</Link>
              <Link to="/shop/category/toys" className="text-lg text-muted-foreground">Toys & Accessories</Link>
              <Link to="/shop/category/healthcare" className="text-lg text-muted-foreground">Healthcare</Link>
              <Link to="/shop/category/grooming" className="text-lg text-muted-foreground">Grooming</Link>
            </nav>
          </SheetContent>
        </Sheet>

        {/* Logo */}
        <Link to="/shop" className="text-2xl font-bold text-primary shrink-0">
          Warmpawz<span className="text-foreground text-sm font-normal ml-1">Shop</span>
        </Link>

        {/* Search Bar (Amazon Style) */}
        <div className="flex-1 max-w-2xl hidden md:flex relative">
          <Input 
            placeholder="Search for pet food, toys, medicines..." 
            className="w-full pr-12"
          />
          <Button size="icon" className="absolute right-0 top-0 rounded-l-none">
            <Search className="h-4 w-4" />
          </Button>
        </div>

        {/* Actions Area */}
        <div className="flex items-center gap-2 sm:gap-4 shrink-0">
          {/* Mobile Search Trigger */}
          <Button variant="ghost" size="icon" className="md:hidden">
            <Search className="h-5 w-5" />
          </Button>

          {/* Wishlist */}
          <Button variant="ghost" size="icon" className="hidden sm:flex">
            <Heart className="h-5 w-5" />
          </Button>

          {/* Account Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <User className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>My Account</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => handleNavigation('/customer/profile')}>Profile</DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleNavigation('/customer/orders')}>Orders</DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleNavigation('/customer/wishlist')}>Wishlist</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-red-600">Log out</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Cart */}
          <Button onClick={() => handleNavigation('/shop/cart')} className="relative">
            <ShoppingCart className="h-5 w-5 mr-2" />
            <span className="hidden sm:inline">Cart</span>
            {cartCount > 0 && (
              <Badge 
                variant="destructive" 
                className="absolute -top-2 -right-2 h-5 w-5 flex items-center justify-center rounded-full p-0 text-xs"
              >
                {cartCount}
              </Badge>
            )}
          </Button>
        </div>
      </div>

      {/* Category Bar (Desktop) */}
      <div className="hidden md:block border-y bg-background">
        <div className="container mx-auto px-4">
          <nav className="flex items-center gap-6 py-2 text-sm font-medium text-muted-foreground overflow-x-auto scrollbar-hide">
            <Link to="/shop" className="text-primary hover:text-primary whitespace-nowrap">All Products</Link>
            <Link to="/shop?category=food" className="hover:text-primary whitespace-nowrap">Food & Treats</Link>
            <Link to="/shop?category=toys" className="hover:text-primary whitespace-nowrap">Toys</Link>
            <Link to="/shop?category=accessories" className="hover:text-primary whitespace-nowrap">Accessories</Link>
            <Link to="/shop?category=grooming" className="hover:text-primary whitespace-nowrap">Grooming Supplies</Link>
            <Link to="/shop?category=healthcare" className="hover:text-primary whitespace-nowrap">Healthcare</Link>
            <Link to="/shop?category=clothing" className="hover:text-primary whitespace-nowrap">Clothing</Link>
            <Link to="/shop?deals=true" className="text-red-600 hover:text-red-700 whitespace-nowrap">Flash Deals</Link>
          </nav>
        </div>
      </div>
    </header>
  );
}