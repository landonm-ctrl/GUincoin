import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  getCurrentUser,
  getStoreProducts,
  getBalance,
  getWishlist,
  addToWishlist,
  removeFromWishlist,
  purchaseProduct,
  createGoal,
  StoreProduct,
  User,
  Balance,
  WishlistItem,
} from '../services/api';
import Layout from '../components/Layout';

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
});

type Tab = 'store' | 'wishlist';

export default function Store() {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [products, setProducts] = useState<StoreProduct[]>([]);
  const [wishlist, setWishlist] = useState<WishlistItem[]>([]);
  const [balance, setBalance] = useState<Balance | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('store');
  const [purchasing, setPurchasing] = useState<string | null>(null);
  const [purchaseConfirm, setPurchaseConfirm] = useState<{
    product: StoreProduct;
    remainingBalance: number;
  } | null>(null);
  const [wishlistLoading, setWishlistLoading] = useState<Set<string>>(new Set());
  const [goalCreating, setGoalCreating] = useState<string | null>(null);
  const [goalAmount, setGoalAmount] = useState<Record<string, number>>({});

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      setError(null);
      try {
        const results = await Promise.allSettled([
          getCurrentUser(),
          getStoreProducts(),
          getBalance(),
          getWishlist(),
        ]);

        const hasAuthError = results.some(
          (result) =>
            result.status === 'rejected' &&
            (result.reason as any)?.response?.status === 401
        );
        if (hasAuthError) {
          navigate('/login');
          return;
        }

        const [userRes, productsRes, balanceRes, wishlistRes] = results;
        if (userRes.status === 'fulfilled') {
          setUser(userRes.value.data);
        }
        if (productsRes.status === 'fulfilled') {
          setProducts(productsRes.value.data);
        }
        if (balanceRes.status === 'fulfilled') {
          setBalance(balanceRes.value.data);
        }
        if (wishlistRes.status === 'fulfilled') {
          setWishlist(wishlistRes.value.data);
        }

        if (results.some((result) => result.status === 'rejected')) {
          setError('We could not load all store data. Please refresh and try again.');
        }
      } catch (error: any) {
        if (error.response?.status === 401) {
          navigate('/login');
          return;
        }
        setError('We could not load the store products. Please refresh and try again.');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [navigate]);

  const wishlistProductIds = useMemo(() => new Set(wishlist.map((item) => item.productId)), [wishlist]);

  const handlePurchase = async (product: StoreProduct) => {
    if (!balance) return;

    const remainingBalance = balance.total - product.priceGuincoin;
    if (remainingBalance < 0) {
      alert('Insufficient balance');
      return;
    }

    setPurchaseConfirm({ product, remainingBalance });
  };

  const confirmPurchase = async () => {
    if (!purchaseConfirm) return;

    setPurchasing(purchaseConfirm.product.id);
    try {
      await purchaseProduct({ productId: purchaseConfirm.product.id });
      alert('Purchase successful!');
      setPurchaseConfirm(null);
      // Reload balance
      const balanceRes = await getBalance();
      setBalance(balanceRes.data);
      // Remove from wishlist if it was there
      if (wishlistProductIds.has(purchaseConfirm.product.id)) {
        await removeFromWishlist(purchaseConfirm.product.id);
        const wishlistRes = await getWishlist();
        setWishlist(wishlistRes.data);
      }
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to purchase product');
    } finally {
      setPurchasing(null);
    }
  };

  const handleWishlistToggle = async (productId: string) => {
    setWishlistLoading((prev) => new Set(prev).add(productId));
    try {
      if (wishlistProductIds.has(productId)) {
        await removeFromWishlist(productId);
        const wishlistRes = await getWishlist();
        setWishlist(wishlistRes.data);
      } else {
        await addToWishlist(productId);
        const wishlistRes = await getWishlist();
        setWishlist(wishlistRes.data);
      }
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to update wishlist');
    } finally {
      setWishlistLoading((prev) => {
        const next = new Set(prev);
        next.delete(productId);
        return next;
      });
    }
  };

  const handleCreateGoal = async (product: StoreProduct) => {
    const targetAmount = goalAmount[product.id] || product.priceGuincoin;
    if (targetAmount > product.priceGuincoin) {
      alert(`Target amount cannot exceed product price (${product.priceGuincoin} Guincoin)`);
      return;
    }

    setGoalCreating(product.id);
    try {
      await createGoal({ productId: product.id, targetAmount });
      alert('Goal created! Check your dashboard to track progress.');
      setGoalAmount((prev) => {
        const next = { ...prev };
        delete next[product.id];
        return next;
      });
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to create goal');
    } finally {
      setGoalCreating(null);
    }
  };

  const displayProducts = activeTab === 'store' ? products : wishlist.map((item) => item.product);

  const emptyState = useMemo(() => {
    if (loading || error) {
      return null;
    }

    if (activeTab === 'store' && products.length === 0) {
      return (
        <div className="rounded-md border border-gray-200 bg-white px-4 py-6 text-center text-sm text-gray-600">
          No store products are available yet. Check back soon.
        </div>
      );
    }

    if (activeTab === 'wishlist' && wishlist.length === 0) {
      return (
        <div className="rounded-md border border-gray-200 bg-white px-4 py-6 text-center text-sm text-gray-600">
          Your wishlist is empty. Add items from the store to your wishlist.
        </div>
      );
    }

    return null;
  }, [loading, error, activeTab, products.length, wishlist.length]);

  if (loading) {
    return (
      <Layout>
        <div className="text-center py-12">Loading...</div>
      </Layout>
    );
  }

  return (
    <Layout user={user || undefined}>
      <div className="px-4 py-6 sm:px-0">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Guincoin Store</h1>
          <p className="mt-1 text-sm text-gray-500">
            Browse items available for Guincoin. 10 Guincoin equals $1.00 USD.
          </p>
        </div>

        {error && (
          <div className="mb-6 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Tabs */}
        <div className="mb-6 border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab('store')}
              className={`whitespace-nowrap border-b-2 py-4 px-1 text-sm font-medium ${
                activeTab === 'store'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
              }`}
            >
              Store
            </button>
            <button
              onClick={() => setActiveTab('wishlist')}
              className={`whitespace-nowrap border-b-2 py-4 px-1 text-sm font-medium ${
                activeTab === 'wishlist'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
              }`}
            >
              Wishlist ({wishlist.length})
            </button>
          </nav>
        </div>

        {emptyState}

        {displayProducts.length > 0 && (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {displayProducts.map((product) => {
              const isInWishlist = wishlistProductIds.has(product.id);
              const targetAmount = goalAmount[product.id] || product.priceGuincoin;

              return (
                <div
                  key={product.id}
                  className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm"
                >
                  {product.imageUrls[0] ? (
                    <img
                      src={product.imageUrls[0]}
                      alt={product.name}
                      className="h-48 w-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="flex h-48 items-center justify-center bg-gray-100 text-sm text-gray-500">
                      No image available
                    </div>
                  )}

                  <div className="p-4">
                    <h2 className="text-lg font-semibold text-gray-900">{product.name}</h2>
                    {product.description && (
                      <p className="mt-2 text-sm text-gray-600 line-clamp-2">{product.description}</p>
                    )}
                    <div className="mt-4 flex items-center justify-between">
                      <div>
                        <div className="text-sm text-gray-500">Guincoin</div>
                        <div className="text-xl font-bold text-blue-600">
                          {product.priceGuincoin.toFixed(2)}
                        </div>
                        {product.priceUsd !== null && (
                          <div className="text-xs text-gray-500">
                            {currencyFormatter.format(product.priceUsd)}
                          </div>
                        )}
                      </div>
                      {product.amazonUrl && (
                        <a
                          href={product.amazonUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-sm font-medium text-blue-600 hover:text-blue-700"
                        >
                          View on Amazon
                        </a>
                      )}
                    </div>

                    <div className="mt-4 space-y-2">
                      <button
                        onClick={() => handlePurchase(product)}
                        disabled={purchasing === product.id || (balance?.total || 0) < product.priceGuincoin}
                        className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                      >
                        {purchasing === product.id ? 'Processing...' : 'Purchase'}
                      </button>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleWishlistToggle(product.id)}
                          disabled={wishlistLoading.has(product.id)}
                          className={`flex-1 rounded-md border px-3 py-1.5 text-sm font-medium ${
                            isInWishlist
                              ? 'border-blue-600 bg-blue-50 text-blue-700 hover:bg-blue-100'
                              : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                          } disabled:opacity-50`}
                        >
                          {wishlistLoading.has(product.id)
                            ? '...'
                            : isInWishlist
                            ? 'In Wishlist'
                            : 'Add to Wishlist'}
                        </button>
                        <button
                          onClick={() => handleCreateGoal(product)}
                          disabled={goalCreating === product.id}
                          className="flex-1 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                        >
                          {goalCreating === product.id ? 'Creating...' : 'Add to Goal'}
                        </button>
                      </div>
                      {goalAmount[product.id] !== undefined && (
                        <div className="mt-2">
                          <label className="block text-xs text-gray-600 mb-1">Target Amount</label>
                          <div className="flex gap-2">
                            <input
                              type="number"
                              min="0"
                              max={product.priceGuincoin}
                              step="0.01"
                              value={targetAmount}
                              onChange={(e) =>
                                setGoalAmount((prev) => ({
                                  ...prev,
                                  [product.id]: parseFloat(e.target.value) || 0,
                                }))
                              }
                              className="flex-1 rounded-md border border-gray-300 px-2 py-1 text-sm"
                            />
                            <button
                              onClick={() => handleCreateGoal(product)}
                              className="rounded-md bg-blue-600 px-3 py-1 text-sm text-white hover:bg-blue-700"
                            >
                              Create
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Purchase Confirmation Modal */}
        {purchaseConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
            <div className="rounded-lg bg-white p-6 shadow-xl max-w-md w-full mx-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Confirm Purchase</h3>
              <p className="text-sm text-gray-600 mb-2">
                You are about to purchase <strong>{purchaseConfirm.product.name}</strong> for{' '}
                <strong>{purchaseConfirm.product.priceGuincoin.toFixed(2)} Guincoin</strong>.
              </p>
              <div className="mt-4 p-3 bg-gray-50 rounded-md">
                <div className="text-sm text-gray-600">Current Balance</div>
                <div className="text-xl font-bold text-blue-600">
                  {balance?.total.toFixed(2) || '0.00'} Guincoin
                </div>
                <div className="text-sm text-gray-600 mt-2">Remaining Balance After Purchase</div>
                <div className="text-xl font-bold text-green-600">
                  {purchaseConfirm.remainingBalance.toFixed(2)} Guincoin
                </div>
              </div>
              <div className="mt-6 flex gap-3">
                <button
                  onClick={() => setPurchaseConfirm(null)}
                  className="flex-1 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmPurchase}
                  disabled={purchasing === purchaseConfirm.product.id}
                  className="flex-1 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:bg-gray-400"
                >
                  {purchasing === purchaseConfirm.product.id ? 'Processing...' : 'Confirm Purchase'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
