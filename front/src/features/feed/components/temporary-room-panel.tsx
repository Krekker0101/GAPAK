"use client";

import { useState } from "react";
import { Timer } from "lucide-react";

import { roomService } from "@/shared/api/services/room.service";
import type { TrustRoomResponse } from "@/shared/types/room";
import { Button } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";

type RoomDuration = "1h" | "24h" | "7d";

const durationOptions: Array<{ value: RoomDuration; label: string; retentionDays: number }> = [
  { value: "1h", label: "1 час", retentionDays: 1 },
  { value: "24h", label: "24 часа", retentionDays: 1 },
  { value: "7d", label: "Неделя", retentionDays: 7 },
];

export function TemporaryRoomPanel({ onCreated }: { onCreated: (room: TrustRoomResponse) => void }) {
  const [name, setName] = useState("");
  const [duration, setDuration] = useState<RoomDuration>("24h");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selected = durationOptions.find((item) => item.value === duration) ?? durationOptions[1];

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const roomName = name.trim();
    if (!roomName) {
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const room = await roomService.create({
        name: roomName,
        description: `Temporary access window: ${selected.label}`,
        visibility: "PRIVATE",
        accessMode: "OWNER_APPROVAL",
        requireTwoFactor: true,
        minAccountAgeDays: 0,
        messageRetentionDays: selected.retentionDays,
      });
      setName("");
      onCreated(room);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Комната не создана");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.28em] text-primary/90">Temporary rooms</p>
          <h3 className="font-display text-lg font-semibold">Временная комната</h3>
        </div>
        <Timer className="h-5 w-5 text-primary" />
      </div>
      <form onSubmit={submit} className="mt-4 space-y-3">
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Название комнаты"
          className="h-11 w-full rounded-2xl border border-white/10 bg-black/20 px-4 text-sm outline-none transition focus:border-primary/50"
        />
        <div className="grid grid-cols-3 gap-2">
          {durationOptions.map((item) => (
            <button
              key={item.value}
              type="button"
              onClick={() => setDuration(item.value)}
              className={`rounded-2xl border px-3 py-2 text-xs transition ${duration === item.value ? "border-primary/50 bg-primary/15 text-primary" : "border-white/10 bg-white/[0.03] text-muted-foreground hover:text-foreground"}`}
            >
              {item.label}
            </button>
          ))}
        </div>
        {error ? <p className="rounded-2xl border border-red-300/20 bg-red-400/10 px-3 py-2 text-xs text-red-100">{error}</p> : null}
        <Button type="submit" disabled={submitting || !name.trim()} className="w-full">
          {submitting ? "Создаём…" : "Создать через API"}
        </Button>
      </form>
    </Card>
  );
}
