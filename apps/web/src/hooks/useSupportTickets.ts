import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { useRealtimeChannel } from "@/hooks/useRealtime";
import { enforceRateLimit } from "@/lib/rateLimit";

export interface SupportTicket {
  id: string;
  user_id: string | null;
  email: string;
  subject: string;
  message: string;
  status: string;
  priority: string;
  assigned_to: string | null;
  order_id: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface TicketMessage {
  id: string;
  ticket_id: string;
  user_id: string | null;
  is_staff: boolean;
  message: string;
  created_at: string;
}

export function useSupportTickets() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["support-tickets", user?.id],
    queryFn: async () => {
      if (!user) return [];
      
      const { data, error } = await supabase
        .from("support_tickets")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as SupportTicket[];
    },
    enabled: !!user,
  });

  useRealtimeChannel(
    user ? `support-tickets-realtime-${user.id}` : "support-tickets-realtime-guest",
    user ? [{ table: "support_tickets", event: "*", filter: `user_id=eq.${user.id}` }] : [],
    () => {
      if (!user) return;
      queryClient.invalidateQueries({ queryKey: ["support-tickets", user.id] });
    },
    !!user,
  );

  return query;
}


export function useTicketMessages(ticketId: string) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["ticket-messages", ticketId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ticket_messages")
        .select("*")
        .eq("ticket_id", ticketId)
        .order("created_at");

      if (error) throw error;
      return data as TicketMessage[];
    },
    enabled: !!ticketId,
  });

  // Subscribe to real-time updates
  useEffect(() => {
    if (!ticketId) return;

    const channel = supabase
      .channel(`ticket-messages-realtime-${ticketId}`)
      .on(
        "postgres_changes",
        {
          event: "*", // Listen for all events (INSERT, UPDATE, DELETE)
          schema: "public",
          table: "ticket_messages",
          filter: `ticket_id=eq.${ticketId}`,
        },
        () => {
          // Invalidate query to re-fetch full data - more robust than manual cache update
          queryClient.invalidateQueries({ queryKey: ["ticket-messages", ticketId] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [ticketId, queryClient]);

  return query;
}

export function useCreateTicket() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({
      subject,
      message,
      email,
      orderId,
      priority,
    }: {
      subject: string;
      message: string;
      email?: string;
      orderId?: string;
      priority?: string;
    }) => {
      await enforceRateLimit("support-ticket");

      const { data, error } = await supabase
        .from("support_tickets")
        .insert({
          user_id: user?.id || null,
          email: email || user?.email || '',
          subject,
          message,
          order_id: orderId || null,
          priority: priority || 'medium',
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["support-tickets"] });
      toast.success("Support ticket created", {
        description: "We'll respond within 24 hours.",
      });
    },
    onError: () => {
      toast.error("Failed to create support ticket");
    },
  });
}

export function useAddTicketMessage() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({
      ticketId,
      message,
      isStaff = false,
    }: {
      ticketId: string;
      message: string;
      isStaff?: boolean;
    }) => {
      const { data, error } = await supabase
        .from("ticket_messages")
        .insert({
          ticket_id: ticketId,
          user_id: user?.id || null,
          message,
          is_staff: isStaff,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["ticket-messages", variables.ticketId] });
    },
    onError: () => {
      toast.error("Failed to send message");
    },
  });
}

export function useAdminTickets() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["admin-tickets"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("support_tickets")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as SupportTicket[];
    },
  });

  useEffect(() => {
    const channel = supabase
      .channel(`admin-tickets-realtime-${Math.random().toString(36).substring(2, 9)}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "support_tickets",
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["admin-tickets"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  return query;
}

export function useUpdateTicketStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      ticketId,
      status,
      assignedTo,
    }: {
      ticketId: string;
      status: string;
      assignedTo?: string;
    }) => {
      const updates: Record<string, unknown> = { status };
      if (assignedTo) updates.assigned_to = assignedTo;
      if (status === 'resolved') updates.resolved_at = new Date().toISOString();

      const { error } = await supabase
        .from("support_tickets")
        .update(updates)
        .eq("id", ticketId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-tickets"] });
      queryClient.invalidateQueries({ queryKey: ["support-tickets"] });
      toast.success("Ticket updated");
    },
    onError: () => {
      toast.error("Failed to update ticket");
    },
  });
}
