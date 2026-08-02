import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { PageLayout } from "@/components/layouts/PageLayout";
import { useAuth } from "@/contexts/AuthContext";
import { useOrdersWithTracking, useShipmentTracking } from "@/hooks/useShipmentTracking";
import { Package, Truck, CheckCircle, MapPin, Clock, Search, ChevronRight, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { SEOHead } from "@/components/SEOHead";
import { supabase } from "@/integrations/client";
import { toast } from "sonner";

const statusSteps = [
  { key: "confirmed", label: "Order Confirmed", icon: CheckCircle },
  { key: "processing", label: "Processing", icon: Package },
  { key: "shipped", label: "Shipped", icon: Truck },
  { key: "delivered", label: "Delivered", icon: MapPin },
];

export default function Tracking() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, isLoading: authLoading } = useAuth();
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(
    searchParams.get("order") || null
  );
  const [trackingInput, setTrackingInput] = useState("");

  const { data: orders = [], isLoading: ordersLoading } = useOrdersWithTracking();
  const { data: selectedOrder, isLoading: trackingLoading } = useShipmentTracking(
    selectedOrderId || ""
  );

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/login");
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (selectedOrderId) {
      setSearchParams({ order: selectedOrderId });
    } else {
      setSearchParams({});
    }
  }, [selectedOrderId, setSearchParams]);

  const handleTrackOrder = async () => {
    const input = trackingInput.trim();
    if (!input) return;

    const found = orders.find(
      (o) =>
        o.id === input ||
        o.order_number === input ||
        (o.order_number && o.order_number.toLowerCase() === input.toLowerCase()) ||
        o.tracking_number === input
    );

    if (found) {
      setSelectedOrderId(found.id);
    } else {
      setSelectedOrderId(input);
    }
    setTrackingInput("");
  };

  const getStatusIndex = (status: string) => {
    const index = statusSteps.findIndex((s) => s.key === status);
    return index >= 0 ? index : 0;
  };

  if (authLoading || ordersLoading) {
    return (
      <PageLayout showNewsletter={false}>
        <div className="container mx-auto px-6 py-16">
          <div className="flex items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout showNewsletter={false}>
      <SEOHead title="Track Your Order" description="Track your Pebric order shipment status in real-time." noindex={true} />
      <section className="bg-muted py-16">
        <div className="container mx-auto px-6 text-center">
          <p className="mb-3 font-body text-xs uppercase tracking-[0.3em] text-muted-foreground">
            Shipment
          </p>
          <h1 className="mb-4 font-display text-5xl font-medium tracking-tight">
            Track Your Order
          </h1>
          <p className="mx-auto mb-8 max-w-xl font-body text-lg text-muted-foreground">
            Enter your order or tracking number to see the latest status
          </p>

          {/* Search Bar */}
          <div className="relative mx-auto max-w-md">
            <input
              type="text"
              value={trackingInput}
              onChange={(e) => setTrackingInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleTrackOrder()}
              placeholder="Order number or tracking number"
              className="w-full border border-border bg-background py-4 pl-4 pr-12 font-body placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-foreground"
            />
            <button
              onClick={handleTrackOrder}
              className="absolute right-2 top-1/2 -translate-y-1/2 bg-foreground p-2 text-background"
            >
              <Search className="h-5 w-5" />
            </button>
          </div>
        </div>
      </section>

      <section className="py-12">
        <div className="container mx-auto px-6">
          <div className="grid gap-8 lg:grid-cols-3">
            {/* Order List */}
            <div className="lg:col-span-1">
              <h2 className="mb-4 font-display text-xl">Recent Shipments</h2>
              {orders.length === 0 ? (
                <div className="rounded-lg border border-border bg-card p-6 text-center">
                  <Package className="mx-auto mb-3 h-12 w-12 text-muted-foreground" />
                  <p className="font-body text-muted-foreground">
                    No active shipments
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {orders.map((order) => (
                    <button
                      key={order.id}
                      onClick={() => setSelectedOrderId(order.id)}
                      className={cn(
                        "flex w-full items-center justify-between border p-4 text-left transition-colors",
                        selectedOrderId === order.id
                          ? "border-foreground bg-muted"
                          : "border-border hover:bg-muted"
                      )}
                    >
                      <div>
                        <p className="font-medium">{order.order_number}</p>
                        <p className="text-sm text-muted-foreground">
                          {new Date(order.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span
                          className={cn(
                            "rounded-full px-2 py-1 text-xs font-medium capitalize",
                            order.status === "shipped" && "bg-indigo-100 text-indigo-700",
                            order.status === "processing" && "bg-purple-100 text-purple-700",
                            order.status === "confirmed" && "bg-blue-100 text-blue-700",
                            order.status === "cancelled" && "bg-red-100 text-red-700"
                          )}
                        >
                          {order.status}
                        </span>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Tracking Details */}
            <div className="lg:col-span-2">
              {!selectedOrderId ? (
                <div className="rounded-lg border border-border bg-card p-12 text-center">
                  <Truck className="mx-auto mb-4 h-16 w-16 text-muted-foreground" />
                  <p className="font-display text-xl">Select an order to track</p>
                  <p className="mt-2 text-muted-foreground">
                    Choose from your recent shipments or enter a tracking number
                  </p>
                </div>
              ) : trackingLoading ? (
                <div className="flex items-center justify-center py-20">
                  <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                </div>
              ) : selectedOrder ? (
                <div className="rounded-lg border border-border bg-card p-6">
                  {/* Order Info */}
                  <div className="mb-6 flex flex-wrap items-start justify-between gap-4 border-b border-border pb-6">
                    <div>
                      <div className="flex items-center gap-3">
                        <p className="font-display text-2xl">{selectedOrder.order_number}</p>
                        {selectedOrder.status === "cancelled" && (
                          <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-700 flex items-center gap-1">
                            <XCircle className="h-3.5 w-3.5" /> Cancelled
                          </span>
                        )}
                      </div>
                      {selectedOrder.tracking_number && (
                        <p className="mt-1 text-sm text-muted-foreground">
                          Tracking: {selectedOrder.tracking_number}
                          {selectedOrder.carrier && ` (${selectedOrder.carrier})`}
                        </p>
                      )}
                    </div>
                    {selectedOrder.shipping_address && (
                      <div className="text-right text-sm text-muted-foreground">
                        <p>Shipping to:</p>
                        <p>{selectedOrder.shipping_address.full_name}</p>
                        <p>{selectedOrder.shipping_address.city}, {selectedOrder.shipping_address.country}</p>
                      </div>
                    )}
                  </div>

                  {/* Progress Tracker */}
                  <div className="mb-8">
                    {selectedOrder.status === "cancelled" ? (
                      <div className="rounded-lg border border-red-200 bg-red-50/50 p-6 text-center">
                        <XCircle className="mx-auto mb-2 h-10 w-10 text-red-600" />
                        <p className="font-display text-xl text-red-700 font-medium">Order Cancelled</p>
                        <p className="mt-1 text-sm text-red-600">
                          This order has been cancelled and is no longer active.
                        </p>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between">
                        {statusSteps.map((step, index) => {
                          const currentIndex = getStatusIndex(selectedOrder.status);
                          const isCompleted = index <= currentIndex;
                          const isCurrent = index === currentIndex;
                          const Icon = step.icon;

                          return (
                            <div
                              key={step.key}
                              className="flex flex-1 flex-col items-center"
                            >
                              <div className="relative flex w-full items-center">
                                {index > 0 && (
                                  <div
                                    className={cn(
                                      "h-1 flex-1",
                                      index <= currentIndex ? "bg-foreground" : "bg-border"
                                    )}
                                  />
                                )}
                                <div
                                  className={cn(
                                    "flex h-10 w-10 items-center justify-center rounded-full border-2",
                                    isCompleted
                                      ? "border-foreground bg-foreground text-background"
                                      : "border-border bg-background text-muted-foreground"
                                  )}
                                >
                                  <Icon className="h-5 w-5" />
                                </div>
                                {index < statusSteps.length - 1 && (
                                  <div
                                    className={cn(
                                      "h-1 flex-1",
                                      index < currentIndex ? "bg-foreground" : "bg-border"
                                    )}
                                  />
                                )}
                              </div>
                              <p
                                className={cn(
                                  "mt-2 text-center text-xs",
                                  isCurrent ? "font-medium" : "text-muted-foreground"
                                )}
                              >
                                {step.label}
                              </p>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Timeline */}
                  <div>
                    <h3 className="mb-4 font-display text-lg">Shipment History</h3>
                    {selectedOrder.shipment_events && selectedOrder.shipment_events.length > 0 ? (
                      <div className="space-y-4">
                        {selectedOrder.shipment_events
                          .sort((a, b) => new Date(b.event_time).getTime() - new Date(a.event_time).getTime())
                          .map((event, index) => (
                            <div key={event.id} className="flex gap-4">
                              <div className="flex flex-col items-center">
                                <div
                                  className={cn(
                                    "h-3 w-3 rounded-full",
                                    index === 0 ? "bg-foreground" : "bg-border"
                                  )}
                                />
                                {index < (selectedOrder.shipment_events?.length ?? 0) - 1 && (
                                  <div className="h-full w-0.5 bg-border" />
                                )}
                              </div>
                              <div className="flex-1 pb-4">
                                <p className="font-medium">{event.status}</p>
                                {event.description && (
                                  <p className="text-sm text-muted-foreground">
                                    {event.description}
                                  </p>
                                )}
                                <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                                  <Clock className="h-3 w-3" />
                                  {new Date(event.event_time).toLocaleString()}
                                  {event.location && (
                                    <>
                                      <MapPin className="ml-2 h-3 w-3" />
                                      {event.location}
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                      </div>
                    ) : (
                      <p className="text-muted-foreground">
                        No tracking updates yet. Check back soon!
                      </p>
                    )}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </section>
    </PageLayout>
  );
}
