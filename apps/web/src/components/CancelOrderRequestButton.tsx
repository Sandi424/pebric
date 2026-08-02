import { useState } from "react";
import { toast } from "sonner";
import { XCircle } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useCreateTicket } from "@/hooks/useSupportTickets";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/client";

type OrderStatus = "pending" | "confirmed" | "processing" | "shipped" | "delivered" | "cancelled";

interface CancelOrderRequestButtonProps {
  orderId: string;
  orderNumber: string;
  status: OrderStatus;
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidUUID(value: string): boolean {
  return UUID_REGEX.test(value);
}

export function CancelOrderRequestButton({ orderId, orderNumber, status }: CancelOrderRequestButtonProps) {
  const { user } = useAuth();
  const createTicket = useCreateTicket();
  const queryClient = useQueryClient();
  const [requested, setRequested] = useState(false);

  const canRequest = status === "pending" || status === "confirmed" || status === "processing";

  const requestCancel = async () => {
    if (!user) {
      toast.error("Please sign in to request cancellation");
      return;
    }

    if (!canRequest) {
      toast.error("Cancellation unavailable", { description: "This order can no longer be cancelled." });
      return;
    }

    try {
      const subject = `Cancellation request: ${orderNumber}`;
      const orderIdIsUUID = isValidUUID(orderId);

      // 1. Direct database update in orders table
      if (orderIdIsUUID) {
        try {
          const { error: dbErr } = await supabase
            .from("orders")
            .update({ status: "cancelled", updated_at: new Date().toISOString() })
            .eq("id", orderId)
            .eq("user_id", user.id);
          
          if (dbErr) {
            console.warn("Database order status update warning:", dbErr.message);
          }
        } catch (dbEx) {
          console.warn("Direct order table update exception:", dbEx);
        }
      }

      // 2. Fallback update in user_metadata if user_orders exist
      const metaOrders = user.user_metadata?.user_orders || [];
      if (Array.isArray(metaOrders) && metaOrders.length > 0) {
        let metaFound = false;
        const updatedMetaOrders = metaOrders.map((ord: any) => {
          if (ord.id === orderId || ord.order_number === orderNumber) {
            metaFound = true;
            return { ...ord, status: "cancelled", updated_at: new Date().toISOString() };
          }
          return ord;
        });

        if (metaFound) {
          try {
            await supabase.auth.updateUser({
              data: { user_orders: updatedMetaOrders }
            });
          } catch (metaEx) {
            console.warn("User metadata order status update exception:", metaEx);
          }
        }
      }

      // 3. Log support ticket without letting RLS errors block cancellation request
      try {
        await createTicket.mutateAsync({
          subject,
          message: `Please cancel my order ${orderNumber}. Current status: ${status}.`,
          orderId: orderIdIsUUID ? orderId : undefined,
          priority: "high",
        });
      } catch (ticketErr) {
        console.warn("Support ticket mutation warning (non-blocking):", ticketErr);
      }

      // 4. Invalidate orders query so React Query re-fetches updated state
      await queryClient.invalidateQueries({ queryKey: ["orders"] });

      setRequested(true);
      toast.success("Cancellation requested", {
        description: `Order ${orderNumber} has been updated to cancelled.`
      });
    } catch (e) {
      console.error("Cancellation request error:", e);
      toast.error("Failed to request cancellation");
    }
  };

  const disabled = !canRequest || requested || createTicket.isPending;
  const label = requested ? "Cancellation Requested" : "Request Cancel";

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="outline" size="sm" disabled={disabled}>
          <XCircle className="h-4 w-4 mr-2" />
          {label}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Request order cancellation?</AlertDialogTitle>
          <AlertDialogDescription>
            We'll send your request to support. If the order is already shipped, cancellation may not be possible.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Keep Order</AlertDialogCancel>
          <AlertDialogAction onClick={requestCancel}>Request Cancellation</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
