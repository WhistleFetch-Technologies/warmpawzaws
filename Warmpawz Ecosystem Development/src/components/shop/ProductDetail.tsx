import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Star, Heart, ShoppingCart, Plus, Minus, Share2, MapPin, Truck, Shield, Award } from 'lucide-react';
import { Button } from '../ui/button';
import { authenticatedGet, authenticatedPost } from '../../utils/authenticatedFetch';
import { getApiBaseUrl } from '../../utils/api-config';

interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  originalPrice?: number;
  rating: number;
  reviewCount: number;
  images: string[];
  category: string;
  sellerId: string;
  sellerName: string;
  sellerRating: number;
  inStock: boolean;
  stockCount: number;
  tags: string[];
  specifications: { label: string; value: string }[];
  highlights: string[];
}

interface Review {
  id: string;
  customerName: string;
  rating: number;
  comment: string;
  createdAt: string;
  images?: string[];
}

export function ProductDetail() {
  const { productId } = useParams();
  const navigate = useNavigate();
  const [product, setProduct] = useState<Product | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [isInWishlist, setIsInWishlist] = useState(false);
  const [addingToCart, setAddingToCart] = useState(false);
  const [selectedTab, setSelectedTab] = useState<'details' | 'reviews' | 'seller'>('details');

  useEffect(() => {
    if (productId) {
      fetchProductDetails();
      fetchReviews();
      checkWishlist();
    }
  }, [productId]);

  const fetchProductDetails = async () => {
    try {
      setLoading(true);
      const data = await authenticatedGet(
        `${getApiBaseUrl()}/products/${productId}`,
        false
      );
      setProduct(data.product);
    } catch (error) {
      console.error('Error fetching product:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchReviews = async () => {
    try {
      const data = await authenticatedGet(
        `${getApiBaseUrl()}/products/${productId}/reviews`,
        false
      );
      setReviews(data.reviews || []);
    } catch (error) {
      console.error('Error fetching reviews:', error);
    }
  };

  const checkWishlist = async () => {
    try {
      const data = await authenticatedGet(
        `${getApiBaseUrl()}/customer/wishlist`,
        true
      );
      setIsInWishlist((data.productIds || []).includes(productId));
    } catch (error) {
      console.error('Error checking wishlist:', error);
    }
  };

  const toggleWishlist = async () => {
    try {
      await authenticatedPost(
        `${getApiBaseUrl()}/customer/wishlist/${productId}/${isInWishlist ? 'remove' : 'add'}`,
        {},
        true
      );
      setIsInWishlist(!isInWishlist);
    } catch (error) {
      console.error('Error updating wishlist:', error);
    }
  };

  const addToCart = async () => {
    try {
      setAddingToCart(true);
      await authenticatedPost(
        `${getApiBaseUrl()}/customer/cart/add`,
        {
          productId,
          quantity
        },
        true
      );
      alert('Added to cart!');
    } catch (error) {
      console.error('Error adding to cart:', error);
      alert('Failed to add to cart');
    } finally {
      setAddingToCart(false);
    }
  };

  const buyNow = async () => {
    await addToCart();
    navigate('/shop/cart');
  };

  const shareProduct = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: product?.name,
          text: product?.description,
          url: window.location.href
        });
      } catch (error) {
        console.error('Error sharing:', error);
      }
    } else {
      navigator.clipboard.writeText(window.location.href);
      alert('Link copied to clipboard!');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FF8C42]"></div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <p className="text-gray-600 mb-4">Product not found</p>
        <Button onClick={() => navigate('/shop')}>Back to Shop</Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-32">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center gap-4">
          <button
            onClick={() => navigate(-1)}
            className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-gray-100"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="flex-1 font-semibold text-gray-800 truncate">{product.name}</h1>
          <button
            onClick={shareProduct}
            className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-gray-100"
          >
            <Share2 className="w-5 h-5" />
          </button>
          <button
            onClick={toggleWishlist}
            className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-gray-100"
          >
            <Heart className={`w-5 h-5 ${isInWishlist ? 'fill-red-500 text-red-500' : 'text-gray-600'}`} />
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="grid lg:grid-cols-2 gap-8">
          {/* Left: Images */}
          <div>
            {/* Main Image */}
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden mb-4">
              <img
                src={product.images[selectedImage]}
                alt={product.name}
                className="w-full aspect-square object-cover"
              />
              {!product.inStock && (
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                  <span className="bg-red-500 text-white px-4 py-2 rounded-full">Out of Stock</span>
                </div>
              )}
            </div>

            {/* Thumbnail Images */}
            {product.images.length > 1 && (
              <div className="flex gap-2 overflow-x-auto">
                {product.images.map((image, idx) => (
                  <button
                    key={idx}
                    onClick={() => setSelectedImage(idx)}
                    className={`flex-shrink-0 w-20 h-20 border-2 rounded-lg overflow-hidden ${
                      selectedImage === idx ? 'border-[#FF8C42]' : 'border-gray-200'
                    }`}
                  >
                    <img src={image} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Right: Details */}
          <div>
            {/* Product Info */}
            <div className="bg-white border border-gray-200 rounded-xl p-6 mb-4">
              <h1 className="text-2xl font-bold text-gray-800 mb-2">{product.name}</h1>
              
              {/* Rating */}
              <div className="flex items-center gap-2 mb-4">
                <div className="flex items-center gap-1 bg-green-500 text-white px-2 py-1 rounded">
                  <span className="font-semibold">{product.rating.toFixed(1)}</span>
                  <Star className="w-4 h-4 fill-white" />
                </div>
                <span className="text-sm text-gray-600">
                  {product.reviewCount} ratings & reviews
                </span>
              </div>

              {/* Price */}
              <div className="mb-6">
                <div className="flex items-center gap-3">
                  <span className="text-3xl font-bold text-gray-800">₹{product.price}</span>
                  {product.originalPrice && product.originalPrice > product.price && (
                    <>
                      <span className="text-xl text-gray-500 line-through">₹{product.originalPrice}</span>
                      <span className="bg-green-100 text-green-700 px-2 py-1 rounded text-sm font-semibold">
                        {Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100)}% OFF
                      </span>
                    </>
                  )}
                </div>
                <p className="text-sm text-gray-600 mt-1">Inclusive of all taxes</p>
              </div>

              {/* Highlights */}
              {product.highlights && product.highlights.length > 0 && (
                <div className="mb-6">
                  <h3 className="font-semibold text-gray-800 mb-2">Product Highlights</h3>
                  <ul className="space-y-1">
                    {product.highlights.map((highlight, idx) => (
                      <li key={idx} className="text-sm text-gray-600 flex items-start gap-2">
                        <span className="text-[#FF8C42] mt-1">•</span>
                        {highlight}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Quantity Selector */}
              {product.inStock && (
                <div className="mb-6">
                  <h3 className="font-semibold text-gray-800 mb-2">Quantity</h3>
                  <div className="flex items-center gap-4">
                    <button
                      onClick={() => setQuantity(Math.max(1, quantity - 1))}
                      className="w-10 h-10 flex items-center justify-center border border-gray-300 rounded-lg hover:bg-gray-50"
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                    <span className="text-lg font-semibold">{quantity}</span>
                    <button
                      onClick={() => setQuantity(Math.min(product.stockCount, quantity + 1))}
                      className="w-10 h-10 flex items-center justify-center border border-gray-300 rounded-lg hover:bg-gray-50"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                    <span className="text-sm text-gray-600">
                      ({product.stockCount} available)
                    </span>
                  </div>
                </div>
              )}

              {/* Delivery Info */}
              <div className="grid grid-cols-3 gap-4 mb-6 p-4 bg-gray-50 rounded-lg">
                <div className="flex flex-col items-center text-center">
                  <Truck className="w-6 h-6 text-[#FF8C42] mb-1" />
                  <span className="text-xs text-gray-600">Free Delivery</span>
                </div>
                <div className="flex flex-col items-center text-center">
                  <Shield className="w-6 h-6 text-[#FF8C42] mb-1" />
                  <span className="text-xs text-gray-600">Secure Payment</span>
                </div>
                <div className="flex flex-col items-center text-center">
                  <Award className="w-6 h-6 text-[#FF8C42] mb-1" />
                  <span className="text-xs text-gray-600">Quality Assured</span>
                </div>
              </div>

              {/* Seller Info */}
              <div className="p-4 bg-gray-50 rounded-lg mb-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Sold by</p>
                    <p className="font-semibold text-gray-800">{product.sellerName}</p>
                  </div>
                  <div className="flex items-center gap-1 bg-green-500 text-white px-2 py-1 rounded">
                    <span className="text-sm font-semibold">{product.sellerRating.toFixed(1)}</span>
                    <Star className="w-3 h-3 fill-white" />
                  </div>
                </div>
              </div>
            </div>

            {/* Tabs */}
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden mb-4">
              <div className="flex border-b border-gray-200">
                <button
                  onClick={() => setSelectedTab('details')}
                  className={`flex-1 px-4 py-3 text-sm font-semibold ${
                    selectedTab === 'details'
                      ? 'text-[#FF8C42] border-b-2 border-[#FF8C42]'
                      : 'text-gray-600'
                  }`}
                >
                  Details
                </button>
                <button
                  onClick={() => setSelectedTab('reviews')}
                  className={`flex-1 px-4 py-3 text-sm font-semibold ${
                    selectedTab === 'reviews'
                      ? 'text-[#FF8C42] border-b-2 border-[#FF8C42]'
                      : 'text-gray-600'
                  }`}
                >
                  Reviews ({reviews.length})
                </button>
                <button
                  onClick={() => setSelectedTab('seller')}
                  className={`flex-1 px-4 py-3 text-sm font-semibold ${
                    selectedTab === 'seller'
                      ? 'text-[#FF8C42] border-b-2 border-[#FF8C42]'
                      : 'text-gray-600'
                  }`}
                >
                  Seller
                </button>
              </div>

              <div className="p-6">
                {selectedTab === 'details' && (
                  <div className="space-y-4">
                    <div>
                      <h3 className="font-semibold text-gray-800 mb-2">Description</h3>
                      <p className="text-sm text-gray-600">{product.description}</p>
                    </div>
                    {product.specifications && product.specifications.length > 0 && (
                      <div>
                        <h3 className="font-semibold text-gray-800 mb-2">Specifications</h3>
                        <div className="space-y-2">
                          {product.specifications.map((spec, idx) => (
                            <div key={idx} className="flex items-center justify-between py-2 border-b border-gray-100">
                              <span className="text-sm text-gray-600">{spec.label}</span>
                              <span className="text-sm font-semibold text-gray-800">{spec.value}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {selectedTab === 'reviews' && (
                  <div className="space-y-4">
                    {reviews.length === 0 ? (
                      <p className="text-center text-gray-600 py-8">No reviews yet</p>
                    ) : (
                      reviews.map(review => (
                        <div key={review.id} className="border-b border-gray-100 pb-4 last:border-0">
                          <div className="flex items-center gap-2 mb-2">
                            <div className="flex items-center gap-1 bg-green-500 text-white px-2 py-0.5 rounded">
                              <span className="text-xs font-semibold">{review.rating}</span>
                              <Star className="w-3 h-3 fill-white" />
                            </div>
                            <span className="font-semibold text-sm">{review.customerName}</span>
                          </div>
                          <p className="text-sm text-gray-600">{review.comment}</p>
                          <p className="text-xs text-gray-400 mt-2">
                            {new Date(review.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {selectedTab === 'seller' && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-semibold text-gray-800">{product.sellerName}</h3>
                        <p className="text-sm text-gray-600">Professional Seller</p>
                      </div>
                      <div className="flex items-center gap-1 bg-green-500 text-white px-3 py-1.5 rounded">
                        <span className="font-semibold">{product.sellerRating.toFixed(1)}</span>
                        <Star className="w-4 h-4 fill-white" />
                      </div>
                    </div>
                    <Button
                      onClick={() => navigate(`/shop/seller/${product.sellerId}`)}
                      variant="outline"
                      className="w-full"
                    >
                      View All Products
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Actions */}
      {product.inStock && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 z-20">
          <div className="max-w-7xl mx-auto flex gap-3">
            <Button
              onClick={addToCart}
              disabled={addingToCart}
              variant="outline"
              className="flex-1 flex items-center justify-center gap-2"
            >
              <ShoppingCart className="w-5 h-5" />
              Add to Cart
            </Button>
            <Button
              onClick={buyNow}
              disabled={addingToCart}
              className="flex-1 bg-[#FF8C42] hover:bg-[#FF7A2F] text-white"
            >
              Buy Now
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
