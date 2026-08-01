import { useState } from "react";
import { toast } from "sonner";
import { XCircle } from "lucide-react";
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

// UUID v4 pattern — orders saved via the RPC have real UUIDs;
// fallback orders use a `ord-timestamp-random` string format.
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidUUID(value: string): boolean {
  return UUID_REGEX.test(value);
}

export function CancelOrderRequestButton({ orderId, orderNumber, status }: CancelOrderRequestButtonProps) {
  const { user } = useAuth();
  const createTicket = useCreateTicket();
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

      // Only check for existing ticket using order_id if the ID is a valid UUID.
      // Passing a non-UUID value to a UUID column causes a Postgres type error.
      if (orderIdIsUUID) {
        let existingTicket = null;
        try {
          const { data: existing, error: existingError } = await supabase
            .from("support_tickets")
            .select("id")
            .eq("user_id", user.id)
            .eq("order_id", orderId)
            .eq("subject", subject)
            .maybeSingle();

          if (existingError) {
            // Log but don't block — we'll just let the insert proceed
            console.warn("Duplicate check error:", existingError.message);
          } else {
            existingTicket = existing;
          }
        } catch (checkErr) {
          console.warn("Duplicate check threw:", checkErr);
        }

        if (existingTicket) {
          toast.info("Cancellation already requested", { description: "Our team will review it shortly." });
          setRequested(true);
          return;
        }
      } else {
        // For fallback (non-UUID) order IDs, check by subject + user only
        try {
          const { data: existing } = await supabase
            .from("support_tickets")
            .select("id")
            .eq("user_id", user.id)
            .eq("subject", subject)
            .maybeSingle();

          if (existing) {
            toast.info("Cancellation already requested", { description: "Our team will review it shortly." });
            setRequested(true);
            return;
          }
        } catch (checkErr) {
          console.warn("Duplicate check threw:", checkErr);
        }
      }

      await createTicket.mutateAsync({
        subject,
        message: `Please cancel my order ${orderNumber}. Current status: ${status}.`,
        // Only pass orderId if it's a valid UUID (FK constraint requires it)
        orderId: orderIdIsUUID ? orderId : undefined,
        priority: "high",
      });

      setRequested(true);
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
