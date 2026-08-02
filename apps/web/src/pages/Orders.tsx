import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { PageLayout } from "@/components/layouts/PageLayout";
import { useAuth } from "@/contexts/AuthContext";
import { useOrders } from "@/hooks/useOrders";
import { Package, Clock, CheckCircle, Truck, XCircle } from "lucide-react";
import { InvoiceDownload } from "@/components/InvoiceDownload";
import { ReorderButton } from "@/components/ReorderButton";
import { RefundTracker } from "@/components/RefundTracker";
import { SEOHead } from "@/components/SEOHead";
import { OptimizedImage } from "@/components/ui/optimized-image";
import { CancelOrderRequestButton } from "@/components/CancelOrderRequestButton";
import { Skeleton } from "@/components/ui/skeleton";

const statusConfig = {
  pending: { label: "Pending", icon: Clock, color: "text-yellow-500" },
  confirmed: { label: "Confirmed", icon: CheckCircle, color: "text-blue-500" },
  processing: { label: "Processing", icon: Package, color: "text-purple-500" },
  shipped: { label: "Shipped", icon: Truck, color: "text-indigo-500" },
  delivered: { label: "Delivered", icon: CheckCircle, color: "text-green-500" },
  cancelled: { label: "Cancelled", icon: XCircle, color: "text-red-500" },
};

function OrdersPageSkeleton() {
  return (
    <PageLayout showNewsletter={false}>
      <div className="container mx-auto px-6 py-16">
        <Skeleton className="mb-8 h-10 w-40" />

        <div className="space-y-6">
          {Array.from({ length: 3 }).map((_, index) => (
            <div
              key={`order-card-skeleton-${index}`}
              className="rounded-lg border border-border bg-card p-6"
            >
              <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
                <div className="space-y-2">
                  <Skeleton className="h-5 w-36" />
                  <Skeleton className="h-4 w-28" />
                </div>
                <Skeleton className="h-6 w-28" />
              </div>

              <div className="mb-4 space-y-3">
                {Array.from({ length: 2 }).map((_, itemIndex) => (
                  <div
                    key={`order-item-skeleton-${index}-${itemIndex}`}
                    className="flex items-center gap-4"
                  >
                    <Skeleton className="h-16 w-16 rounded-lg" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-40" />
                      <Skeleton className="h-4 w-32" />
                    </div>
                    <Skeleton className="h-4 w-20" />
                  </div>
                ))}
              </div>

              <div className="border-t border-border pt-4 space-y-3">
                {Array.from({ length: 4 }).map((_, rowIndex) => (
                  <div
                    key={`order-total-skeleton-${index}-${rowIndex}`}
                    className="flex justify-between"
                  >
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-4 w-16" />
                  </div>
                ))}
              </div>

              <div className="mt-4 flex flex-wrap gap-2 border-t border-border pt-4">
                <Skeleton className="h-10 w-28" />
                <Skeleton className="h-10 w-28" />
                <Skeleton className="h-10 w-36" />
              </div>
            </div>
          ))}
        </div>

        <div className="mt-12">
          <Skeleton className="mb-6 h-8 w-40" />
          <div className="rounded-lg border border-border bg-card p-6 space-y-3">
            <Skeleton className="h-5 w-44" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        </div>
      </div>
    </PageLayout>
  );
}

export default function Orders() {
  const navigate = useNavigate();
  const { user, isLoading: authLoading } = useAuth();
  const { data: orders, isLoading } = useOrders();

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/login");
    }
  }, [user, authLoading, navigate]);

  if (authLoading || isLoading) {
    return <OrdersPageSkeleton />;
  }

  return (
    <PageLayout showNewsletter={false}>
      <SEOHead title="My Orders" description="View and track your Pebric orders." noindex={true} />
      <div className="container mx-auto px-6 py-16">
        <h1 className="mb-8 font-display text-4xl font-medium">My Orders</h1>

        {!orders || orders.length === 0 ? (
          <div className="rounded-lg border border-border bg-card p-12 text-center">
            <Package className="mx-auto mb-4 h-16 w-16 text-muted-foreground" />
            <h2 className="mb-2 font-display text-2xl">No orders yet</h2>
            <p className="text-muted-foreground">
              Start shopping to see your orders here!
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {orders.map((order) => {
              const status = statusConfig[order.status];
              const StatusIcon = status.icon;

              return (
                <div
                  key={order.id}
                  className="rounded-lg border border-border bg-card p-6"
                >
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <p className="font-medium">{order.order_number}</p>
                      <p className="text-sm text-muted-foreground">
                        {new Date(order.created_at).toLocaleDateString("en-US", {
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                        })}
                      </p>
                    </div>
                    <div className={`flex items-center gap-2 ${status.color}`}>
                      <StatusIcon className="h-5 w-5" />
                      <span className="font-medium">{status.label}</span>
                    </div>
                  </div>

                  <div className="mb-4 space-y-3">
                    {order.items?.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center gap-4"
                      >
                        <OptimizedImage
                          src={
                            item.product_image ||
                            "https://images.unsplash.com/photo-1543466835-00a7907e9de1?auto=format&fit=crop&q=80&w=400"
                          }
                          alt={item.product_name || "Product"}
                          wrapperClassName="h-16 w-16 flex-shrink-0 rounded-lg overflow-hidden border border-border"
                          className="object-cover"
                          sizes="64px"
                        />
                        <div className="flex-1">
                          <p className="font-medium text-foreground">{item.product_name}</p>
                          <p className="text-sm text-muted-foreground">
                            Qty: {item.quantity}
                            {item.size && item.size !== "N/A" ? ` • Size: ${item.size}` : ""}
                            {item.pet_size && item.pet_size !== "N/A" ? ` • Pet Size: ${item.pet_size}` : ""}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-medium text-foreground">₹{(item.total_price || 0).toFixed(2)}</p>
                          {item.quantity > 1 && item.unit_price > 0 && (
                            <p className="text-xs text-muted-foreground">₹{item.unit_price.toFixed(2)} each</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="border-t border-border pt-4">
                    <div className="flex justify-between text-sm">
                      <span>Subtotal</span>
                      <span className="font-medium">₹{(order.subtotal || 0).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Shipping</span>
                      <span>{order.shipping_cost > 0 ? `₹${order.shipping_cost.toFixed(2)}` : "Free"}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Tax</span>
                      <span>₹{(order.tax || 0).toFixed(2)}</span>
                    </div>
                    {order.payment_method?.toLowerCase() === "cod" && (
                      <div className="flex justify-between text-sm">
                        <span>COD Fee</span>
                        <span>₹11.00</span>
                      </div>
                    )}
                    <div className="mt-2 flex justify-between border-t border-border pt-2 font-medium text-base text-foreground">
                      <span>Total</span>
                      <span>₹{(order.total || 0).toFixed(2)}</span>
                    </div>
                  </div>

                  {/* Invoice & Reorder Actions */}
                  <div className="mt-4 flex flex-wrap gap-2 border-t border-border pt-4">
                    <InvoiceDownload order={order} />
                    {order.items && order.items.length > 0 && (
                      <ReorderButton orderItems={order.items} />
                    )}
                    <CancelOrderRequestButton
                      orderId={order.id}
                      orderNumber={order.order_number}
                      status={order.status}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Refund Tracker Section */}
        <div className="mt-12">
          <h2 className="mb-6 font-display text-2xl font-medium">Refund Status</h2>
          <RefundTracker />
        </div>
      </div>
    </PageLayout>
  );
}
