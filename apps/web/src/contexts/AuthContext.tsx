import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/client";

interface Profile {
  id: string;
  email: string | null;
  full_name: string | null;
  phone: string | null;
  avatar_url: string | null;
  address: string | null;
  city: string | null;
  postal_code: string | null;
  country: string | null;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  isLoading: boolean;
  isAdmin: boolean;
  signUp: (
    email: string,
    password: string,
    fullName: string,
  ) => Promise<{ data: any; error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  updateProfile: (
    updates: Partial<Profile>,
  ) => Promise<{ error: Error | null }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  const fetchProfile = async (userId: string) => {
    const { data: authUser } = await supabase.auth.getUser();
    const metadata = authUser?.user?.user_metadata || {};
    const metadataName = metadata.full_name;
    const metadataPhone = metadata.phone;
    const metadataAvatar = metadata.avatar_url;

    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle();

    if (!error) {
      if (data) {
        // If profile exists but some fields are null and we have them in metadata, sync them
        const needsSync: Record<string, string> = {};
        if (!data.full_name && metadataName) needsSync.full_name = metadataName;
        if (!data.phone && metadataPhone) needsSync.phone = metadataPhone;
        if (!data.avatar_url && metadataAvatar) needsSync.avatar_url = metadataAvatar;

        if (Object.keys(needsSync).length > 0) {
          const { data: updatedData } = await supabase
            .from("profiles")
            .update(needsSync)
            .eq("id", userId)
            .select()
            .single();
          if (updatedData) {
            setProfile(updatedData);
          } else {
            // Even if update fails, merge metadata values into the profile locally
            setProfile({ ...data, ...needsSync });
          }
        } else {
          setProfile(data);
        }
      } else {
        // If profile row does not exist yet in DB, create it
        const { data: newData } = await supabase
          .from("profiles")
          .insert({
            id: userId,
            email: authUser?.user?.email,
            full_name: metadataName || null,
            phone: metadataPhone || null,
            avatar_url: metadataAvatar || null,
          })
          .select()
          .maybeSingle();

        if (newData) {
          setProfile(newData);
        } else {
          setProfile({
            id: userId,
            email: authUser?.user?.email || null,
            full_name: metadataName || null,
            phone: metadataPhone || null,
            avatar_url: metadataAvatar || null,
            address: null,
            city: null,
            postal_code: null,
            country: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          } as Profile);
        }
      }
    } else {
      // If error querying profiles table, construct profile from auth metadata
      setProfile({
        id: userId,
        email: authUser?.user?.email || null,
        full_name: metadataName || null,
        phone: metadataPhone || null,
        avatar_url: metadataAvatar || null,
        address: null,
        city: null,
        postal_code: null,
        country: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      } as Profile);
    }
  };

  const checkAdminRole = async (userId: string) => {
    const { data, error } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();

    if (!error && data) {
      setIsAdmin(true);
    } else {
      setIsAdmin(false);
    }
  };

  useEffect(() => {
    let cancelled = false;

    const loadUserData = (userId: string) => {
      void Promise.all([fetchProfile(userId), checkAdminRole(userId)]);
    };

    // INITIAL_SESSION is emitted by onAuthStateChange after getSession(); avoid duplicate work.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (cancelled) return;

      setSession(session);
      setUser(session?.user ?? null);

      if (session?.user) {
        if (event !== "INITIAL_SESSION") {
          setTimeout(() => {
            if (!cancelled) loadUserData(session.user.id);
          }, 0);
        }
      } else {
        setProfile(null);
        setIsAdmin(false);
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (cancelled) return;

      setSession(session);
      setUser(session?.user ?? null);

      if (session?.user) {
        loadUserData(session.user.id);
      }

      setIsLoading(false);
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  const signUp = async (email: string, password: string, fullName: string) => {
    const redirectUrl = `${window.location.origin}/`;

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          full_name: fullName,
        },
      },
    });

    // If signup successful, create the profile with the name
    if (!error && data.user) {
      await supabase.from("profiles").upsert({
        id: data.user.id,
        email: email,
        full_name: fullName,
      });
    }

    return { data, error };
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    return { error };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setProfile(null);
    setIsAdmin(false);
  };

  const updateProfile = async (updates: Partial<Profile>) => {
    if (!user) return { error: new Error("Not authenticated") };

    // Always sync name/phone to auth metadata for resilience
    const metadataUpdates: Record<string, unknown> = {};
    if (updates.full_name !== undefined) metadataUpdates.full_name = updates.full_name;
    if (updates.phone !== undefined) metadataUpdates.phone = updates.phone;
    if (updates.avatar_url !== undefined) metadataUpdates.avatar_url = updates.avatar_url;
    if (Object.keys(metadataUpdates).length > 0) {
      try {
        await supabase.auth.updateUser({ data: metadataUpdates });
      } catch (err) {
        console.warn("Could not sync auth metadata:", err);
      }
    }

    // Try UPDATE first — this works cleanly with user-level RLS policies
    const { data: updatedData, error: updateError } = await supabase
      .from("profiles")
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id)
      .select()
      .maybeSingle();

    if (!updateError && updatedData) {
      setProfile(updatedData);
      return { error: null };
    }

    // If update returned no data (RLS may block RETURNING), try refetching
    if (!updateError && !updatedData) {
      const { data: refetchedData } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .maybeSingle();
      if (refetchedData) {
        setProfile(refetchedData);
        return { error: null };
      }
    }

    // Try UPSERT as fallback (handles both insert and update)
    const { data: upsertedData, error: upsertError } = await supabase
      .from("profiles")
      .upsert({
        id: user.id,
        email: user.email,
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .select()
      .maybeSingle();

    if (!upsertError && upsertedData) {
      setProfile(upsertedData);
      return { error: null };
    }

    // If upsert also failed, but we synced metadata successfully, consider it a partial success
    if (Object.keys(metadataUpdates).length > 0) {
      // Update local profile state with the changes even if DB update failed
      setProfile((prev) => prev ? { ...prev, ...updates } : null);
      return { error: null };
    }

    return { error: upsertError || updateError };
  };


  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        isLoading,
        isAdmin,
        signUp,
        signIn,
        signOut,
        updateProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
