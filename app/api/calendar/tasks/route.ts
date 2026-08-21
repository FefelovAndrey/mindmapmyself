import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import {
  createTodo,
  localYekaterinburgToIso,
  isoToDeadlineDate,
} from '@/lib/yandexCalendar';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const description = typeof body.description === 'string' ? body.description : null;
    const date = typeof body.date === 'string' ? body.date : '';
    const startTime = typeof body.startTime === 'string' ? body.startTime : '';
    const endTime = typeof body.endTime === 'string' ? body.endTime : '';

    if (!name) {
      return NextResponse.json({ error: 'Название обязательно' }, { status: 400 });
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json({ error: 'Некорректная дата' }, { status: 400 });
    }
    if (!/^\d{2}:\d{2}$/.test(startTime) || !/^\d{2}:\d{2}$/.test(endTime)) {
      return NextResponse.json({ error: 'Некорректное время' }, { status: 400 });
    }

    const startAt = localYekaterinburgToIso(date, startTime);
    const endAt = localYekaterinburgToIso(date, endTime);
    if (new Date(endAt).getTime() <= new Date(startAt).getTime()) {
      return NextResponse.json(
        { error: 'Время окончания должно быть позже начала' },
        { status: 400 }
      );
    }

    const todoUid = uuidv4();
    await createTodo({
      todoUid,
      summary: name,
      description,
      startAt,
      endAt,
    });

    return NextResponse.json({
      calendarUid: todoUid,
      calendarStartAt: startAt,
      calendarEndAt: endAt,
      deadline: isoToDeadlineDate(startAt),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Ошибка создания задачи';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
