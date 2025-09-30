import { Controller, Post, Body, Get, Req, UsePipes, ValidationPipe, UseGuards, Put } from '@nestjs/common';
import type { Request } from 'express';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { JwtAuthGuard } from './guards/jwt.guard';
import type { RequestWithUser } from '../common/interfaces/request-with-user.interface';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @UsePipes(new ValidationPipe({ whitelist: true }))
  async register(@Body() registerDto: RegisterDto) {
    try {
      const result = await this.authService.register(registerDto);
      return {
        success: true,
        message: 'Usuario registrado exitosamente',
        data: result
      };
    } catch (error) {
      return {
        success: false,
        message: error.message
      };
    }
  }

  @Post('login')
  @UsePipes(new ValidationPipe({ whitelist: true }))
  async login(@Body() loginDto: LoginDto) {
    try {
      const result = await this.authService.login(loginDto);
      return {
        success: true,
        message: 'Login exitoso',
        data: result
      };
    } catch (error) {
      return {
        success: false,
        message: error.message
      };
    }
  }

  @Post('logout')
  async logout() {
    try {
      const result = await this.authService.logout();
      return {
        success: true,
        message: 'Logout exitoso',
        data: result
      };
    } catch (error) {
      return {
        success: false,
        message: error.message
      };
    }
  }

  @Get('profile')
  @UseGuards(JwtAuthGuard)
  async getProfile(@Req() request: RequestWithUser) {
    try {
      console.log('Usuario desde el guard:', request.user);
      
      if (!request.user) {
        throw new Error('Usuario no autenticado');
      }
      
      const user = await this.authService.getCurrentUser(request.user);
      return {
        success: true,
        data: user
      };
    } catch (error) {
      return {
        success: false,
        message: error.message
      };
    }
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async getCurrentUser(@Req() request: RequestWithUser) {
    try {
      if (!request.user) {
        throw new Error('Usuario no autenticado');
      }

      return {
        success: true,
        data: {
          id: request.user.id,
          email: request.user.email || 'sin-email@ejemplo.com',
          full_name: request.user.user_metadata?.full_name || 'Usuario',
          created_at: request.user.created_at || new Date().toISOString()
        }
      };
    } catch (error) {
      return {
        success: false,
        message: error.message
      };
    }
  }

  @Put('profile')
  @UseGuards(JwtAuthGuard)
  @UsePipes(new ValidationPipe({ whitelist: true }))
  async updateProfile(
    @Req() request: RequestWithUser,
    @Body() updateProfileDto: UpdateProfileDto
  ) {
    try {
      if (!request.user) {
        throw new Error('Usuario no autenticado');
      }

      const result = await this.authService.updateProfile(request.user.id, updateProfileDto);
      return {
        success: true,
        message: 'Perfil actualizado exitosamente',
        data: result
      };
    } catch (error) {
      return {
        success: false,
        message: error.message
      };
    }
  }
}