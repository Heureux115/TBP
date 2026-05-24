import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { PublicTutorsController } from './public-tutors.controller';
import { TutorsController } from './tutors.controller';
import { TutorsService } from './tutors.service';

@Module({
  imports: [PrismaModule],
  controllers: [TutorsController, PublicTutorsController],
  providers: [TutorsService],
  exports: [TutorsService],
})
export class TutorsModule {}
