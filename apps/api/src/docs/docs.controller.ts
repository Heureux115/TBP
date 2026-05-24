import { Controller, Get } from '@nestjs/common';

@Controller('docs')
export class DocsController {
  @Get('openapi.json')
  openApi() {
    return {
      openapi: '3.0.0',
      info: {
        title: 'TutorConnect API',
        version: '0.1.0',
      },
      servers: [{ url: '/api/v1' }],
      paths: {
        '/auth/register': { post: { tags: ['Auth'], summary: 'Register student or tutor' } },
        '/auth/login': { post: { tags: ['Auth'], summary: 'Login and receive JWT tokens' } },
        '/auth/me': { get: { tags: ['Auth'], summary: 'Get current authenticated user' } },
        '/subjects': { get: { tags: ['Subjects'], summary: 'List active subjects' } },
        '/tutors/search': { get: { tags: ['Tutors'], summary: 'Search public approved tutors' } },
        '/tutors/{id}': { get: { tags: ['Tutors'], summary: 'Get public tutor detail' } },
        '/tutors/{id}/availability': { get: { tags: ['Tutors'], summary: 'Get public tutor availability' } },
        '/tutors/me': { get: { tags: ['Tutor Profile'], summary: 'Get my tutor profile' }, post: { tags: ['Tutor Profile'], summary: 'Create my tutor profile' }, patch: { tags: ['Tutor Profile'], summary: 'Update my tutor profile' } },
        '/tutors/me/avatar': { post: { tags: ['Tutor Profile'], summary: 'Upload tutor avatar' } },
        '/tutors/documents/upload': { post: { tags: ['Tutor Profile'], summary: 'Upload tutor verification document' } },
        '/tutors/me/submit-verification': { post: { tags: ['Tutor Profile'], summary: 'Submit tutor profile for review' } },
        '/admin/tutors': { get: { tags: ['Admin'], summary: 'List tutor profiles for moderation' } },
        '/admin/tutors/{id}': { get: { tags: ['Admin'], summary: 'Get tutor profile moderation detail' } },
        '/admin/tutors/{id}/approve': { patch: { tags: ['Admin'], summary: 'Approve tutor profile' } },
        '/admin/tutors/{id}/reject': { patch: { tags: ['Admin'], summary: 'Reject tutor profile' } },
        '/bookings': { post: { tags: ['Bookings'], summary: 'Create booking from an availability slot' } },
        '/bookings/me': { get: { tags: ['Bookings'], summary: 'List current user bookings' } },
        '/bookings/{id}/cancel': { patch: { tags: ['Bookings'], summary: 'Cancel booking' } },
      },
    };
  }
}
