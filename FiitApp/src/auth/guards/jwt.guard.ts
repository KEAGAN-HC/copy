import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { SupabaseService } from '../../config/supabase.config';
import type { RequestWithUser } from '../../common/interfaces/request-with-user.interface';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private supabaseService: SupabaseService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const token = this.extractTokenFromHeader(request);

    if (!token) {
      throw new UnauthorizedException('Token no proporcionado');
    }

    try {
      const { data: { user }, error } = await this.supabaseService.client.auth.getUser(token);
      
      if (error) {
        console.error('Error verificando token:', error.message);
        throw new UnauthorizedException('Token inválido o expirado');
      }

      if (!user) {
        throw new UnauthorizedException('Usuario no encontrado');
      }

      request.user = user;
      return true;

    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new UnauthorizedException('Error de autenticación');
    }
  }

  private extractTokenFromHeader(request: RequestWithUser): string | undefined {
    const authHeader = request.headers.authorization;
    
    if (!authHeader) {
      return undefined;
    }

    const [type, token] = authHeader.split(' ');
    return type === 'Bearer' ? token : undefined;
  }
}