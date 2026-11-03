import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { UnauthorizedException, ConflictException } from '@nestjs/common';
import { Rol } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

import { AuthService } from './auth.service';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Pruebas unitarias del Web Service 1 — Autenticacion.
 *
 * La capa de datos se sustituye por un doble de prueba: ninguna prueba toca
 * la base de datos real, conforme al esquema de pruebas del proyecto.
 */
describe('AuthService', () => {
  let servicio: AuthService;
  let prisma: {
    usuario: {
      findUnique: jest.Mock;
      findFirst: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
  };

  const usuarioBase = {
    id: '11111111-1111-4111-8111-111111111111',
    email: 'docente@utng.edu.mx',
    nombre: 'Docente de Prueba',
    password: bcrypt.hashSync('Siplad2026*', 10),
    googleId: null,
    rol: Rol.PROFESOR,
    activo: true,
    creadoEn: new Date(),
  };

  beforeEach(async () => {
    prisma = {
      usuario: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
    };

    const modulo: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: JwtService, useValue: { sign: jest.fn(() => 'token-firmado') } },
      ],
    }).compile();

    servicio = modulo.get<AuthService>(AuthService);
  });

  describe('iniciarSesion', () => {
    it('emite un token y el perfil publico cuando las credenciales son correctas', async () => {
      prisma.usuario.findUnique.mockResolvedValue(usuarioBase);

      const resultado = await servicio.iniciarSesion({
        email: 'docente@utng.edu.mx',
        password: 'Siplad2026*',
      });

      expect(resultado.accessToken).toBe('token-firmado');
      expect(resultado.usuario.email).toBe('docente@utng.edu.mx');
      expect(resultado.usuario.rol).toBe(Rol.PROFESOR);
    });

    it('nunca expone el hash de la contrasena en la respuesta', async () => {
      prisma.usuario.findUnique.mockResolvedValue(usuarioBase);

      const resultado = await servicio.iniciarSesion({
        email: 'docente@utng.edu.mx',
        password: 'Siplad2026*',
      });

      expect(resultado.usuario).not.toHaveProperty('password');
      expect(resultado.usuario).not.toHaveProperty('googleId');
    });

    it('rechaza una contrasena incorrecta', async () => {
      prisma.usuario.findUnique.mockResolvedValue(usuarioBase);

      await expect(
        servicio.iniciarSesion({
          email: 'docente@utng.edu.mx',
          password: 'ContrasenaIncorrecta',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('rechaza un correo inexistente con el mismo mensaje que una contrasena incorrecta', async () => {
      prisma.usuario.findUnique.mockResolvedValue(null);

      // OWASP A07 — La respuesta no permite deducir que cuentas existen.
      await expect(
        servicio.iniciarSesion({
          email: 'inexistente@utng.edu.mx',
          password: 'Siplad2026*',
        }),
      ).rejects.toThrow('Las credenciales proporcionadas no son correctas.');
    });

    it('rechaza el acceso de una cuenta desactivada', async () => {
      prisma.usuario.findUnique.mockResolvedValue({
        ...usuarioBase,
        activo: false,
      });

      await expect(
        servicio.iniciarSesion({
          email: 'docente@utng.edu.mx',
          password: 'Siplad2026*',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('normaliza el correo antes de consultar la base de datos', async () => {
      prisma.usuario.findUnique.mockResolvedValue(usuarioBase);

      await servicio.iniciarSesion({
        email: '  DOCENTE@UTNG.EDU.MX  ',
        password: 'Siplad2026*',
      });

      expect(prisma.usuario.findUnique).toHaveBeenCalledWith({
        where: { email: 'docente@utng.edu.mx' },
      });
    });
  });

  describe('registrar', () => {
    it('almacena la contrasena como hash y no en claro', async () => {
      prisma.usuario.findUnique.mockResolvedValue(null);
      prisma.usuario.create.mockImplementation(({ data }) =>
        Promise.resolve({ ...usuarioBase, ...data }),
      );

      await servicio.registrar({
        email: 'nuevo@utng.edu.mx',
        nombre: 'Docente Nuevo',
        password: 'Siplad2026*',
      });

      const guardado = prisma.usuario.create.mock.calls[0][0].data;
      expect(guardado.password).not.toBe('Siplad2026*');
      expect(await bcrypt.compare('Siplad2026*', guardado.password)).toBe(true);
    });

    it('asigna el rol PROFESOR cuando no se especifica', async () => {
      prisma.usuario.findUnique.mockResolvedValue(null);
      prisma.usuario.create.mockImplementation(({ data }) =>
        Promise.resolve({ ...usuarioBase, ...data }),
      );

      await servicio.registrar({
        email: 'nuevo@utng.edu.mx',
        nombre: 'Docente Nuevo',
        password: 'Siplad2026*',
      });

      expect(prisma.usuario.create.mock.calls[0][0].data.rol).toBe(Rol.PROFESOR);
    });

    it('rechaza el registro de un correo ya existente', async () => {
      prisma.usuario.findUnique.mockResolvedValue(usuarioBase);

      await expect(
        servicio.registrar({
          email: 'docente@utng.edu.mx',
          nombre: 'Duplicado',
          password: 'Siplad2026*',
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('autenticarConProveedorExterno', () => {
    it('crea la cuenta en el primer acceso federado', async () => {
      prisma.usuario.findFirst.mockResolvedValue(null);
      prisma.usuario.create.mockImplementation(({ data }) =>
        Promise.resolve({ ...usuarioBase, ...data, activo: true }),
      );

      const resultado = await servicio.autenticarConProveedorExterno({
        email: 'federado@utng.edu.mx',
        nombre: 'Docente Federado',
        googleId: 'google-123',
      });

      expect(prisma.usuario.create).toHaveBeenCalled();
      expect(resultado.accessToken).toBe('token-firmado');
    });

    it('vincula el identificador externo a una cuenta local existente', async () => {
      prisma.usuario.findFirst.mockResolvedValue({ ...usuarioBase, googleId: null });
      prisma.usuario.update.mockResolvedValue({
        ...usuarioBase,
        googleId: 'google-123',
      });

      await servicio.autenticarConProveedorExterno({
        email: 'docente@utng.edu.mx',
        nombre: 'Docente de Prueba',
        googleId: 'google-123',
      });

      expect(prisma.usuario.update).toHaveBeenCalledWith({
        where: { id: usuarioBase.id },
        data: { googleId: 'google-123' },
      });
    });

    it('no crea una cuenta duplicada cuando el identificador externo ya esta vinculado', async () => {
      prisma.usuario.findFirst.mockResolvedValue({
        ...usuarioBase,
        googleId: 'google-123',
      });

      await servicio.autenticarConProveedorExterno({
        email: 'docente@utng.edu.mx',
        nombre: 'Docente de Prueba',
        googleId: 'google-123',
      });

      expect(prisma.usuario.create).not.toHaveBeenCalled();
      expect(prisma.usuario.update).not.toHaveBeenCalled();
    });
  });

  describe('validarUsuarioDelToken', () => {
    it('devuelve el perfil cuando la cuenta esta activa', async () => {
      prisma.usuario.findUnique.mockResolvedValue(usuarioBase);

      const perfil = await servicio.validarUsuarioDelToken(usuarioBase.id);

      expect(perfil.id).toBe(usuarioBase.id);
    });

    it('invalida la sesion de una cuenta desactivada aunque el token siga vigente', async () => {
      prisma.usuario.findUnique.mockResolvedValue({
        ...usuarioBase,
        activo: false,
      });

      await expect(servicio.validarUsuarioDelToken(usuarioBase.id)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });
});
