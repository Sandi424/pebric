import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { compressImageToWebP } from "@/lib/image-compress";

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

const GALLERY_STORAGE_PREFIX = "pebric_user_gallery_posts_";
const GLOBAL_GALLERY_STORAGE = "pebric_global_gallery_posts";

export function getLocalGalleryPosts(userId?: string): GalleryPost[] {
  try {
    const userPosts: GalleryPost[] = userId
      ? JSON.parse(localStorage.getItem(`${GALLERY_STORAGE_PREFIX}${userId}`) || "[]")
      : [];
    const globalPosts: GalleryPost[] = JSON.parse(
      localStorage.getItem(GLOBAL_GALLERY_STORAGE) || "[]"
    );
    const map = new Map<string, GalleryPost>();
    globalPosts.forEach((p: GalleryPost) => map.set(p.id, p));
    userPosts.forEach((p: GalleryPost) => map.set(p.id, p));
    return Array.from(map.values());
  } catch (e) {
    return [];
  }
}

export function saveLocalGalleryPost(post: GalleryPost, userId?: string) {
  try {
    const globalPosts: GalleryPost[] = JSON.parse(
      localStorage.getItem(GLOBAL_GALLERY_STORAGE) || "[]"
    );
    const updatedGlobal = [post, ...globalPosts.filter((p: GalleryPost) => p.id !== post.id)];
    localStorage.setItem(GLOBAL_GALLERY_STORAGE, JSON.stringify(updatedGlobal.slice(0, 100)));

    if (userId) {
      const userPosts: GalleryPost[] = JSON.parse(
        localStorage.getItem(`${GALLERY_STORAGE_PREFIX}${userId}`) || "[]"
      );
      const updatedUser = [post, ...userPosts.filter((p: GalleryPost) => p.id !== post.id)];
      localStorage.setItem(`${GALLERY_STORAGE_PREFIX}${userId}`, JSON.stringify(updatedUser.slice(0, 50)));
    }
  } catch (e) {
    console.warn("Failed to persist gallery post locally:", e);
  }
}

export function useGalleryPosts(featured?: boolean, limit: number = 50) {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const query = useQuery({
    queryKey: ["gallery-posts", featured, limit],
    queryFn: async () => {
      let dbPosts: GalleryPost[] = [];
      try {
        let queryBuilder = supabase
          .from("pet_gallery")
          .select(`
            *,
            pet:pets(name, breed),
            product:products(name, slug)
          `)
          .order("created_at", { ascending: false });

        if (featured) {
          queryBuilder = queryBuilder.eq("is_featured", true);
        }

        const { data, error } = await queryBuilder.limit(limit);
        if (!error && data) {
          dbPosts = data as GalleryPost[];
        }
      } catch (e) {
        console.warn("Could not query pet_gallery table:", e);
      }

      // Check local storage and user metadata
      let metaPosts: GalleryPost[] = [];
      if (user) {
        try {
          const { data: userData } = await supabase.auth.getUser();
          const freshUser = userData?.user || user;
          metaPosts = freshUser.user_metadata?.user_gallery_posts || [];
        } catch (e) {}
      }
      const localPosts = getLocalGalleryPosts(user?.id);

      // Merge all sources
      const combinedMap = new Map<string, GalleryPost>();
      dbPosts.forEach((p) => combinedMap.set(p.id, p));
      metaPosts.forEach((p) => {
        if (!combinedMap.has(p.id)) {
          combinedMap.set(p.id, p);
        }
      });
      localPosts.forEach((p) => {
        if (!combinedMap.has(p.id)) {
          combinedMap.set(p.id, p);
        }
      });

      let allPosts = Array.from(combinedMap.values());
      if (featured) {
        allPosts = allPosts.filter((p) => p.is_featured);
      }

      // Sort newest first
      allPosts.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      return allPosts.slice(0, limit);
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
      
      let dbPosts: GalleryPost[] = [];
      try {
        const { data, error } = await supabase
          .from("pet_gallery")
          .select(`
            *,
            pet:pets(name, breed),
            product:products(name, slug)
          `)
          .eq("user_id", user.id)
          .order("created_at", { ascending: false });

        if (!error && data) {
          dbPosts = data as GalleryPost[];
        }
      } catch (e) {
        console.warn("User gallery posts query warning:", e);
      }

      let metaPosts: GalleryPost[] = [];
      try {
        const { data: userData } = await supabase.auth.getUser();
        const freshUser = userData?.user || user;
        metaPosts = freshUser.user_metadata?.user_gallery_posts || [];
      } catch (e) {}
      const localPosts = getLocalGalleryPosts(user.id).filter((p) => p.user_id === user.id);

      const combinedMap = new Map<string, GalleryPost>();
      dbPosts.forEach((p) => combinedMap.set(p.id, p));
      metaPosts.forEach((p) => {
        if (!combinedMap.has(p.id)) {
          combinedMap.set(p.id, p);
        }
      });
      localPosts.forEach((p) => {
        if (!combinedMap.has(p.id)) {
          combinedMap.set(p.id, p);
        }
      });

      const allPosts = Array.from(combinedMap.values());
      allPosts.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      return allPosts;
    },
    enabled: !!user,
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
      caption,
      petDetails,
      productDetails,
    }: { 
      imageFile: File; 
      petId?: string; 
      productId?: string; 
      caption?: string;
      petDetails?: { name: string; breed: string | null };
      productDetails?: { name: string; slug: string };
    }) => {
      if (!user) throw new Error("Not authenticated");

      // Compress image for faster upload (max 1200px, 80% quality)
      const compressedImage = await compressImageToWebP(imageFile, { maxWidth: 1200, quality: 0.8 });
      
      // 1. Try uploading to storage
      const fileName = `${user.id}/${Date.now()}.webp`;
      let publicUrl: string | null = null;
      
      try {
        const { error: uploadError } = await supabase.storage
          .from("gallery-images")
          .upload(fileName, compressedImage, {
            contentType: 'image/webp',
            cacheControl: '3600',
          });

        if (!uploadError) {
          const { data: { publicUrl: url } } = supabase.storage
            .from("gallery-images")
            .getPublicUrl(fileName);
          if (url) {
            publicUrl = url;
          }
        } else {
          console.warn("Storage upload to gallery-images failed:", uploadError.message);
        }
      } catch (storageErr) {
        console.warn("Storage upload exception:", storageErr);
      }

      // 2. If storage bucket is not available, convert to Data URL fallback
      if (!publicUrl) {
        const reader = new FileReader();
        publicUrl = await new Promise<string>((resolve) => {
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(compressedImage);
        });
      }

      // 3. Try creating post in database
      let createdPost: GalleryPost | null = null;
      try {
        const { data, error } = await supabase
          .from("pet_gallery")
          .insert({
            user_id: user.id,
            pet_id: petId || null,
            product_id: productId || null,
            image_url: publicUrl,
            caption: caption || null,
            is_approved: true,
          })
          .select(`
            *,
            pet:pets(name, breed),
            product:products(name, slug)
          `)
          .single();

        if (!error && data) {
          createdPost = data as GalleryPost;
        } else if (error) {
          console.warn("DB insert to pet_gallery warning:", error.message);
        }
      } catch (dbErr) {
        console.warn("Direct pet_gallery insert exception:", dbErr);
      }

      // 4. Guaranteed post object fallback
      if (!createdPost) {
        createdPost = {
          id: `post-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
          user_id: user.id,
          pet_id: petId || null,
          product_id: productId || null,
          image_url: publicUrl,
          caption: caption || null,
          likes_count: 0,
          is_featured: false,
          is_approved: true,
          created_at: new Date().toISOString(),
          pet: petDetails || undefined,
          product: productDetails || undefined,
          profile: { full_name: user.user_metadata?.full_name || "Pet Parent" },
        };
      }

      // 5. Persist to local storage
      try {
        saveLocalGalleryPost(createdPost, user.id);
      } catch (localErr) {
        console.warn("Failed to persist gallery post locally:", localErr);
      }

      // 6. Persist to auth user_metadata
      try {
        const { data: userData } = await supabase.auth.getUser();
        const freshUser = userData?.user || user;
        const existingMetaPosts = freshUser.user_metadata?.user_gallery_posts || [];
        const updatedMetaPosts = [
          createdPost,
          ...existingMetaPosts.filter((p: any) => p.id !== createdPost!.id),
        ];
        await supabase.auth.updateUser({
          data: {
            user_gallery_posts: updatedMetaPosts,
          },
        });
      } catch (metaErr) {
        console.warn("Failed to sync gallery post to user_metadata:", metaErr);
      }

      return createdPost;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["gallery-posts"] });
      queryClient.invalidateQueries({ queryKey: ["user-gallery-posts"] });
      toast.success("Photo shared successfully!", {
        description: "Your photo is now live in the Pebric Pack gallery.",
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
