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
    const metadataName = authUser?.user?.user_metadata?.full_name;

    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle();

    if (!error) {
      if (data) {
        // If profile exists but name is null and we have it in metadata, sync it
        if (!data.full_name && metadataName) {
          const { data: updatedData } = await supabase
            .from("profiles")
            .update({ full_name: metadataName })
            .eq("id", userId)
            .select()
            .single();
          if (updatedData) {
            setProfile(updatedData);
          } else {
            setProfile(data);
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
            phone: null,
            avatar_url: null,
            address: null,
            city: null,
            postal_code: null,
            country: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          } as Profile);
        }
      }
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
      if (updates.full_name !== undefined) {
        try {
          await supabase.auth.updateUser({
            data: { full_name: updates.full_name },
          });
        } catch (err) {
          console.warn("Could not sync auth metadata:", err);
        }
      }
      return { error: null };
    }

    // If row didn't exist, INSERT it
    if (!updatedData || (updateError && (updateError.code === "PGRST116" || updateError.message?.includes("no rows")))) {
      const { data: insertedData, error: insertError } = await supabase
        .from("profiles")
        .insert({
          id: user.id,
          email: user.email,
          ...updates,
        })
        .select()
        .maybeSingle();

      if (!insertError && insertedData) {
        setProfile(insertedData);
        if (updates.full_name !== undefined) {
          try {
            await supabase.auth.updateUser({
              data: { full_name: updates.full_name },
            });
          } catch (err) {
            console.warn("Could not sync auth metadata:", err);
          }
        }
        return { error: null };
      }

      return { error: insertError || updateError };
    }

    return { error: updateError };
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
