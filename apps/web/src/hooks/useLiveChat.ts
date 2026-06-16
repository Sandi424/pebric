import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner"; // Added toast for better error visibility

export interface ChatMessage {
  id: string;
  chat_session_id: string;
  sender_id: string;
  sender_type: "user" | "admin";
  message: string;
  created_at: string;
  is_read: boolean;
}

export interface ChatSession {
  id: string;
  user_id: string;
  status: "active" | "closed";
  created_at: string;
  updated_at: string;
  last_message?: string;
  unread_count?: number;
  user_name?: string;
  user_email?: string;
}

type ChatSessionProfile = {
  full_name: string | null;
  email: string | null;
};

type ChatSessionRow = ChatSession & {
  profile?: ChatSessionProfile | null;
};

type ChatSessionMessageMeta = {
  chat_session_id: string;
  sender_type: "user" | "admin";
  is_read: boolean;
  message: string;
  created_at: string;
};

async function fetchActiveSessionForUser(userId: string) {
  const { data, error } = await supabase
    .from("chat_sessions")
    .select("*")
    .eq("user_id", userId)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("Error fetching session:", error);
    throw error;
  }

  return data as ChatSession | null;
}

async function createChatSessionForUser(userId: string) {
  const { data, error } = await supabase
    .from("chat_sessions")
    .insert({
      user_id: userId,
      status: "active",
    })
    .select()
    .single();

  if (error) {
    console.error("Error creating session:", error);
    throw error;
  }

  return data as ChatSession;
}

/**
 * Hook to get an active chat session for the current user
 */
export function useChatSession() {
  const { user } = useAuth();

  const sessionQuery = useQuery({
    queryKey: ["chat-session", user?.id],
    queryFn: async () => {
      if (!user) return null;
      return fetchActiveSessionForUser(user.id);
    },
    enabled: !!user,
  });

  return sessionQuery;
}

/**
 * Hook to get messages for a chat session with real-time updates
 */
export function useChatMessages(sessionId: string | undefined) {
  const queryClient = useQueryClient();

  const messagesQuery = useQuery({
    queryKey: ["chat-messages", sessionId],
    queryFn: async () => {
      if (!sessionId) return [];

      const { data, error } = await supabase
        .from("chat_messages")
        .select("*")
        .eq("chat_session_id", sessionId)
        .order("created_at", { ascending: true });

      if (error) {
        console.error("Error fetching messages:", error);
        throw error;
      }
      return data as ChatMessage[];
    },
    enabled: !!sessionId,
  });

  // Subscribe to real-time updates
  useEffect(() => {
    if (!sessionId) return;

    const channel = supabase
      .channel(`chat-realtime-${sessionId}`)
      .on(
        "postgres_changes",
        {
          event: "*", // Listen for all events (INSERT, UPDATE, DELETE)
          schema: "public",
          table: "chat_messages",
          filter: `chat_session_id=eq.${sessionId}`,
        },
        () => {
          // Invalidate and re-fetch - more reliable than manual cache update
          queryClient.invalidateQueries({
            queryKey: ["chat-messages", sessionId],
          });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [sessionId, queryClient]);

  return messagesQuery;
}

/**
 * Hook to send a chat message
 */
export function useSendMessage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      sessionId,
      message,
    }: {
      sessionId?: string;
      message: string;
    }) => {
      if (!user) throw new Error("Not authenticated");
      let activeSession = sessionId
        ? ({ id: sessionId } as ChatSession)
        : await fetchActiveSessionForUser(user.id);

      if (!activeSession) {
        activeSession = await createChatSessionForUser(user.id);
        queryClient.setQueryData(["chat-session", user.id], activeSession);
      }

      const { data, error } = await supabase
        .from("chat_messages")
        .insert({
          chat_session_id: activeSession.id,
          sender_id: user.id,
          sender_type: "user",
          message,
          is_read: false,
        })
        .select()
        .single();

      if (error) throw error;

      // Update session's updated_at
      await supabase
        .from("chat_sessions")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", activeSession.id);

      return {
        message: data as ChatMessage,
        sessionId: activeSession.id,
      };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({
        queryKey: ["chat-messages", result.sessionId],
      });
      queryClient.invalidateQueries({ queryKey: ["chat-session", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["admin-chat-sessions"] });
    },
    onError: (error) => {
      console.error("Error sending message:", error);
      toast.error("Failed to send message. Please try again.");
    },
  });
}

/**
 * Hook for admin to get all active chat sessions
 */
export function useAdminChatSessions() {
  const { isAdmin } = useAuth();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!isAdmin) return;

    const channel = supabase
      .channel(`admin-chat-sessions-realtime-${Math.random().toString(36).substring(2, 9)}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "chat_sessions",
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["admin-chat-sessions"] });
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "chat_messages",
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["admin-chat-sessions"] });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isAdmin, queryClient]);

  return useQuery({
    queryKey: ["admin-chat-sessions"],
    queryFn: async () => {
      let sessions: ChatSessionRow[] | null = null;

      const { data, error } = await supabase
        .from("chat_sessions")
        .select(
          `
          *,
          profile:profiles(full_name, email)
        `,
        )
        .eq("status", "active")
        .order("updated_at", { ascending: false });

      if (error) {
        console.error("Error fetching admin session list:", error);
        if (error.message.includes("relationship")) {
          const { data: fallbackData, error: fallbackError } = await supabase
            .from("chat_sessions")
            .select("*")
            .eq("status", "active")
            .order("updated_at", { ascending: false });

          if (fallbackError) throw fallbackError;

          sessions =
            fallbackData?.map((session) => ({
              ...(session as ChatSession),
              user_name: "Customer",
              user_email: "",
            })) || [];
        } else {
          throw error;
        }
      } else {
        sessions =
          data?.map((session) => {
            const row = session as unknown as ChatSessionRow;
            return {
              ...row,
              user_name: row.profile?.full_name || "Anonymous",
              user_email: row.profile?.email || "",
            };
          }) || [];
      }

      if (!sessions || sessions.length === 0) return [];

      const sessionIds = sessions.map((session) => session.id);
      const { data: messageRows, error: messagesError } = await supabase
        .from("chat_messages")
        .select("chat_session_id, sender_type, is_read, message, created_at")
        .in("chat_session_id", sessionIds)
        .order("created_at", { ascending: false });

      if (messagesError) {
        console.error("Error fetching chat message metadata:", messagesError);
        throw messagesError;
      }

      const messageMap = new Map<string, ChatSessionMessageMeta[]>();

      (messageRows as ChatSessionMessageMeta[] | null)?.forEach((row) => {
        const existingRows = messageMap.get(row.chat_session_id) || [];
        existingRows.push(row);
        messageMap.set(row.chat_session_id, existingRows);
      });

      return sessions
        .map((session) => {
          const sessionMessages = messageMap.get(session.id) || [];
          const hasUserMessage = sessionMessages.some(
            (row) => row.sender_type === "user",
          );

          if (!hasUserMessage) return null;

          const unreadCount = sessionMessages.filter(
            (row) => row.sender_type === "user" && !row.is_read,
          ).length;

          return {
            ...session,
            last_message: sessionMessages[0]?.message || "",
            unread_count: unreadCount,
          } as ChatSession;
        })
        .filter((session): session is ChatSession => session !== null)
        .sort((a, b) => {
          const aHasUnread = (a.unread_count || 0) > 0;
          const bHasUnread = (b.unread_count || 0) > 0;

          if (aHasUnread !== bHasUnread) {
            return aHasUnread ? -1 : 1;
          }

          return (
            new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
          );
        });
    },
    enabled: isAdmin,
  });
}

/**
 * Hook for admin to send a message
 */
export function useAdminSendMessage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      sessionId,
      message,
    }: {
      sessionId: string;
      message: string;
    }) => {
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("chat_messages")
        .insert({
          chat_session_id: sessionId,
          sender_id: user.id,
          sender_type: "admin",
          message,
          is_read: false,
        })
        .select()
        .single();

      if (error) throw error;

      // Update session's updated_at
      await supabase
        .from("chat_sessions")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", sessionId);

      return data as ChatMessage;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["chat-messages", variables.sessionId],
      });
      queryClient.invalidateQueries({ queryKey: ["admin-chat-sessions"] });
    },
  });
}

/**
 * Hook to mark messages as read
 */
export function useMarkMessagesRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      sessionId,
      senderType,
    }: {
      sessionId: string;
      senderType: "user" | "admin";
    }) => {
      const otherType = senderType === "user" ? "admin" : "user";

      await supabase
        .from("chat_messages")
        .update({ is_read: true })
        .eq("chat_session_id", sessionId)
        .eq("sender_type", otherType)
        .eq("is_read", false);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["chat-messages", variables.sessionId],
      });
      queryClient.invalidateQueries({ queryKey: ["admin-chat-sessions"] });
    },
  });
}

/**
 * Hook to close a chat session
 */
export function useCloseChatSession() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (sessionId: string) => {
      const { error } = await supabase
        .from("chat_sessions")
        .update({ status: "closed" })
        .eq("id", sessionId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chat-session"] });
      queryClient.invalidateQueries({ queryKey: ["admin-chat-sessions"] });
    },
  });
}
