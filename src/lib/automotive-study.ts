import 'server-only';
import snapshot from '@/data/automotive-study.json';
import { pool } from './db';
import type { AutomotiveStudy } from './automotive-analysis';

export async function readAutomotiveStudy(): Promise<{ study: AutomotiveStudy; catalogOrigin: 'core' | 'snapshot' }> {
  try {
    const result = await pool().query<{ study: AutomotiveStudy }>('SELECT study FROM read_models.automotive_study ORDER BY observed_at DESC, received_at DESC LIMIT 1');
    if (result.rows[0]) return { study: result.rows[0].study, catalogOrigin: 'core' };
  } catch (error) {
    if (!['42P01', '42501'].includes((error as { code?: string }).code ?? '')) throw error;
  }
  return { study: snapshot, catalogOrigin: 'snapshot' };
}
