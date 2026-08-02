import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/client";
import { useAuth } from "@/contexts/AuthContext";

export interface ShipmentEvent {
  id: string;
  order_id: string;
  status: string;
  location: string | null;
  description: string | null;
  event_time: string;
  created_at: string;
}

export interface OrderWithTracking {
  id: string;
  order_number: string;
  status: string;
  tracking_number: string | null;
  carrier: string | null;
  created_at: string;
  shipping_address: {
    full_name?: string;
    address?: string;
    city?: string;
    postal_code?: string;
    country?: string;
  } | null;
  shipment_events?: ShipmentEvent[];
}

export function useShipmentTracking(orderIdOrNumber: string) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["shipment-tracking", orderIdOrNumber, user?.id],
    queryFn: async () => {
      if (!orderIdOrNumber) return null;

      const trimmed = orderIdOrNumber.trim();
      let foundOrder: OrderWithTracking | null = null;

      // 1. Check DB table by ID, order_number, or tracking_number
      try {
        let query = supabase
          .from("orders")
          .select(`
            id,
            order_number,
            status,
            tracking_number,
            carrier,
            created_at,
            shipping_address,
            shipment_events(*)
          `);

        if (user?.id) {
          query = query.eq("user_id", user.id);
        }

        // Try exact match or ilike match
        const { data, error } = await query
          .or(`id.eq.${trimmed},order_number.eq.${trimmed},tracking_number.eq.${trimmed},order_number.ilike.${trimmed}`)
          .maybeSingle();

        if (!error && data) {
          foundOrder = data as unknown as OrderWithTracking;
        }
      } catch (err) {
        console.warn("DB shipment tracking lookup error:", err);
      }

      // 2. Check user metadata fallback if not found in DB table
      if (!foundOrder && user) {
        const metaOrders = user.user_metadata?.user_orders || [];
        const match = metaOrders.find(
          (o: any) =>
            o.id === trimmed ||
            o.order_number === trimmed ||
            (o.order_number && o.order_number.toLowerCase() === trimmed.toLowerCase()) ||
            o.tracking_number === trimmed
        );
        if (match) {
          foundOrder = {
            id: match.id,
            order_number: match.order_number,
            status: match.status || "confirmed",
            tracking_number: match.tracking_number || null,
            carrier: match.carrier || "Standard Delivery",
            created_at: match.created_at || new Date().toISOString(),
            shipping_address: match.shipping_address || null,
            shipment_events: match.shipment_events || [],
          };
        }
      }

      if (foundOrder) {
        if (foundOrder.status === "cancelled") {
          foundOrder.shipment_events = [
            {
              id: `evt-${foundOrder.id}-cancelled`,
              order_id: foundOrder.id,
              status: "Order Cancelled",
              description: "This order has been cancelled.",
              event_time: foundOrder.created_at || new Date().toISOString(),
              location: "Order System",
              created_at: foundOrder.created_at || new Date().toISOString(),
            },
          ];
        } else if (!foundOrder.shipment_events || foundOrder.shipment_events.length === 0) {
          const createdAtDate = foundOrder.created_at || new Date().toISOString();
          const baseTime = new Date(createdAtDate).getTime();
          const events: ShipmentEvent[] = [
            {
              id: `evt-${foundOrder.id}-1`,
              order_id: foundOrder.id,
              status: "Order Confirmed",
              description: "Your order has been confirmed and is being prepared.",
              event_time: createdAtDate,
              location: "Fulfillment Center",
              created_at: createdAtDate,
            },
          ];

          if (["processing", "shipped", "delivered"].includes(foundOrder.status)) {
            events.push({
              id: `evt-${foundOrder.id}-2`,
              order_id: foundOrder.id,
              status: "Processing & Quality Check",
              description: "Items inspected and packed for shipment.",
              event_time: new Date(baseTime + 3600000).toISOString(),
              location: "Logistics Hub",
              created_at: createdAtDate,
            });
          }

          if (["shipped", "delivered"].includes(foundOrder.status)) {
            events.push({
              id: `evt-${foundOrder.id}-3`,
              order_id: foundOrder.id,
              status: "Shipped",
              description: "Handed over to carrier for delivery.",
              event_time: new Date(baseTime + 7200000).toISOString(),
              location: "In Transit",
              created_at: createdAtDate,
            });
          }

          if (foundOrder.status === "delivered") {
            events.push({
              id: `evt-${foundOrder.id}-4`,
              order_id: foundOrder.id,
              status: "Delivered",
              description: "Package successfully delivered to recipient.",
              event_time: new Date(baseTime + 86400000).toISOString(),
              location: "Destination Address",
              created_at: createdAtDate,
            });
          }

          foundOrder.shipment_events = events;
        }
      }

      return foundOrder;
    },
    enabled: !!orderIdOrNumber,
  });
}

export function useOrdersWithTracking() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["orders-with-tracking", user?.id],
    queryFn: async () => {
      if (!user) return [];

      let dbOrders: OrderWithTracking[] = [];
      try {
        const { data, error } = await supabase
          .from("orders")
          .select(`
            id,
            order_number,
            status,
            tracking_number,
            carrier,
            created_at,
            shipping_address
          `)
          .eq("user_id", user.id)
          .order("created_at", { ascending: false });

        if (!error && data) {
          dbOrders = data as unknown as OrderWithTracking[];
        }
      } catch (err) {
        console.warn("Could not fetch orders with tracking:", err);
      }

      const metaOrders: OrderWithTracking[] = (user.user_metadata?.user_orders || []).map((ord: any) => ({
        id: ord.id,
        order_number: ord.order_number,
        status: ord.status || "confirmed",
        tracking_number: ord.tracking_number || null,
        carrier: ord.carrier || "Standard Delivery",
        created_at: ord.created_at || new Date().toISOString(),
        shipping_address: ord.shipping_address || null,
      }));

      const combinedMap = new Map<string, OrderWithTracking>();
      dbOrders.forEach((o) => combinedMap.set(o.id, o));
      metaOrders.forEach((o) => {
        if (!combinedMap.has(o.id)) combinedMap.set(o.id, o);
      });

      return Array.from(combinedMap.values());
    },
    enabled: !!user,
  });
}
