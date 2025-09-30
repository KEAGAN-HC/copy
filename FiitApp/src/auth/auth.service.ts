import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../config/supabase.config';
import type { User } from '@supabase/supabase-js';
import { UpdateProfileDto } from './dto/update-profile.dto';

@Injectable()
export class AuthService {
  constructor(private supabaseService: SupabaseService) {}

  async register(registerDto: { email: string; password: string; fullName: string }) {
    const { email, password, fullName } = registerDto;

    try {
      const { data: authData, error: authError } = 
        await this.supabaseService.client.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: fullName
            }
          }
        });

      if (authError) {
        throw new Error(`Error en registro: ${authError.message}`);
      }

      if (authData.user) {
        try {
          const { error: userError } = 
            await this.supabaseService.client
              .from('users')
              .insert([
                {
                  id: authData.user.id,
                  email: authData.user.email,
                  full_name: fullName,
                  created_at: new Date().toISOString(),
                }
              ]);

          if (userError) {
            console.warn('⚠️ No se pudo crear perfil en tabla users:', userError.message);
          }
        } catch (dbError) {
          console.warn('⚠️ Error al crear perfil en tabla users:', dbError.message);
        }
      }

      return {
        message: 'Usuario registrado exitosamente',
        user: authData.user,
        session: authData.session
      };

    } catch (error) {
      throw new Error(`Error en registro: ${error.message}`);
    }
  }

  async login(loginDto: { email: string; password: string }) {
    const { email, password } = loginDto;

    try {
      const { data, error } = 
        await this.supabaseService.client.auth.signInWithPassword({
          email,
          password,
        });

      if (error) {
        throw new Error(`Error en login: ${error.message}`);
      }

      return data;
    } catch (error) {
      throw new Error(`Error en login: ${error.message}`);
    }
  }

  async logout() {
    try {
      const { error } = await this.supabaseService.client.auth.signOut();
      
      if (error) {
        throw new Error(`Error en logout: ${error.message}`);
      }

      return { message: 'Logout exitoso' };
    } catch (error) {
      throw new Error(`Error en logout: ${error.message}`);
    }
  }

  async getCurrentUser(user: User) {
    try {
      console.log('Usuario recibido en servicio:', user);
      
      if (!user) {
        throw new Error('Usuario no autenticado');
      }

      try {
        const { data: userData, error: userError } = await this.supabaseService.client
          .from('users')
          .select('*')
          .eq('id', user.id)
          .single();

        if (!userError && userData) {
          return userData;
        }
      } catch (dbError) {
        console.warn('No se pudo obtener datos de tabla users:', dbError.message);
      }

      return {
        id: user.id,
        email: user.email || 'sin-email@ejemplo.com',
        full_name: user.user_metadata?.full_name || 'Usuario',
        created_at: user.created_at || new Date().toISOString()
      };

    } catch (error) {
      console.error('Error en getCurrentUser:', error.message);
      throw new Error(`Error al obtener usuario: ${error.message}`);
    }
  }

  async verifySession(accessToken: string) {
    try {
      const { data: { user }, error } = await this.supabaseService.client.auth.getUser(accessToken);
      
      if (error) {
        throw new Error(`Sesión inválida: ${error.message}`);
      }

      if (!user) {
        throw new Error('Usuario no encontrado en la sesión');
      }

      return user;
    } catch (error) {
      throw new Error(`Error verificando sesión: ${error.message}`);
    }
  }

  async getCurrentUserFromToken(accessToken: string) {
    try {
      const { data: { user }, error } = await this.supabaseService.client.auth.getUser(accessToken);
      
      if (error) {
        throw new Error(`Error obteniendo usuario: ${error.message}`);
      }

      if (!user) {
        throw new Error('Usuario no encontrado');
      }

      try {
        const { data: userData, error: dbError } = await this.supabaseService.client
          .from('users')
          .select('*')
          .eq('id', user.id)
          .single();

        if (!dbError && userData) {
          return userData;
        }
      } catch (dbError) {
        console.warn('No se pudo obtener datos adicionales de la tabla users:', dbError.message);
      }

      return {
        id: user.id,
        email: user.email || 'sin-email@ejemplo.com',
        full_name: user.user_metadata?.full_name || 'Usuario',
        created_at: user.created_at || new Date().toISOString()
      };

    } catch (error) {
      throw new Error(`Error obteniendo usuario: ${error.message}`);
    }
  }

  async updateProfile(userId: string, updateProfileDto: UpdateProfileDto) {
    try {
      if (!userId) {
        throw new Error('ID de usuario no proporcionado');
      }

      const updateData: any = {
        updated_at: new Date().toISOString()
      };

      if (updateProfileDto.fullName !== undefined) {
        updateData.full_name = updateProfileDto.fullName;
      }
      if (updateProfileDto.age !== undefined) {
        updateData.age = updateProfileDto.age;
      }
      if (updateProfileDto.weight !== undefined) {
        updateData.weight = updateProfileDto.weight;
      }
      if (updateProfileDto.height !== undefined) {
        updateData.height = updateProfileDto.height;
      }
      if (updateProfileDto.fitnessLevel !== undefined) {
        updateData.fitness_level = updateProfileDto.fitnessLevel;
      }
      if (updateProfileDto.goals !== undefined) {
        updateData.goals = updateProfileDto.goals;
      }

      if (updateProfileDto.gender !== undefined) {
        updateData.gender = updateProfileDto.gender;
      }

      console.log('Datos a actualizar:', updateData);

      const { data: existingUser, error: checkError } = await this.supabaseService.client
        .from('users')
        .select('id')
        .eq('id', userId)
        .single();

      if (checkError && checkError.code === 'PGRST116') {
        const { data: newUser, error: createError } = await this.supabaseService.client
          .from('users')
          .insert([{
            id: userId,
            email: 'temp@ejemplo.com', 
            ...updateData
          }])
          .select()
          .single();

        if (createError) {
          throw new Error(`Error creando perfil de usuario: ${createError.message}`);
        }

        return {
          id: newUser.id,
          email: newUser.email,
          full_name: newUser.full_name,
          age: newUser.age,
          weight: newUser.weight,
          height: newUser.height,
          fitness_level: newUser.fitness_level,
          goals: newUser.goals,
          gender: newUser.gender, 
          updated_at: newUser.updated_at
        };
      }

      const { data, error } = await this.supabaseService.client
        .from('users')
        .update(updateData)
        .eq('id', userId)
        .select()
        .single();

      if (error) {
        throw new Error(`Error actualizando perfil: ${error.message}`);
      }

      return {
        id: data.id,
        email: data.email,
        full_name: data.full_name,
        age: data.age,
        weight: data.weight,
        height: data.height,
        fitness_level: data.fitness_level,
        goals: data.goals,
        gender: data.gender, 
        updated_at: data.updated_at
      };

    } catch (error) {
      console.error('Error en updateProfile:', error.message);
      throw new Error(`Error actualizando perfil: ${error.message}`);
    }
  }

  private validateUserExists(user: any): user is NonNullable<typeof user> {
    return user !== null && user !== undefined;
  }
}