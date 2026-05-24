import { Controller, Get, Param, Query } from '@nestjs/common';
import { TutorsService } from './tutors.service';
import { SearchTutorsDto } from './dto/discovery/search-tutors.dto';
import { TutorAvailabilityQueryDto } from './dto/discovery/tutor-availability.dto';

@Controller('tutors')
export class PublicTutorsController {
  constructor(private readonly tutorsService: TutorsService) {}

  @Get('search')
  searchTutors(@Query() query: SearchTutorsDto) {
    return this.tutorsService.searchPublicTutors(query);
  }

  @Get(':id/availability')
  getTutorAvailability(
    @Param('id') id: string,
    @Query() query: TutorAvailabilityQueryDto,
  ) {
    return this.tutorsService.getPublicTutorAvailability(id, query.weekStart);
  }

  @Get(':id')
  getTutor(@Param('id') id: string) {
    return this.tutorsService.getPublicTutor(id);
  }
}
