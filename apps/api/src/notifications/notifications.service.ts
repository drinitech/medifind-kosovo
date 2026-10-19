import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { NotificationChannel, NotificationStatus, NotificationType, Prisma } from '@prisma/client';
import { paginate, PaginationQueryDto, skipTake } from '../common/dto/pagination.dto';
import { PrismaService } from '../prisma/prisma.service';

export interface NewNotification {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  link?: string;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * In-app delivery is the only channel in the MVP: storing the row is the
   * delivery. An email channel can be added behind this method once SMTP is
   * configured — until then nothing claims an email was sent.
   */
  async notify(n: NewNotification, db: Prisma.TransactionClient | PrismaService = this.prisma) {
    const now = new Date();
    return db.notification.create({
      data: {
        ...n,
        channel: NotificationChannel.IN_APP,
        status: NotificationStatus.SENT,
        sentAt: now,
      },
    });
  }

  async list(userId: string, query: PaginationQueryDto & { unreadOnly?: boolean }) {
    const where: Prisma.NotificationWhereInput = { userId, ...(query.unreadOnly ? { readAt: null } : {}) };
    const [items, total, unread] = await this.prisma.$transaction([
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        ...skipTake(query),
        select: {
          id: true,
          type: true,
          channel: true,
          title: true,
          message: true,
          link: true,
          status: true,
          readAt: true,
          sentAt: true,
          createdAt: true,
          alertId: true,
        },
      }),
      this.prisma.notification.count({ where }),
      this.prisma.notification.count({ where: { userId, readAt: null } }),
    ]);
    return { ...paginate(items, total, query.page, query.pageSize), unreadCount: unread };
  }

  async markRead(userId: string, id: string) {
    const result = await this.prisma.notification.updateMany({
      where: { id, userId, readAt: null },
      data: { readAt: new Date() },
    });
    if (result.count === 0) {
      const exists = await this.prisma.notification.findFirst({ where: { id, userId }, select: { id: true } });
      if (!exists) throw new NotFoundException('Notification not found');
    }
    return this.prisma.notification.findUniqueOrThrow({ where: { id } });
  }

  async markAllRead(userId: string) {
    const { count } = await this.prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });
    this.logger.debug(`Marked ${count} notifications read for ${userId}`);
    return { updated: count };
  }
}
