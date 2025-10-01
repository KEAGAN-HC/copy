import { Controller, Get, Post, Patch, Delete, Param, Body, Query, UseGuards, Req } from '@nestjs/common';
import { RemindersService } from './reminders.service';
import { UpsertReminderDto, ListRemindersQuery } from './dto/upsert-reminder.dto';
import { JwtAuthGuard } from '../auth/guards/jwt.guard';

@Controller('reminders')
@UseGuards(JwtAuthGuard)
export class RemindersController {
  constructor(private readonly svc: RemindersService) {}

  @Post()
  create(@Req() req, @Body() dto: UpsertReminderDto) {
    return this.svc.create(req.user.id, dto);
  }

  @Get()
  list(@Req() req, @Query() q: ListRemindersQuery) {
    return this.svc.list(req.user.id, q);
  }

  @Get(':id')
  get(@Req() req, @Param('id') id: string) {
    return this.svc.get(req.user.id, id);
  }

  @Patch(':id')
  update(@Req() req, @Param('id') id: string, @Body() dto: Partial<UpsertReminderDto>) {
    return this.svc.update(req.user.id, id, dto);
  }

  @Post(':id/toggle')
  toggle(@Req() req, @Param('id') id: string, @Body() body: { active: boolean }) {
    return this.svc.toggle(req.user.id, id, body.active);
  }

  @Delete(':id')
  remove(@Req() req, @Param('id') id: string) {
    return this.svc.softDelete(req.user.id, id);
  }

  @Post(':id/test-send')
  testSend(@Req() req, @Param('id') id: string) {
    return this.svc.testSend(req.user.id, id);
  }

  @Post(':id/snooze')
  snooze(@Req() req, @Param('id') id: string) {
    return this.svc.snooze(req.user.id, id);
  }
}
