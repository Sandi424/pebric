import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export interface GalleryPost {
  id: string;
  user_id: string;
  pet_id: string | null;
  product_id: string | null;
  image_url: string;
  caption: string | null;
  likes_count: number;
  is_featured: boolean;
  is_approved: boolean;
  created_at: string;
  pet?: { name: string; breed: string | null };
  product?: { name: string; slug: string };
  profile?: { full_name: string | null };
}

export interface GalleryComment {
  id: string;
  user_id: string;
  gallery_post_id: string;
  content: string;
  created_at: string;
  profile?: { full_name: string | null };
}

export function useGalleryPosts(featured?: boolean, limit: number = 50) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["gallery-posts", featured],
    queryFn: async () => {
      let query = supabase
        .from("pet_gallery")
        .select(`
          *,
          pet:pets(name, breed),
          product:products(name, slug)
        `)
        .eq("is_approved", true)
        .order("created_at", { ascending: false });

      if (featured) {
        query = query.eq("is_featured", true);
      }

      const { data, error } = await query.limit(limit);
      if (error) throw error;
      return data as GalleryPost[];
    },
  });

  useEffect(() => {
    const channel = supabase
      .channel(`gallery-posts-realtime-${Math.random().toString(36).substring(2, 9)}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "pet_gallery",
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["gallery-posts"] });
          queryClient.invalidateQueries({ queryKey: ["user-gallery-posts"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  return query;
}

export function useUserGalleryPosts() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["user-gallery-posts", user?.id],
    queryFn: async () => {
      if (!user) return [];
      
      const { data, error } = await supabase
        .from("pet_gallery")
        .select(`
          *,
          pet:pets(name, breed),
          product:products(name, slug)
        `)
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as GalleryPost[];
    },
    enabled: !!user,
  });
}

/**
 * Compress image before upload for faster uploads
 */
async function compressImage(file: File, maxWidth = 1200, quality = 0.8): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let { width, height } = img;
      
      // Scale down if larger than maxWidth
      if (width > maxWidth) {
        height = (height * maxWidth) / width;
        width = maxWidth;
      }
      
      canvas.width = width;
      canvas.height = height;
      
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Failed to get canvas context'));
        return;
      }
      
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else reject(new Error('Failed to compress image'));
        },
        'image/jpeg',
        quality
      );
    };
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = URL.createObjectURL(file);
  });
}

export function useCreateGalleryPost() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ 
      imageFile, 
      petId, 
      productId, 
      caption 
    }: { 
      imageFile: File; 
      petId?: string; 
      productId?: string; 
      caption?: string;
    }) => {
      if (!user) throw new Error("Not authenticated");

      // Compress image for faster upload (max 1200px, 80% quality)
      const compressedImage = await compressImage(imageFile);
      
      // Upload compressed image
      const fileName = `${user.id}/${Date.now()}.jpg`;
      
      const { error: uploadError } = await supabase.storage
        .from("gallery-images")
        .upload(fileName, compressedImage, {
          contentType: 'image/jpeg',
          cacheControl: '3600',
        });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("gallery-images")
        .getPublicUrl(fileName);

      // Create post
      const { data, error } = await supabase
        .from("pet_gallery")
        .insert({
          user_id: user.id,
          pet_id: petId || null,
          product_id: productId || null,
          image_url: publicUrl,
          caption: caption || null,
          is_approved: false,
        })
        .select()
        .single();

      if (error) throw error;

      const { error: moderationError } = await supabase.functions.invoke(
        "moderate-image",
        {
          body: {
            imageUrl: publicUrl,
            galleryPostId: data.id,
          },
        },
      );

      if (moderationError) {
        console.warn(
          "Gallery post created but moderation trigger failed:",
          moderationError,
        );
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["gallery-posts"] });
      queryClient.invalidateQueries({ queryKey: ["user-gallery-posts"] });
      toast.success("Photo uploaded!", {
        description: "Your photo is awaiting review before it appears publicly.",
      });
    },
    onError: (error) => {
      toast.error("Failed to upload", { description: error.message });
    },
  });
}

export function useGalleryComments(postId: string) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["gallery-comments", postId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("gallery_comments")
        .select("*")
        .eq("gallery_post_id", postId)
        .order("created_at", { ascending: true });

      if (error) throw error;
      return data as GalleryComment[];
    },
    enabled: !!postId,
  });

  useEffect(() => {
    if (!postId) return;

    const channel = supabase
      .channel(`gallery-comments-realtime-${postId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "gallery_comments",
          filter: `gallery_post_id=eq.${postId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["gallery-comments", postId] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [postId, queryClient]);

  return query;
}

export function useAddGalleryComment() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ postId, content }: { postId: string; content: string }) => {
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("gallery_comments")
        .insert({
          user_id: user.id,
          gallery_post_id: postId,
          content,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["gallery-comments", variables.postId] });
    },
  });
}

export function useLikeGalleryPost() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (postId: string) => {
      if (!user) throw new Error("Not authenticated");

      // Check if already liked
      const { data: existing } = await supabase
        .from("gallery_likes")
        .select("id")
        .eq("user_id", user.id)
        .eq("gallery_post_id", postId)
        .maybeSingle();

      if (existing) {
        // Unlike - just remove the like row
        const { error } = await supabase.from("gallery_likes").delete().eq("id", existing.id);
        if (error) throw error;
        return { liked: false };
      } else {
        // Like - just insert a like row
        const { error } = await supabase.from("gallery_likes").insert({
          user_id: user.id,
          gallery_post_id: postId,
        });
        if (error) throw error;
        return { liked: true };
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["gallery-posts"] });
      queryClient.invalidateQueries({ queryKey: ["gallery-like"] });
      queryClient.invalidateQueries({ queryKey: ["gallery-likes-count"] });
    },
  });
}

export function usePostLikesCount(postId: string) {
  return useQuery({
    queryKey: ["gallery-likes-count", postId],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("gallery_likes")
        .select("*", { count: "exact", head: true })
        .eq("gallery_post_id", postId);

      if (error) throw error;
      return count || 0;
    },
    enabled: !!postId,
  });
}

export function useIsPostLiked(postId: string) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["gallery-like", postId, user?.id],
    queryFn: async () => {
      if (!user) return false;
      
      const { data } = await supabase
        .from("gallery_likes")
        .select("id")
        .eq("user_id", user.id)
        .eq("gallery_post_id", postId)
        .maybeSingle();

      return !!data;
    },
    enabled: !!user && !!postId,
  });
}

export function usePetOfTheWeek() {
  return useQuery({
    queryKey: ["pet-of-the-week"],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0];
      
      const { data, error } = await supabase
        .from("pet_of_the_week")
        .select(`
          *,
          gallery_post:pet_gallery(
            *,
            pet:pets(name, breed)
          )
        `)
        .lte("week_start", today)
        .gte("week_end", today)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
  });
}
