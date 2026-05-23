import { Module } from '@nestjs/common';
import { TutorsModule } from '../tutors/tutors.module';
import { AdminTutorsController } from './admin-tutors.controller';

@Module({
  imports: [TutorsModule],
  controllers: [AdminTutorsController],
})
export class AdminModule {}
