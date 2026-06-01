"use client";

import { useEffect, useState, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import type { z } from "zod";

import { FormField } from "@/components/common/form-field";
import { PageHeader } from "@/components/common/page-header";
import { StateCard } from "@/components/common/state-card";
import { updateProfileSchema } from "@/features/profile/schemas/profile.schemas";
import { mediaService } from "@/shared/api/services/media.service";
import { useAsyncResource } from "@/shared/lib/hooks/use-async-resource";
import { useMediaUrl } from "@/shared/lib/hooks/use-media-url";
import { userService } from "@/shared/api/services/user.service";
import { Avatar, AvatarFallback, AvatarImage } from "@/shared/ui/avatar";
import { Button } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";
import { Input } from "@/shared/ui/input";
import { Textarea } from "@/shared/ui/textarea";

type UpdateProfileValues = z.infer<typeof updateProfileSchema>;

export default function EditProfilePage() {
  const router = useRouter();
  const { data, isLoading, isError, error, reload } = useAsyncResource(() => userService.getMe(), []);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState<string | null>(null);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);

  const form = useForm<UpdateProfileValues>({
    resolver: zodResolver(updateProfileSchema),
    defaultValues: {
      displayName: "",
      bio: "",
      statusMessage: "",
      avatarFileId: "",
    },
  });

  useEffect(() => {
    if (data) {
      form.reset({
        displayName: data.displayName,
        bio: data.bio ?? "",
        statusMessage: data.statusMessage ?? "",
        avatarFileId: data.avatarFileId ?? "",
      });
    }
  }, [data, form]);

  useEffect(() => {
    return () => {
      if (avatarPreviewUrl) {
        URL.revokeObjectURL(avatarPreviewUrl);
      }
    };
  }, [avatarPreviewUrl]);

  const currentAvatar = useMediaUrl(form.watch("avatarFileId") || data?.avatarFileId || null, "profile-avatar-edit");

  const handleAvatarSelect = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) {
      return;
    }

    setUploadError(null);
    setIsUploadingAvatar(true);

    const nextPreviewUrl = URL.createObjectURL(file);
    setAvatarPreviewUrl((current) => {
      if (current) {
        URL.revokeObjectURL(current);
      }
      return nextPreviewUrl;
    });

    try {
      const upload = await mediaService.uploadFile(file, "PROFILE");
      form.setValue("avatarFileId", upload.mediaFileId, {
        shouldDirty: true,
        shouldValidate: true,
      });
    } catch (uploadError) {
      setUploadError(uploadError instanceof Error ? uploadError.message : "Unable to upload avatar");
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const onSubmit = form.handleSubmit(async (values) => {
    setSubmitError(null);
    try {
      await userService.updateMe({
        displayName: values.displayName,
        bio: values.bio || undefined,
        statusMessage: values.statusMessage || undefined,
        avatarFileId: values.avatarFileId || undefined,
      });
      router.replace("/profile");
    } catch (submitError) {
      setSubmitError(submitError instanceof Error ? submitError.message : "Unable to save profile");
    }
  });

  if (isError) {
    return (
      <StateCard
        title="Unable to open profile editor"
        description={error?.message ?? "The profile editor failed to initialize."}
        variant="error"
        action={
          <Button onClick={() => void reload()} variant="outline">
            Retry
          </Button>
        }
      />
    );
  }

  if (isLoading || !data) {
    return <StateCard title="Loading editor" description="Fetching the current profile fields before editing." />;
  }

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Profile editor"
        title="Shape how your identity appears"
        description="Every field maps cleanly to the backend update DTO, including avatar file references and optional visibility-facing copy."
      />

      <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <Card className="p-6">
          <p className="text-xs uppercase tracking-[0.28em] text-primary">Preview</p>
          <div className="mt-4 flex items-center gap-4">
            <Avatar className="h-20 w-20 rounded-[1.75rem] border border-white/10 bg-black/20">
              {avatarPreviewUrl ? <AvatarImage src={avatarPreviewUrl} alt="Avatar preview" /> : null}
              {!avatarPreviewUrl && currentAvatar.url ? (
                <AvatarImage src={currentAvatar.url} alt={form.watch("displayName") || data.displayName} />
              ) : null}
              <AvatarFallback className="rounded-[1.75rem] text-lg">
                {(form.watch("displayName") || data.displayName).slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div>
              <h2 className="font-display text-4xl font-semibold">{form.watch("displayName") || data.displayName}</h2>
              <p className="mt-2 text-base text-muted-foreground">@{data.username}</p>
            </div>
          </div>
          <p className="mt-6 text-sm leading-8 text-muted-foreground">
            {form.watch("bio") || "Add a bio to express the version of yourself that this audience layer should meet."}
          </p>
          <div className="mt-6 rounded-[1.5rem] border border-white/8 bg-black/20 p-4 text-sm text-muted-foreground">
            Status message: {form.watch("statusMessage") || "Private mode"}
          </div>
          <div className="mt-4 rounded-[1.5rem] border border-white/8 bg-black/20 p-4 text-sm text-muted-foreground">
            Avatar asset: {form.watch("avatarFileId") || "No avatar uploaded yet"}
          </div>
        </Card>

        <Card className="p-6">
          <form className="space-y-5" onSubmit={onSubmit}>
            <FormField label="Display name" error={form.formState.errors.displayName?.message}>
              <Input {...form.register("displayName")} />
            </FormField>
            <FormField label="Bio" error={form.formState.errors.bio?.message}>
              <Textarea rows={5} {...form.register("bio")} />
            </FormField>
            <FormField label="Status message" error={form.formState.errors.statusMessage?.message}>
              <Input placeholder="Trusted, quiet, private." {...form.register("statusMessage")} />
            </FormField>
            <FormField
              label="Profile photo"
              hint="Uploads through the media API and stores the returned asset UUID in the profile DTO."
              error={form.formState.errors.avatarFileId?.message}
            >
              <div className="space-y-3">
                <Input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => void handleAvatarSelect(event)} />
                <Input readOnly value={form.watch("avatarFileId") || ""} placeholder="Uploaded avatar asset id" />
                <p className="text-xs text-muted-foreground">
                  {isUploadingAvatar
                    ? "Uploading avatar..."
                    : currentAvatar.loading
                      ? "Refreshing secure avatar preview..."
                      : "Avatar uploads are finalized immediately and validated against PROFILE media ownership."}
                </p>
              </div>
            </FormField>
            {uploadError ? <p className="text-sm text-red-300">{uploadError}</p> : null}
            {submitError ? <p className="text-sm text-red-300">{submitError}</p> : null}
            <div className="flex flex-wrap gap-3">
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? "Saving..." : "Save profile"}
              </Button>
              <Button type="button" variant="outline" onClick={() => router.replace("/profile")}>
                Cancel
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </div>
  );
}
