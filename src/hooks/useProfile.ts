import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface Profile {
  id: string;
  user_id: string;
  nome: string;
  cargo: "super_admin" | "gestor" | "veterinario";
  clinic_id: string | null;
  crmv: string | null;
  uf_crmv: string | null;
  telefone: string | null;
  especialidade: string | null;
  created_at: string;
  updated_at: string;
}

export interface Clinic {
  id: string;
  nome_fantasia: string;
  endereco: string | null;
  telefone: string | null;
  logo_url: string | null;
  created_at: string;
  updated_at: string;
}

export function useProfile() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [clinic, setClinic] = useState<Clinic | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setProfile(null);
      setClinic(null);
      setLoading(false);
      return;
    }

    const fetchProfile = async () => {
      setLoading(true);
      
      // Fetch profile
      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (profileError) {
        console.error("Error fetching profile:", profileError);
        setLoading(false);
        return;
      }

      if (profileData) {
        setProfile(profileData as Profile);

        // Fetch clinic if profile has clinic_id
        if (profileData.clinic_id) {
          const { data: clinicData, error: clinicError } = await supabase
            .from("clinics")
            .select("*")
            .eq("id", profileData.clinic_id)
            .maybeSingle();

          if (clinicError) {
            console.error("Error fetching clinic:", clinicError);
          } else if (clinicData) {
            setClinic(clinicData as Clinic);
          }
        }
      }

      setLoading(false);
    };

    fetchProfile();
  }, [user]);

  const updateClinic = async (updates: Partial<Clinic>) => {
    if (!clinic) return { error: new Error("No clinic found") };

    const { error } = await supabase
      .from("clinics")
      .update(updates)
      .eq("id", clinic.id);

    if (!error) {
      setClinic({ ...clinic, ...updates });
    }

    return { error };
  };

  const isGestor = profile?.cargo === "gestor" || profile?.cargo === "super_admin";

  return { profile, clinic, loading, updateClinic, isGestor };
}
