"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { Film, ImagePlus, LockKeyhole, MessageSquareText, UploadCloud } from "lucide-react";
import { useForm } from "react-hook-form";
import type { z } from "zod";

import { FormField } from "@/components/common/form-field";
import { PageHeader } from "@/components/common/page-header";
import { createPostSchema } from "@/features/posts/schemas/post.schemas";
import { mediaService } from "@/shared/api/services/media.service";
import { postService } from "@/shared/api/services/post.service";
import { cn } from "@/shared/lib/utils";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";
import { Input } from "@/shared/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import { Textarea } from "@/shared/ui/textarea";

type CreatePostValues = z.infer<typeof createPostSchema>;

const simplePrivacy = [
  { value: "FRIENDS", label: "Только друзья", detail: "Понятный вариант для обычной публикации" },
  { value: "TRUSTED_CIRCLE", label: "Доверенный круг", detail: "Для самого близкого круга" },
  { value: "PUBLIC", label: "Публично", detail: "Можно показать шире" },
] as const;

export default function CreatePostPage() {
  const router = useRouter();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);

  const form = useForm<CreatePostValues>({
    resolver: zodResolver(createPostSchema),
    defaultValues: {
      contentType: "POST",
      body: "",
      privacy: "FRIENDS",
      expiresAt: "",
      oneTimeViewLimit: null,
      audienceUserIds: "",
      mediaFileIds: "",
      uploadFile: null,
    },
  });

  const contentType = form.watch("contentType");
  const privacy = form.watch("privacy");
  const selectedPrivacy = simplePrivacy.find((item) => item.value === privacy);
  const isClip = contentType === "CLIP";

  const onSubmit = form.handleSubmit(async (values) => {
    setSubmitError(null);
    setUploading(false);

    try {
      const mediaFileIds = values.mediaFileIds
        ? values.mediaFileIds.split(",").map((value) => value.trim()).filter(Boolean)
        : [];
      const file = values.uploadFile instanceof File ? values.uploadFile : null;

      if (file) {
        if (values.contentType === "CLIP" && !file.type.startsWith("video/")) {
          throw new Error("Для клипса нужно выбрать видеофайл.");
        }
        setUploading(true);
        const uploaded = await mediaService.uploadFile(file, values.contentType === "CLIP" ? "CLIP" : "POST_ATTACHMENT");
        mediaFileIds.push(uploaded.mediaFileId);
      }

      const post = await postService.create({
        contentType: values.contentType,
        body: values.body,
        privacy: values.privacy,
        expiresAt: values.expiresAt || undefined,
        oneTimeViewLimit: values.oneTimeViewLimit,
        audienceUserIds: values.audienceUserIds
          ? values.audienceUserIds.split(",").map((value) => value.trim()).filter(Boolean)
          : undefined,
        mediaFileIds: mediaFileIds.length > 0 ? mediaFileIds : undefined,
      });
      router.replace(values.contentType === "CLIP" ? `/clips?post=${post.id}` : `/feed?post=${post.id}`);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Не удалось опубликовать.");
    } finally {
      setUploading(false);
    }
  });

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Создание"
        title="Опубликуйте пост или клипс за пару шагов"
        description="Без сложных настроек: выберите формат, добавьте текст или видео, а безопасность и обработку качества сервер возьмет на себя."
      />

      <div className="grid gap-4 xl:grid-cols-[1fr_0.8fr]">
        <Card className="p-6">
          <form className="space-y-5" onSubmit={onSubmit}>
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                { value: "POST", title: "Публикация", text: "Текст, фото или обычное видео", icon: MessageSquareText },
                { value: "CLIP", title: "Клипс", text: "Вертикальное короткое видео", icon: Film },
              ].map((item) => (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => form.setValue("contentType", item.value as CreatePostValues["contentType"])}
                  className={cn(
                    "flex items-start gap-4 rounded-2xl border p-4 text-left transition",
                    contentType === item.value
                      ? "border-primary/50 bg-primary/10 text-foreground"
                      : "border-white/8 bg-white/[0.03] text-muted-foreground hover:text-foreground",
                  )}
                >
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/8 text-primary">
                    <item.icon className="h-5 w-5" />
                  </span>
                  <span>
                    <span className="block font-display text-xl font-semibold">{item.title}</span>
                    <span className="mt-1 block text-sm leading-6">{item.text}</span>
                  </span>
                </button>
              ))}
            </div>

            <FormField label={isClip ? "Подпись к клипсу" : "Что хотите рассказать?"} error={form.formState.errors.body?.message}>
              <Textarea
                rows={isClip ? 4 : 7}
                placeholder={isClip ? "Напишите короткую подпись к видео..." : "Напишите простым языком, что хотите показать друзьям..."}
                {...form.register("body")}
              />
            </FormField>

            <div className="grid gap-4 md:grid-cols-[1fr_0.8fr]">
              <FormField label="Кто увидит">
                <Select value={privacy} onValueChange={(value) => form.setValue("privacy", value as CreatePostValues["privacy"])}>
                  <SelectTrigger>
                    <SelectValue placeholder="Выберите приватность" />
                  </SelectTrigger>
                  <SelectContent>
                    {simplePrivacy.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>
              <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <LockKeyhole className="h-4 w-4 text-primary" />
                  {selectedPrivacy?.label}
                </div>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{selectedPrivacy?.detail}</p>
              </div>
            </div>

            <FormField
              label={isClip ? "Видео для клипса" : "Файл к публикации"}
              hint={isClip ? "Сервер подготовит качества 240p-1080p для адаптивного воспроизведения." : "Можно добавить фото или видео."}
              error={form.formState.errors.uploadFile?.message?.toString()}
            >
              <label className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-white/14 bg-black/20 px-5 py-8 text-center transition hover:border-primary/50 hover:bg-primary/5">
                <UploadCloud className="h-8 w-8 text-primary" />
                <span className="mt-3 text-sm font-medium">{selectedFileName ?? "Выберите файл"}</span>
                <span className="mt-1 text-xs text-muted-foreground">{isClip ? "MP4/WebM видео" : "Изображение или видео"}</span>
                <Input
                  className="hidden"
                  type="file"
                  accept={isClip ? "video/*" : "image/*,video/*"}
                  onChange={(event) => {
                    const file = event.target.files?.[0] ?? null;
                    form.setValue("uploadFile", file, { shouldValidate: true });
                    setSelectedFileName(file?.name ?? null);
                  }}
                />
              </label>
            </FormField>

            <details className="rounded-2xl border border-white/8 bg-black/20 p-4">
              <summary className="cursor-pointer text-sm font-medium text-muted-foreground">Расширенные настройки</summary>
              <div className="mt-4 grid gap-4">
                <FormField label="ID аудитории" hint="Только если выбран приватный режим" error={form.formState.errors.audienceUserIds?.message}>
                  <Input placeholder="uuid-1, uuid-2" {...form.register("audienceUserIds")} />
                </FormField>
                <FormField label="Готовые media ID" hint="Можно вставить уже загруженные файлы" error={form.formState.errors.mediaFileIds?.message}>
                  <Input placeholder="media-uuid-1, media-uuid-2" {...form.register("mediaFileIds")} />
                </FormField>
              </div>
            </details>

            {submitError ? <p className="rounded-xl border border-red-400/20 bg-red-400/10 p-3 text-sm text-red-200">{submitError}</p> : null}
            <div className="flex flex-wrap gap-3">
              <Button type="submit" disabled={form.formState.isSubmitting || uploading}>
                {uploading || form.formState.isSubmitting ? "Публикуем..." : isClip ? "Опубликовать клипс" : "Опубликовать"}
              </Button>
              <Button type="button" variant="outline" onClick={() => router.replace("/feed")}>
                Отмена
              </Button>
            </div>
          </form>
        </Card>

        <Card className="p-6">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            {isClip ? <Film className="h-6 w-6" /> : <ImagePlus className="h-6 w-6" />}
          </div>
          <p className="mt-5 text-xs uppercase tracking-[0.28em] text-primary">Что происходит на сервере</p>
          <h2 className="mt-4 font-display text-3xl font-semibold">{isClip ? "Клипс готовится как видео-платформа" : "Публикация остается простой"}</h2>
          <div className="mt-5 space-y-3 text-sm leading-7 text-muted-foreground">
            <p>
              <strong className="text-foreground">1.</strong> Файл загружается через подписанный upload URL и проверяется по размеру, MIME type и владельцу.
            </p>
            <p>
              <strong className="text-foreground">2.</strong> Для клипса backend создает video asset и набор качеств 240p, 360p, 480p, 720p, 1080p.
            </p>
            <p>
              <strong className="text-foreground">3.</strong> Воспроизведение идет через короткоживущие playback grants, поэтому приватное видео не раскрывает прямые storage paths.
            </p>
          </div>
          <div className="mt-6 flex flex-wrap gap-2">
            <Badge variant="success">Безопасная загрузка</Badge>
            <Badge variant="primary">Авто-качество</Badge>
            <Badge variant="trusted">Клипс</Badge>
          </div>
        </Card>
      </div>
    </div>
  );
}
