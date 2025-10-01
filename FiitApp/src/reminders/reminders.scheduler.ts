import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { RemindersService } from './reminders.service';

@Injectable()
export class RemindersScheduler {
  private readonly logger = new Logger(RemindersScheduler.name);

  constructor(private readonly svc: RemindersService) {}

  // Corre cada minuto
  @Cron('0 * * * * *')
  async handleCron() {
    try {
      const due = await this.svc.dueReminders(500);
      if (due.length === 0) return;
      this.logger.log(`Disparando ${due.length} recordatorios`);
      for (const r of due) {
        await this.svc.dispatchAndReschedule(r);
      }
    } catch (e) {
      this.logger.error('Error en scheduler', e.stack || e.message);
    }
  }
}
