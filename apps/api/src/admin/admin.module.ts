import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { TutorsModule } from '../tutors/tutors.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { AdminOperationsController } from './admin-operations.controller';
import { AdminOperationsService } from './admin-operations.service';
import { AdminTutorsController } from './admin-tutors.controller';

@Module({
  imports: [PrismaModule, TutorsModule, NotificationsModule],
  controllers: [AdminTutorsController, AdminOperationsController],
  providers: [AdminOperationsService],
})
export class AdminModule {}
