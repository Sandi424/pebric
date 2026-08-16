import { useState } from "react";
import { toast } from "sonner";
import { XCircle, Loader2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useCreateTicket } from "@/hooks/useSupportTickets";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/client";
import {
  getLocalCancelledIds,
  saveLocalCancelledIds,
  getLocalOrders,
  saveLocalOrders,
} from "@/hooks/useOrders";

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
  const [isOpen, setIsOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const canRequest = status === "pending" || status === "confirmed" || status === "processing";

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (open) {
      setReason("");
    }
  };

  const requestCancel = async () => {
    if (!user) {
      toast.error("Please sign in to request cancellation");
      return;
    }

    if (!canRequest) {
      toast.error("Cancellation unavailable", { description: "This order can no longer be cancelled." });
      return;
    }

    setIsSubmitting(true);

    try {
      const subject = `Cancellation request: ${orderNumber}`;
      const orderIdIsUUID = isValidUUID(orderId);
      const cancellationReason = reason.trim() || "Customer requested cancellation";

      // 1. Immediately update localStorage for instant & persistent status transition
      try {
        const localCancelled = getLocalCancelledIds(user.id);
        const updatedLocalCancelled = Array.from(new Set([...localCancelled, orderId, orderNumber]));
        saveLocalCancelledIds(user.id, updatedLocalCancelled);

        const localOrders = getLocalOrders(user.id);
        const updatedLocalOrders = localOrders.map((ord: any) => {
          if (ord.id === orderId || ord.order_number === orderNumber) {
            return { ...ord, status: "cancelled", updated_at: new Date().toISOString() };
          }
          return ord;
        });
        saveLocalOrders(user.id, updatedLocalOrders);
      } catch (localErr) {
        console.warn("Local storage cancellation update warning:", localErr);
      }

      // 2. Direct database update in orders table
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

      // 3. Sync cancelled order IDs and user_orders in auth user_metadata using fresh session user
      try {
        const { data: userData } = await supabase.auth.getUser();
        const freshUser = userData?.user || user;
        const metaOrders = freshUser.user_metadata?.user_orders || [];
        const existingCancelledIds = freshUser.user_metadata?.cancelled_order_ids || [];
        const updatedCancelledIds = Array.from(new Set([...existingCancelledIds, orderId, orderNumber]));

        const updatedMetaOrders = metaOrders.map((ord: any) => {
          if (ord.id === orderId || ord.order_number === orderNumber) {
            return { ...ord, status: "cancelled", updated_at: new Date().toISOString() };
          }
          return ord;
        });

        await supabase.auth.updateUser({
          data: {
            user_orders: updatedMetaOrders,
            cancelled_order_ids: updatedCancelledIds,
          },
        });
      } catch (metaEx) {
        console.warn("User metadata order status update exception:", metaEx);
      }

      // 4. Log support ticket
      try {
        await createTicket.mutateAsync({
          subject,
          message: `Cancellation requested for order ${orderNumber}. Reason: ${cancellationReason}. Current status: ${status}.`,
          orderId: orderIdIsUUID ? orderId : undefined,
          priority: "high",
        });
      } catch (ticketErr) {
        console.warn("Support ticket mutation warning (non-blocking):", ticketErr);
      }

      // 5. Invalidate orders query
      await queryClient.invalidateQueries({ queryKey: ["orders"] });

      setIsOpen(false);
      setReason("");
      toast.success("Order Cancelled", {
        description: `Order ${orderNumber} has been cancelled successfully.`
      });
    } catch (e) {
      console.error("Cancellation request error:", e);
      toast.error("Failed to request cancellation");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!canRequest) {
    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <XCircle className="h-4 w-4 mr-2" />
          Request Cancel
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Request Order Cancellation</DialogTitle>
          <DialogDescription>
            Are you sure you want to cancel order #{orderNumber}? Please provide a reason below.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4 space-y-2">
          <Label htmlFor="cancel-reason">Reason for cancellation (optional)</Label>
          <Textarea
            id="cancel-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Changed my mind, ordered wrong size..."
            rows={3}
          />
        </div>
        <DialogFooter className="flex gap-2">
          <Button variant="outline" onClick={() => setIsOpen(false)} disabled={isSubmitting}>
            Keep Order
          </Button>
          <Button variant="destructive" onClick={requestCancel} disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Submitting...
              </>
            ) : (
              "Confirm Cancellation"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
