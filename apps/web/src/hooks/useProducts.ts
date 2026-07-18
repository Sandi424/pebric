import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/client";
import { CATALOG_QUERY_OPTIONS } from "@/lib/queryCache";

export interface Product {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  price: number;
  original_price: number | null;
  image_url: string | null;
  images: string[] | null;
  sizes: string[] | null;
  pet_sizes: string[] | null;
  features: string[] | null;
  stock: number | null;
  is_featured: boolean | null;
  is_best_seller: boolean | null;
  is_new_arrival: boolean | null;
  is_active: boolean | null;
  category_id: string | null;
  collection_id: string | null;
  created_at: string | null;
  category?: {
    id: string;
    name: string;
    slug: string;
  } | null;
  collection?: {
    id: string;
    name: string;
    slug: string;
  } | null;
}

export interface Collection {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  image_url: string | null;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  description: string | null;
}

export function useProducts() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select(`
          *,
          category:categories(*),
          collection:collections(*)
        `)
        .eq("is_active", true)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as Product[];
    },
    ...CATALOG_QUERY_OPTIONS,
  });

  useEffect(() => {
    const channel = supabase
      .channel(`catalog-realtime-${Math.random().toString(36).substring(2, 9)}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "products",
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["products"] });
          queryClient.invalidateQueries({ queryKey: ["product"] });
          queryClient.invalidateQueries({ queryKey: ["product-by-id"] });
          queryClient.invalidateQueries({
            queryKey: ["products", "collection"],
          });
          queryClient.invalidateQueries({ queryKey: ["products", "best-sellers"] });
          queryClient.invalidateQueries({ queryKey: ["products", "new-arrivals"] });
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "categories",
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["categories"] });
          queryClient.invalidateQueries({ queryKey: ["products"] });
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "collections",
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["collections"] });
          queryClient.invalidateQueries({ queryKey: ["products"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  return query;
}

export function useProduct(slug: string) {
  const queryClient = useQueryClient();

  return useQuery({
    queryKey: ["product", slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select(`
          *,
          category:categories(*),
          collection:collections(*)
        `)
        .eq("slug", slug)
        .maybeSingle();

      if (error) throw error;
      return data as Product | null;
    },
    initialData: () =>
      queryClient
        .getQueryData<Product[]>(["products"])
        ?.find((product) => product.slug === slug),
    initialDataUpdatedAt: () =>
      queryClient.getQueryState(["products"])?.dataUpdatedAt,
    enabled: !!slug,
    ...CATALOG_QUERY_OPTIONS,
  });
}

export function useProductById(id: string) {
  const queryClient = useQueryClient();

  return useQuery({
    queryKey: ["product-by-id", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select(`
          *,
          category:categories(*),
          collection:collections(*)
        `)
        .eq("id", id)
        .maybeSingle();

      if (error) throw error;
      return data as Product | null;
    },
    initialData: () =>
      queryClient
        .getQueryData<Product[]>(["products"])
        ?.find((product) => product.id === id),
    initialDataUpdatedAt: () =>
      queryClient.getQueryState(["products"])?.dataUpdatedAt,
    enabled: !!id,
    ...CATALOG_QUERY_OPTIONS,
  });
}

export function useProductsByCollection(collectionSlug: string) {
  const queryClient = useQueryClient();

  // Map common frontend route slugs to actual database slugs
  const slugAliasMap: Record<string, string> = {
    "summer": "summer-vibes",
    "winter": "cozy-winter",
    "rainy": "rainy-days"
  };

  return useQuery({
    queryKey: ["products", "collection", collectionSlug],
    queryFn: async () => {
      const isSetsCategory = ["twinning", "pebric", "sets", "set"].includes(collectionSlug.toLowerCase());

      if (isSetsCategory) {
        const { data: category } = await supabase
          .from("categories")
          .select("id")
          .eq("slug", "set")
          .maybeSingle();

        if (!category) return [];

        const { data, error } = await supabase
          .from("products")
          .select(`
            *,
            category:categories(*),
            collection:collections(*)
          `)
          .eq("category_id", category.id)
          .eq("is_active", true)
          .order("created_at", { ascending: false });

        if (error) throw error;
        return data as Product[];
      }

      // 1. Try to find the collection with the exact slug first
      let { data: collection } = await supabase
        .from("collections")
        .select("id, slug")
        .eq("slug", collectionSlug)
        .maybeSingle();

      // 2. If not found, try the alias slug
      if (!collection) {
        const alias = slugAliasMap[collectionSlug];
        if (alias) {
          const { data: aliasCol } = await supabase
            .from("collections")
            .select("id, slug")
            .eq("slug", alias)
            .maybeSingle();
          collection = aliasCol;
        }
      }

      if (!collection) return [];

      const { data, error } = await supabase
        .from("products")
        .select(`
          *,
          category:categories(*),
          collection:collections(*)
        `)
        .eq("collection_id", collection.id)
        .eq("is_active", true)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as Product[];
    },
    initialData: () => {
      const cachedProducts = queryClient.getQueryData<Product[]>(["products"]);

      if (!cachedProducts) {
        return undefined;
      }

      const isSetsCategory = ["twinning", "pebric", "sets", "set"].includes(collectionSlug.toLowerCase());
      if (isSetsCategory) {
        return cachedProducts.filter(
          (product) =>
            product.is_active && product.category?.slug === "set",
        );
      }

      // Check if we have any active products in cache with the exact slug
      const hasExactMatch = cachedProducts.some(
        (product) => product.is_active && product.collection?.slug === collectionSlug
      );

      if (hasExactMatch) {
        return cachedProducts.filter(
          (product) =>
            product.is_active && product.collection?.slug === collectionSlug,
        );
      }

      // Fallback to alias if it exists
      const alias = slugAliasMap[collectionSlug];
      if (alias) {
        return cachedProducts.filter(
          (product) =>
            product.is_active && product.collection?.slug === alias,
        );
      }

      return [];
    },
    initialDataUpdatedAt: () =>
      queryClient.getQueryState(["products"])?.dataUpdatedAt,
    enabled: !!collectionSlug,
    ...CATALOG_QUERY_OPTIONS,
  });
}

export function useBestSellers() {
  const queryClient = useQueryClient();

  return useQuery({
    queryKey: ["products", "best-sellers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select(`
          *,
          category:categories(*),
          collection:collections(*)
        `)
        .eq("is_best_seller", true)
        .eq("is_active", true)
        .limit(6);

      if (error) throw error;
      return data as Product[];
    },
    initialData: () =>
      queryClient
        .getQueryData<Product[]>(["products"])
        ?.filter((product) => product.is_best_seller && product.is_active)
        .slice(0, 6),
    initialDataUpdatedAt: () =>
      queryClient.getQueryState(["products"])?.dataUpdatedAt,
    ...CATALOG_QUERY_OPTIONS,
  });
}

export function useNewArrivals() {
  const queryClient = useQueryClient();

  return useQuery({
    queryKey: ["products", "new-arrivals"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select(`
          *,
          category:categories(*),
          collection:collections(*)
        `)
        .eq("is_new_arrival", true)
        .eq("is_active", true)
        .limit(6);

      if (error) throw error;
      return data as Product[];
    },
    initialData: () =>
      queryClient
        .getQueryData<Product[]>(["products"])
        ?.filter((product) => product.is_new_arrival && product.is_active)
        .slice(0, 6),
    initialDataUpdatedAt: () =>
      queryClient.getQueryState(["products"])?.dataUpdatedAt,
    ...CATALOG_QUERY_OPTIONS,
  });
}

export function useCollections() {
  return useQuery({
    queryKey: ["collections"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("collections")
        .select("*")
        .order("name");

      if (error) throw error;
      
      const desiredCollections = [
        { name: "Rainy", slug: "rainy" },
        { name: "Summer", slug: "summer" },
        { name: "Winter", slug: "winter" }
      ];

      return desiredCollections.map((dc) => ({
        id: `col-${dc.slug}`,
        name: dc.name,
        slug: dc.slug,
        description: null,
        image_url: null,
      })) as Collection[];
    },
    staleTime: 0,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: true,
    retry: 3,
  });
}

export function useCategories() {
  return useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("categories")
        .select("*")
        .order("name");

      if (error) throw error;
      return data as Category[];
    },
    staleTime: 0,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: true,
    retry: 3,
  });
}

export function useSearchProducts(query: string) {
  return useQuery({
    queryKey: ["products", "search", query],
    queryFn: async () => {
      if (!query.trim()) return [];

      const { data, error } = await supabase
        .from("products")
        .select(`
          *,
          category:categories(*),
          collection:collections(*)
        `)
        .eq("is_active", true)
        .or(`name.ilike.%${query}%,description.ilike.%${query}%`)
        .limit(20);

      if (error) throw error;
      return data as Product[];
    },
    enabled: query.length > 0,
  });
}
