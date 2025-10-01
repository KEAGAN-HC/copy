import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../config/supabase.config'
import { UpsertReminderDto, ListRemindersQuery } from './dto/upsert-reminder.dto';
import { isDayEnabled, nextEnabledDowFrom } from './utils/dow-bitmask';

type ReminderRow = {
  id: string;
  user_id: string;
  reminder_type: string;
  message: string;
  scheduled_time: string; // 'HH:MM:SS' from db
  days_of_week: number | null;
  is_recurring: boolean;
  is_active: boolean;
  start_date: string;
  end_date: string | null;
  timezone: string;
  next_run_at: string | null;
  last_run_at: string | null;
  soft_deleted_at: string | null;
  created_at: string;
  updated_at: string;
};

@Injectable()
export class RemindersService {
  constructor(private readonly supa: SupabaseService) {}

  // === Create === //
  async create(userId: string, dto: UpsertReminderDto) {
    const row = await this.buildRowForInsert(userId, dto);
    const { data, error } = await this.supa.client
      .from('reminders')
      .insert(row)
      .select()
      .single();
    if (error) throw new BadRequestException(error.message);
    return data;
  }

  // === List with filters === //
  async list(userId: string, q: ListRemindersQuery) {
    let query = this.supa.client.from('reminders')
      .select('*')
      .eq('user_id', userId)
      .is('soft_deleted_at', null);

    if (q.status === 'active') query = query.eq('is_active', true);
    if (q.status === 'inactive') query = query.eq('is_active', false);
    if (q.type) query = query.eq('reminder_type', q.type);

    const limit = q.limit ?? 20;
    const offset = q.offset ?? 0;
    query = query.range(offset, offset + limit - 1).order('created_at', { ascending: false });

    const { data, error } = await query;
    if (error) throw new BadRequestException(error.message);
    return data;
  }

  // === Get one === //
  async get(userId: string, id: string) {
    const { data, error } = await this.supa.client.from('reminders').select('*').eq('id', id).single();
    if (error || !data || data.user_id !== userId || data.soft_deleted_at) {
      throw new NotFoundException('Reminder not found');
    }
    return data;
  }

  // === Update === //
  async update(userId: string, id: string, dto: Partial<UpsertReminderDto>) {
    const current = await this.get(userId, id);
    const next = await this.buildRowForUpdate(current, dto);
    const { data, error } = await this.supa.client
      .from('reminders')
      .update(next)
      .eq('id', id)
      .select()
      .single();
    if (error) throw new BadRequestException(error.message);
    return data;
  }

  // === Toggle === //
  async toggle(userId: string, id: string, active: boolean) {
    await this.get(userId, id);
    const { data, error } = await this.supa.client
      .from('reminders')
      .update({ is_active: active })
      .eq('id', id)
      .select()
      .single();
    if (error) throw new BadRequestException(error.message);
    return data;
  }

  // === Soft delete === //
  async softDelete(userId: string, id: string) {
    await this.get(userId, id);
    const { error } = await this.supa.client
      .from('reminders')
      .update({ soft_deleted_at: new Date().toISOString(), is_active: false })
      .eq('id', id);
    if (error) throw new BadRequestException(error.message);
    return { ok: true };
  }

  // === Test send now (dev) === //
  async testSend(userId: string, id: string) {
    const r = await this.get(userId, id);
    await this.insertNotification(r.user_id, 'Recordatorio', r.message);
    return { ok: true };
  }

  // === Snooze 5 min === //
  async snooze(userId: string, id: string) {
    await this.get(userId, id);
    const next = new Date(Date.now() + 5 * 60 * 1000).toISOString();
    const { data, error } = await this.supa.client
      .from('reminders')
      .update({ next_run_at: next, is_active: true })
      .eq('id', id)
      .select()
      .single();
    if (error) throw new BadRequestException(error.message);
    return data;
  }

  // === Scheduler helpers === //
  async dueReminders(limit = 500): Promise<ReminderRow[]> {
    const { data, error } = await this.supa.client
      .from('reminders')
      .select('*')
      .lte('next_run_at', new Date().toISOString())
      .eq('is_active', true)
      .is('soft_deleted_at', null)
      .order('next_run_at', { ascending: true })
      .limit(limit);
    if (error) throw new BadRequestException(error.message);
    return data as ReminderRow[];
  }

  async dispatchAndReschedule(row: ReminderRow) {
    // Send in_app
    await this.insertNotification(row.user_id, 'Recordatorio', row.message);

    // Update last_run + next_run (or deactivate if non recurring / expired)
    const updates: Partial<ReminderRow> = { last_run_at: new Date().toISOString() as any };

    const next = this.computeNextRun(row);
    if (next && row.is_recurring) {
      updates.next_run_at = next.toISOString() as any;
    } else {
      // No recurrente o ya no corresponde -> desactivar
      updates.next_run_at = null as any;
      updates.is_active = false as any;
    }

    const { error } = await this.supa.client
      .from('reminders')
      .update(updates)
      .eq('id', row.id);
    if (error) throw new BadRequestException(error.message);
  }

  // === Core: build + compute === //

  private async buildRowForInsert(userId: string, dto: UpsertReminderDto) {
    // Normalize
    const tz = dto.timezone ?? 'America/Mexico_City';
    const isRecurring = !!dto.isRecurring;

    if (isRecurring && (dto.daysOfWeek == null || dto.daysOfWeek === 0)) {
      throw new BadRequestException('daysOfWeek is required for recurring reminders');
    }

    const startDate = dto.startDate ?? new Date().toISOString().slice(0, 10);
    const endDate = dto.endDate ?? null;

    const next = this.computeFirstNextRun({
      user_id: userId,
      reminder_type: dto.reminderType,
      message: dto.message,
      scheduled_time: dto.scheduledTime + ':00',
      days_of_week: dto.daysOfWeek ?? null,
      is_recurring: isRecurring,
      start_date: startDate,
      end_date: endDate,
      timezone: tz,
      is_active: dto.isActive ?? true,
    });

    return {
      user_id: userId,
      reminder_type: dto.reminderType,
      message: dto.message,
      scheduled_time: dto.scheduledTime + ':00',
      days_of_week: dto.daysOfWeek ?? null,
      is_recurring: isRecurring,
      is_active: dto.isActive ?? true,
      start_date: startDate,
      end_date: endDate,
      timezone: tz,
      next_run_at: next?.toISOString() ?? null,
    };
  }

  private async buildRowForUpdate(current: ReminderRow, dto: Partial<UpsertReminderDto>) {
    const merged = {
      reminder_type: dto.reminderType ?? current.reminder_type,
      message: dto.message ?? current.message,
      scheduled_time: (dto.scheduledTime ? dto.scheduledTime + ':00' : current.scheduled_time),
      days_of_week: dto.daysOfWeek ?? current.days_of_week,
      is_recurring: dto.isRecurring ?? current.is_recurring,
      is_active: dto.isActive ?? current.is_active,
      start_date: dto.startDate ?? current.start_date,
      end_date: dto.endDate === undefined ? current.end_date : dto.endDate,
      timezone: dto.timezone ?? current.timezone,
    };

    const next = this.computeFirstNextRun({
      user_id: current.user_id,
      reminder_type: merged.reminder_type,
      message: merged.message,
      scheduled_time: merged.scheduled_time,
      days_of_week: merged.days_of_week,
      is_recurring: merged.is_recurring,
      start_date: merged.start_date,
      end_date: merged.end_date,
      timezone: merged.timezone,
      is_active: merged.is_active,
    });

    return { ...merged, next_run_at: next?.toISOString() ?? null };
  }

  /** Determina la primera ejecución futura según el estado/DTO */
  private computeFirstNextRun(r: {
    user_id: string;
    reminder_type: string;
    message: string;
    scheduled_time: string; // 'HH:MM:SS'
    days_of_week: number | null;
    is_recurring: boolean;
    is_active: boolean;
    start_date: string; // 'YYYY-MM-DD'
    end_date: string | null;
    timezone: string;
  }): Date | null {
    if (!r.is_active) return null;

    const now = new Date();
    const [hh, mm] = r.scheduled_time.split(':').map(Number);

    // Construir base = hoy en timezone, pero usamos Date del servidor:
    // Estrategia: tomamos la fecha de start_date a la hora HH:mm en TZ,
    // y luego avanzamos a la siguiente fecha válida.
    const base = new Date(`${r.start_date}T${this.pad2(hh)}:${this.pad2(mm)}:00${this.offsetForTZ(r.timezone)}`);

    // Si no recurrente:
    if (!r.is_recurring) {
      if (r.end_date && base > new Date(`${r.end_date}T23:59:59${this.offsetForTZ(r.timezone)}`)) return null;
      // Regla del MVP que pediste: si ya pasó, se desactiva (no reprogramar).
      return base > now ? base : null;
    }

    // Recurrente: buscar el siguiente día de semana habilitado >= now
    const maxHorizon = 370; // seguridad
    let d = new Date(now);

    for (let i = 0; i < maxHorizon; i++) {
      const dow = this.jsDowToMaskDow(d.getDay()); // JS: 0=Dom..6=Sáb igual a nuestra convención
      if (isDayEnabled(r.days_of_week ?? 0, dow)) {
        const candidate = new Date(
          `${d.toISOString().slice(0,10)}T${this.pad2(hh)}:${this.pad2(mm)}:00${this.offsetForTZ(r.timezone)}`
        );
        // Verificar rango start/end
        const dayDate = candidate.toISOString().slice(0,10);
        if (dayDate >= r.start_date && (!r.end_date || dayDate <= r.end_date)) {
          if (candidate > now) return candidate;
        }
      }
      d.setDate(d.getDate() + 1);
    }
    return null;
  }

  /** Recalcula la siguiente ejecución luego de disparar */
  private computeNextRun(r: ReminderRow): Date | null {
    if (!r.is_recurring) return null;
    // Próximo día habilitado > hoy
    const [hh, mm] = r.scheduled_time.split(':').map(Number);
    const now = new Date();
    const start = new Date(now);
    start.setDate(start.getDate() + 1);

    const maxHorizon = 370;
    const tz = r.timezone || 'America/Mexico_City';

    const endLimit = r.end_date ? new Date(`${r.end_date}T23:59:59${this.offsetForTZ(tz)}`) : null;

    for (let i = 0; i < maxHorizon; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      const dow = this.jsDowToMaskDow(d.getDay());
      if (isDayEnabled(r.days_of_week ?? 0, dow)) {
        const candidate = new Date(`${d.toISOString().slice(0,10)}T${this.pad2(hh)}:${this.pad2(mm)}:00${this.offsetForTZ(tz)}`);
        if (!endLimit || candidate <= endLimit) return candidate;
        break;
      }
    }
    return null;
  }

  private pad2(n: number) { return n.toString().padStart(2, '0'); }

  // Nota: Para ambientes productivos usa librerías de TZ (luxon/dayjs-tz). Aquí simplificamos.
  private offsetForTZ(tz: string): string {
    // MVP: retornar '−05:00' para America/Mexico_City (horario estándar). Ajusta a '-06:00' si aplica.
    // Puedes parametrizarlo si el cliente envía el offset.
    return '-05:00';
  }

  private jsDowToMaskDow(js: number): 0|1|2|3|4|5|6 {
    return js as 0|1|2|3|4|5|6; // misma convención
  }

  private async insertNotification(userId: string, title: string, body: string) {
    const { error } = await this.supa.client
      .from('notifications')
      .insert({ user_id: userId, title, body });
    if (error) throw new BadRequestException('Notification failed: ' + error.message);
  }
}
