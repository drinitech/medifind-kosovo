import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Role } from '@prisma/client';
import * as argon2 from 'argon2';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto, RegisterDto } from './dto/auth.dto';

const publicUserSelect = {
  id: true,
  fullName: true,
  email: true,
  role: true,
  isActive: true,
  createdAt: true,
} as const;

// Verifying against a real hash when the user does not exist keeps response
// timing similar and avoids revealing which emails are registered.
let dummyHashPromise: Promise<string> | undefined;
const dummyHash = () => (dummyHashPromise ??= argon2.hash('medifind-timing-equalizer'));

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly audit: AuditService,
  ) {}

  static hashPassword(password: string) {
    return argon2.hash(password, { type: argon2.argon2id });
  }

  async register(dto: RegisterDto) {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email }, select: { id: true } });
    if (existing) throw new ConflictException('An account with this email already exists');

    const role = dto.accountType === 'PHARMACY' ? Role.PHARMACY_MANAGER : Role.USER;
    const user = await this.prisma.user.create({
      data: {
        fullName: dto.fullName,
        email: dto.email,
        passwordHash: await AuthService.hashPassword(dto.password),
        role,
      },
      select: publicUserSelect,
    });
    await this.audit.log({ userId: user.id, action: 'user.register', entityType: 'User', entityId: user.id, metadata: { role } });
    return { user, token: await this.sign(user.id) };
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    const valid = await argon2.verify(user?.passwordHash ?? (await dummyHash()), dto.password);
    if (!user || !valid || !user.isActive) {
      throw new UnauthorizedException('Invalid email or password');
    }
    const { passwordHash: _omit, updatedAt: _u, ...safe } = user;
    return { user: safe, token: await this.sign(user.id) };
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        ...publicUserSelect,
        memberships: {
          select: {
            role: true,
            pharmacy: { select: { id: true, name: true, slug: true, city: true, isVerified: true, isActive: true } },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
    const unreadNotifications = await this.prisma.notification.count({ where: { userId, readAt: null } });
    return { ...user, unreadNotifications };
  }

  private sign(userId: string) {
    return this.jwt.signAsync({ sub: userId });
  }
}
