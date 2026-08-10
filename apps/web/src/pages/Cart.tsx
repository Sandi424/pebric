import { Link } from "react-router-dom";
import { Trash2, Plus, Minus, ShoppingBag, ArrowRight } from "lucide-react";
import { PageLayout } from "@/components/layouts/PageLayout";
import { Button } from "@/components/ui/button";
import { useCart } from "@/contexts/CartContext";
import { toast } from "sonner";
import { SEOHead } from "@/components/SEOHead";
import { OptimizedImage } from "@/components/ui/optimized-image";

export default function Cart() {
  const { cartItems, updateQuantity, removeFromCart, cartTotal, clearCart, removeComboPart } = useCart();

  if (cartItems.length === 0) {
    return (
      <PageLayout showNewsletter={false}>
        <div className="container mx-auto px-6 py-32 text-center">
          <ShoppingBag className="mx-auto mb-6 h-16 w-16 text-muted-foreground" />
          <h1 className="mb-4 font-display text-4xl font-medium">Your Cart is Empty</h1>
          <p className="mb-8 font-body text-muted-foreground">
            Looks like you haven't added any items to your cart yet.
          </p>
          <Link to="/shop">
            <Button variant="hero">
              Start Shopping
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout showNewsletter={false}>
      <SEOHead
        title="Shopping Cart"
        description="Review items in your Pebric shopping cart."
        noindex={true}
      />
      <div className="container mx-auto px-6 py-6 md:py-8">
        <h1 className="mb-12 font-display text-4xl font-medium md:text-5xl">Shopping Cart</h1>

        <div className="grid gap-12 lg:grid-cols-3">
          {/* Cart Items */}
          <div className="lg:col-span-2">
            <div className="border-b border-border pb-4">
              <div className="hidden grid-cols-12 gap-4 font-body text-xs uppercase tracking-wider text-muted-foreground md:grid">
                <div className="col-span-5">Product</div>
                <div className="col-span-2 text-center">Quantity</div>
                <div className="col-span-2 text-center">Price</div>
                <div className="col-span-2 text-right">Total</div>
                <div className="col-span-1"></div>
              </div>
            </div>

            <div className="divide-y divide-border">
              {cartItems.map((item) => {
                const isMatchingSet = item.ownerSize !== "N/A" && item.petSize !== "N/A";
                const isStandard = item.ownerSize === "N/A" && item.petSize === "N/A";
                const halfPrice = Math.round(item.price * 0.5);
                const displayUnitPrice = isMatchingSet ? halfPrice : item.price;
                const totalItemQty = (item.ownerQuantity || 0) + (item.petQuantity || 0) || item.quantity || 1;
                const lineTotal = isMatchingSet
                  ? ((item.ownerQuantity || 0) * halfPrice) + ((item.petQuantity || 0) * halfPrice)
                  : item.price * totalItemQty;

                return (
                  <div
                    key={`${item.id}-${item.ownerSize}-${item.petSize}`}
                    className="grid grid-cols-12 items-center gap-4 py-6"
                  >
                    <div className="col-span-12 flex items-center gap-4 md:col-span-5">
                      <Link
                        to={`/product/${item.slug}`}
                        className="h-24 w-20 flex-shrink-0 overflow-hidden bg-muted"
                      >
                        <OptimizedImage
                          src={item.image}
                          alt={item.name}
                          priority={false}
                          sizes="80px"
                          className="h-full w-full object-cover object-center"
                        />
                      </Link>
                      <div className="flex-1">
                        <Link to={`/product/${item.slug}`} className="hover:underline">
                          <h3 className="font-medium">{item.name}</h3>
                        </Link>
                        <div className="mt-1 font-body text-sm text-muted-foreground space-y-1">
                          {item.ownerSize !== "N/A" && (
                            <div className="flex items-center gap-2">
                              <span>👤 Owner — Size: {item.ownerSize}</span>
                              {isMatchingSet && (
                                <button
                                  onClick={() => removeComboPart(item.id, item.ownerSize, item.petSize, "owner")}
                                  className="text-[10px] text-muted-foreground hover:text-destructive underline font-semibold transition-colors"
                                >
                                  Remove Owner
                                </button>
                              )}
                            </div>
                          )}
                          {item.petSize !== "N/A" && (
                            <div className="flex items-center gap-2">
                              <span>🐾 Pet — Size: {item.petSize}</span>
                              {isMatchingSet && (
                                <button
                                  onClick={() => removeComboPart(item.id, item.ownerSize, item.petSize, "pet")}
                                  className="text-[10px] text-muted-foreground hover:text-destructive underline font-semibold transition-colors"
                                >
                                  Remove Pet
                                </button>
                              )}
                            </div>
                          )}
                        </div>

                        <button
                          onClick={() => removeFromCart(item.id, item.ownerSize, item.petSize)}
                          className="mt-2 flex items-center gap-1 font-body text-xs text-muted-foreground hover:text-destructive md:hidden"
                        >
                          <Trash2 className="h-3 w-3" />
                          Remove Product
                        </button>
                      </div>
                    </div>

                    {/* Quantity Selectors Stack */}
                    <div className="col-span-4 flex flex-col gap-2 justify-center md:col-span-2">
                      {item.ownerSize !== "N/A" && (
                        <div className="flex flex-col items-center gap-1">
                          <span className="text-[9px] uppercase tracking-wider text-muted-foreground">Owner Qty</span>
                          <div className="flex items-center border border-border">
                            <button
                              onClick={() => updateQuantity(item.id, item.ownerSize, item.petSize, item.ownerQuantity - 1, item.petQuantity)}
                              className="flex h-8 w-8 items-center justify-center transition-colors hover:bg-muted"
                              title="Decrease owner quantity"
                              aria-label="Decrease owner quantity"
                            >
                              <Minus className="h-3 w-3" />
                            </button>
                            <span className="w-8 text-center font-body text-xs">{item.ownerQuantity}</span>
                            <button
                              onClick={() => updateQuantity(item.id, item.ownerSize, item.petSize, item.ownerQuantity + 1, item.petQuantity)}
                              className="flex h-8 w-8 items-center justify-center transition-colors hover:bg-muted"
                              title="Increase owner quantity"
                              aria-label="Increase owner quantity"
                            >
                              <Plus className="h-3 w-3" />
                            </button>
                          </div>
                        </div>
                      )}

                      {item.petSize !== "N/A" && (
                        <div className="flex flex-col items-center gap-1">
                          <span className="text-[9px] uppercase tracking-wider text-muted-foreground">Pet Qty</span>
                          <div className="flex items-center border border-border">
                            <button
                              onClick={() => updateQuantity(item.id, item.ownerSize, item.petSize, item.ownerQuantity, item.petQuantity - 1)}
                              className="flex h-8 w-8 items-center justify-center transition-colors hover:bg-muted"
                              title="Decrease pet quantity"
                              aria-label="Decrease pet quantity"
                            >
                              <Minus className="h-3 w-3" />
                            </button>
                            <span className="w-8 text-center font-body text-xs">{item.petQuantity}</span>
                            <button
                              onClick={() => updateQuantity(item.id, item.ownerSize, item.petSize, item.ownerQuantity, item.petQuantity + 1)}
                              className="flex h-8 w-8 items-center justify-center transition-colors hover:bg-muted"
                              title="Increase pet quantity"
                              aria-label="Increase pet quantity"
                            >
                              <Plus className="h-3 w-3" />
                            </button>
                          </div>
                        </div>
                      )}

                      {isStandard && (
                        <div className="flex flex-col items-center gap-1">
                          <span className="text-[9px] uppercase tracking-wider text-muted-foreground">Qty</span>
                          <div className="flex items-center border border-border">
                            <button
                              onClick={() => updateQuantity(item.id, item.ownerSize, item.petSize, totalItemQty - 1, 0)}
                              className="flex h-8 w-8 items-center justify-center transition-colors hover:bg-muted"
                              title="Decrease quantity"
                              aria-label="Decrease quantity"
                            >
                              <Minus className="h-3 w-3" />
                            </button>
                            <span className="w-8 text-center font-body text-xs">{totalItemQty}</span>
                            <button
                              onClick={() => updateQuantity(item.id, item.ownerSize, item.petSize, totalItemQty + 1, 0)}
                              className="flex h-8 w-8 items-center justify-center transition-colors hover:bg-muted"
                              title="Increase quantity"
                              aria-label="Increase quantity"
                            >
                              <Plus className="h-3 w-3" />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Price */}
                    <div className="col-span-4 text-center font-body md:col-span-2">
                      ₹{displayUnitPrice}
                    </div>

                    {/* Total */}
                    <div className="col-span-4 text-right font-body font-medium md:col-span-2">
                      ₹{lineTotal}
                    </div>

                    {/* Remove (Desktop) */}
                    <div className="hidden justify-end md:col-span-1 md:flex">
                      <button
                        onClick={() => removeFromCart(item.id, item.ownerSize, item.petSize)}
                        className="text-muted-foreground hover:text-destructive"
                        aria-label="Remove item"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-6 flex justify-between">
              <Button variant="outline" onClick={clearCart}>
                Clear Cart
              </Button>
              <Link to="/shop">
                <Button variant="outline">Continue Shopping</Button>
              </Link>
            </div>
          </div>

          {/* Order Summary */}
          <div className="lg:col-span-1">
            <div className="bg-muted p-6">
              <h2 className="mb-6 font-display text-xl font-medium">Order Summary</h2>

              <div className="space-y-4 border-b border-border pb-6">
                <div className="flex justify-between font-body text-sm">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>₹{cartTotal}</span>
                </div>
                <div className="flex justify-between font-body text-sm">
                  <span className="text-muted-foreground">Shipping</span>
                  <span>{cartTotal >= 100 ? "Free" : "₹10"}</span>
                </div>
              </div>

              <div className="flex justify-between py-6">
                <span className="font-display text-lg font-medium">Total</span>
                <span className="font-display text-lg font-medium">
                  ₹{cartTotal >= 100 ? cartTotal : cartTotal + 10}
                </span>
              </div>

              <Link to="/checkout">
                <Button variant="hero" className="w-full">
                  Checkout
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>

              <p className="mt-4 text-center font-body text-xs text-muted-foreground">
                Free shipping on orders over ₹100
              </p>
            </div>
          </div>
        </div>
      </div>
    </PageLayout>
  );
}




