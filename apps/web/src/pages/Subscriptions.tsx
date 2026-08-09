import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { PageLayout } from "@/components/layouts/PageLayout";
import { useAuth } from "@/contexts/AuthContext";
import { useSubscriptions, useCancelSubscription } from "@/hooks/useSubscriptions";
import { useProducts } from "@/hooks/useProducts";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, Pause, Play, X, Package } from "lucide-react";
import { format } from "date-fns";
import { SEOHead } from "@/components/SEOHead";
import { OptimizedImage } from "@/components/ui/optimized-image";
import { AddSubscriptionModal } from "@/components/AddSubscriptionModal";

export default function Subscriptions() {
  const navigate = useNavigate();
  const { user, isLoading: authLoading } = useAuth();
  const { data: subscriptions = [], isLoading } = useSubscriptions();
  const { data: products = [] } = useProducts();
  const cancelSubscription = useCancelSubscription();

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/login");
    }
  }, [user, authLoading, navigate]);

  const getProduct = (productId: string) => products.find(p => p.id === productId);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-700';
      case 'paused': return 'bg-yellow-100 text-yellow-700';
      case 'cancelled': return 'bg-red-100 text-red-700';
      default: return 'bg-muted';
    }
  };

  if (authLoading || isLoading) {
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
      <SEOHead title="My Subscriptions" description="Manage your recurring Pebric deliveries." noindex={true} />
      <div className="container mx-auto px-6 py-16">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="font-display text-4xl font-medium">My Subscriptions</h1>
            <p className="text-muted-foreground mt-1">Manage your recurring deliveries</p>
          </div>
          <AddSubscriptionModal />
        </div>

        {subscriptions.length === 0 ? (
          <div className="rounded-lg border border-border bg-card p-12 text-center">
            <RefreshCw className="mx-auto mb-4 h-16 w-16 text-muted-foreground" />
            <h2 className="mb-2 font-display text-2xl">No subscriptions yet</h2>
            <p className="text-muted-foreground mb-4">
              Subscribe to your favorite products and save up to 15%!
            </p>
            <Button onClick={() => navigate("/shop")}>Browse Products</Button>
          </div>
        ) : (
          <div className="space-y-4">
            {subscriptions.map((subscription) => {
              const product = getProduct(subscription.product_id);
              
              return (
                <div key={subscription.id} className="rounded-lg border border-border bg-card p-6">
                  <div className="flex items-start gap-4">
                    {product?.image_url && (
                      <OptimizedImage
                        src={product.image_url}
                        alt={product.name}
                        wrapperClassName="h-20 w-20 flex-shrink-0 rounded-lg overflow-hidden"
                        className="object-cover"
                        sizes="80px"
                      />
                    )}
                    <div className="flex-1">
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="font-medium">{product?.name || "Product"}</h3>
                          <p className="text-sm text-muted-foreground">
                            {subscription.quantity}x • {subscription.frequency}
                            {subscription.size && ` • Size: ${subscription.size}`}
                            {subscription.pet_size && ` • Pet: ${subscription.pet_size}`}
                          </p>
                        </div>
                        <Badge className={getStatusColor(subscription.status)}>
                          {subscription.status}
                        </Badge>
                      </div>
                      
                      <div className="mt-3 flex items-center gap-4">
                        <div className="flex items-center gap-2 text-sm">
                          <Package className="h-4 w-4 text-muted-foreground" />
                          <span>Next delivery: {format(new Date(subscription.next_delivery_date), 'MMM d, yyyy')}</span>
                        </div>
                      </div>

                      {subscription.status === 'active' && (
                        <div className="mt-4 flex gap-2">
                          <Button variant="outline" size="sm">
                            <Pause className="mr-2 h-4 w-4" />
                            Pause
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => cancelSubscription.mutate(subscription.id)}
                          >
                            <X className="mr-2 h-4 w-4" />
                            Cancel
                          </Button>
                        </div>
                      )}

                      {subscription.status === 'paused' && (
                        <div className="mt-4">
                          <Button variant="outline" size="sm">
                            <Play className="mr-2 h-4 w-4" />
                            Resume
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </PageLayout>
  );
}
