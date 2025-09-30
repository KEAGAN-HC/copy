import { Injectable } from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class SupabaseService {
  public readonly client: SupabaseClient;

  constructor(private configService: ConfigService) {
    const supabaseUrl = this.configService.get('SUPABASE_URL');
    const supabaseKey = this.configService.get('SUPABASE_ANON_KEY');

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Faltan las credenciales de Supabase en el archivo .env');
    }

    this.client = createClient(supabaseUrl, supabaseKey);
    
    console.log('✅ Cliente de Supabase inicializado correctamente');
  }
}