import { createClient } from '@/lib/supabase/server';

export interface DormitoryIdentity {
  name_th: string;
  name_en: string;
}

const FALLBACK: DormitoryIdentity = { name_th: '', name_en: '' };

/** The dormitory's own name (settings.dormitory), for documents that need it. */
export async function getDormitoryIdentity(): Promise<DormitoryIdentity> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('settings')
    .select('value')
    .eq('key', 'dormitory')
    .maybeSingle();

  const value = (data?.value ?? {}) as Partial<DormitoryIdentity>;
  return {
    name_th: value.name_th ?? FALLBACK.name_th,
    name_en: value.name_en ?? FALLBACK.name_en,
  };
}
