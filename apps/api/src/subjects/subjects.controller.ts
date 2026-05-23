import { Controller, Get } from '@nestjs/common';
import { SubjectsService } from './subjects.service';

@Controller('subjects')
export class SubjectsController {
  constructor(private readonly subjectsService: SubjectsService) {}

  @Get()
  listSubjects() {
    return this.subjectsService.listSubjects();
  }
}
