"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowDown, ArrowUp, Copy, GripVertical, Image as ImageIcon, Monitor, Plus, Save, Smartphone, Tablet, Trash2 } from "lucide-react";
import { useSearchParams } from "next/navigation";

import { AdminGuard } from "@/features/admin/components/admin-guard";
import { adminService } from "@/shared/api/services/admin.service";
import { supportedLocales, type Locale } from "@/shared/i18n/config";
import { useI18n } from "@/shared/i18n/provider";
import { cn } from "@/shared/lib/utils";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";
import { Input } from "@/shared/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import { Textarea } from "@/shared/ui/textarea";
import type { BuilderBlock, BuilderBlockType, PageContent, PageResponse } from "@/shared/types/admin";

type Viewport = "desktop" | "tablet" | "mobile";
type SaveState = "idle" | "saving" | "saved" | "error";

const blockTypes: { type: BuilderBlockType; labelKey: string }[] = [
  { type: "hero", labelKey: "builder.addHero" },
  { type: "feature", labelKey: "builder.addFeature" },
  { type: "stats", labelKey: "builder.addStats" },
  { type: "cta", labelKey: "builder.addCta" },
];

function createId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
}

function stringProp(block: BuilderBlock, key: string) {
  const value = block.props[key];
  return typeof value === "string" || typeof value === "number" ? String(value) : "";
}

function createBlock(type: BuilderBlockType): BuilderBlock {
  const common = {
    eyebrow: "Gapak",
    headline: "Premium private social experience",
    body: "Compose this section visually and publish it safely from the admin workspace.",
    accent: "cyan",
  };

  if (type === "hero") {
    return {
      id: createId(),
      type,
      props: {
        ...common,
        buttonLabel: "Get started",
        buttonHref: "/register",
        imageUrl: "",
      },
    };
  }

  if (type === "stats") {
    return {
      id: createId(),
      type,
      props: {
        eyebrow: "Metrics",
        headline: "Trust signals that scale",
        body: "Users|Active sessions|Protected spaces",
        accent: "emerald",
      },
    };
  }

  if (type === "cta") {
    return {
      id: createId(),
      type,
      props: {
        eyebrow: "Next",
        headline: "Launch a secure workspace",
        body: "Invite your trusted circle and start with privacy-first defaults.",
        buttonLabel: "Open Gapak",
        buttonHref: "/register",
        accent: "amber",
      },
    };
  }

  return {
    id: createId(),
    type,
    props: common,
  };
}

function reorderBlocks(blocks: BuilderBlock[], activeId: string, overId: string) {
  const activeIndex = blocks.findIndex((block) => block.id === activeId);
  const overIndex = blocks.findIndex((block) => block.id === overId);
  if (activeIndex < 0 || overIndex < 0 || activeIndex === overIndex) {
    return blocks;
  }
  const next = [...blocks];
  const [removed] = next.splice(activeIndex, 1);
  next.splice(overIndex, 0, removed);
  return next;
}

const PreviewBlock = memo(function PreviewBlock({ block }: { block: BuilderBlock }) {
  const accentClass =
    stringProp(block, "accent") === "amber"
      ? "text-amber-200 bg-amber-200/10"
      : stringProp(block, "accent") === "emerald"
        ? "text-emerald-300 bg-emerald-300/10"
        : "text-primary bg-primary/10";

  if (block.type === "hero") {
    const imageUrl = stringProp(block, "imageUrl");
    return (
      <section className="grid gap-8 border-b border-white/10 px-6 py-10 md:grid-cols-[1.1fr_0.9fr] md:px-10">
        <div className="space-y-5">
          <span className={cn("inline-flex rounded-full px-3 py-1 text-xs font-medium", accentClass)}>{stringProp(block, "eyebrow")}</span>
          <h1 className="font-display text-4xl font-semibold leading-tight md:text-6xl">{stringProp(block, "headline")}</h1>
          <p className="max-w-2xl text-sm leading-7 text-muted-foreground">{stringProp(block, "body")}</p>
          <a className="inline-flex rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground" href={stringProp(block, "buttonHref")}>
            {stringProp(block, "buttonLabel")}
          </a>
        </div>
        <div className="flex min-h-64 items-center justify-center overflow-hidden rounded-[1.5rem] border border-white/10 bg-white/[0.04]">
          {imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={imageUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <ImageIcon className="h-10 w-10 text-muted-foreground" />
          )}
        </div>
      </section>
    );
  }

  if (block.type === "stats") {
    const stats = stringProp(block, "body").split("|").filter(Boolean);
    return (
      <section className="border-b border-white/10 px-6 py-8 md:px-10">
        <p className="text-xs uppercase tracking-[0.26em] text-primary">{stringProp(block, "eyebrow")}</p>
        <h2 className="mt-3 font-display text-3xl font-semibold">{stringProp(block, "headline")}</h2>
        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          {stats.map((item, index) => (
            <div key={`${item}-${index}`} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
              <p className="font-display text-3xl font-semibold">{index + 1}</p>
              <p className="mt-2 text-sm text-muted-foreground">{item}</p>
            </div>
          ))}
        </div>
      </section>
    );
  }

  if (block.type === "cta") {
    return (
      <section className="px-6 py-10 text-center md:px-10">
        <p className="text-xs uppercase tracking-[0.26em] text-primary">{stringProp(block, "eyebrow")}</p>
        <h2 className="mx-auto mt-3 max-w-2xl font-display text-4xl font-semibold">{stringProp(block, "headline")}</h2>
        <p className="mx-auto mt-4 max-w-xl text-sm leading-7 text-muted-foreground">{stringProp(block, "body")}</p>
        <a className="mt-6 inline-flex rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground" href={stringProp(block, "buttonHref")}>
          {stringProp(block, "buttonLabel")}
        </a>
      </section>
    );
  }

  return (
    <section className="grid gap-6 border-b border-white/10 px-6 py-8 md:grid-cols-[0.7fr_1.3fr] md:px-10">
      <div>
        <span className={cn("inline-flex rounded-full px-3 py-1 text-xs font-medium", accentClass)}>{stringProp(block, "eyebrow")}</span>
      </div>
      <div>
        <h2 className="font-display text-3xl font-semibold">{stringProp(block, "headline")}</h2>
        <p className="mt-3 text-sm leading-7 text-muted-foreground">{stringProp(block, "body")}</p>
      </div>
    </section>
  );
});

function BuilderContent() {
  const searchParams = useSearchParams();
  const { locale: uiLocale, t } = useI18n();
  const initialSlug = searchParams.get("slug") ?? "home";
  const initialLocale = (searchParams.get("builderLocale") as Locale | null) ?? uiLocale;
  const [slug, setSlug] = useState(initialSlug);
  const [draftSlug, setDraftSlug] = useState(initialSlug);
  const [pageLocale, setPageLocale] = useState<Locale>(supportedLocales.includes(initialLocale) ? initialLocale : uiLocale);
  const [page, setPage] = useState<PageResponse | null>(null);
  const [content, setContent] = useState<PageContent>({ blocks: [] });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [viewport, setViewport] = useState<Viewport>("desktop");
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [error, setError] = useState<string | null>(null);
  const bootstrappedRef = useRef(false);

  const selectedBlock = useMemo(
    () => content.blocks.find((block) => block.id === selectedId) ?? null,
    [content.blocks, selectedId],
  );
  const pageTitle = page?.title;
  const pageStatus = page?.status;

  const loadPage = useCallback(async () => {
    setError(null);
    const loaded = await adminService.page(slug, pageLocale);
    setPage(loaded);
    setDraftSlug(loaded.slug);
    setContent(loaded.content);
    setSelectedId(loaded.content.blocks[0]?.id ?? null);
    setSaveState("saved");
    window.setTimeout(() => {
      bootstrappedRef.current = true;
    }, 0);
  }, [pageLocale, slug]);

  useEffect(() => {
    bootstrappedRef.current = false;
    void loadPage().catch((loadError) => {
      setError(loadError instanceof Error ? loadError.message : "Unable to load page");
      setSaveState("error");
    });
  }, [loadPage]);

  useEffect(() => {
    if (!bootstrappedRef.current || !pageTitle || !pageStatus) {
      return;
    }

    setSaveState("saving");
    const timer = window.setTimeout(() => {
      adminService
        .updatePage(slug, {
          locale: pageLocale,
          title: pageTitle,
          status: pageStatus,
          content,
        })
        .then((savedPage) => {
          setPage(savedPage);
          setSaveState("saved");
        })
        .catch((saveError) => {
          setError(saveError instanceof Error ? saveError.message : "Unable to save page");
          setSaveState("error");
        });
    }, 700);

    return () => window.clearTimeout(timer);
  }, [content, pageLocale, pageStatus, pageTitle, slug]);

  const updateSelectedProp = useCallback((key: string, value: string) => {
    setContent((current) => ({
      blocks: current.blocks.map((block) =>
        block.id === selectedId
          ? {
              ...block,
              props: {
                ...block.props,
                [key]: value,
              },
            }
          : block,
      ),
    }));
  }, [selectedId]);

  const addBlock = useCallback((type: BuilderBlockType) => {
    const block = createBlock(type);
    setContent((current) => ({ blocks: [...current.blocks, block] }));
    setSelectedId(block.id);
  }, []);

  const removeBlock = useCallback((id: string) => {
    setContent((current) => ({ blocks: current.blocks.filter((block) => block.id !== id) }));
    setSelectedId((current) => (current === id ? null : current));
  }, []);

  const duplicateBlock = useCallback((id: string) => {
    setContent((current) => {
      const index = current.blocks.findIndex((block) => block.id === id);
      if (index < 0) {
        return current;
      }
      const clone = { ...current.blocks[index], id: createId(), props: { ...current.blocks[index].props } };
      const blocks = [...current.blocks];
      blocks.splice(index + 1, 0, clone);
      setSelectedId(clone.id);
      return { blocks };
    });
  }, []);

  const moveBlock = useCallback((id: string, direction: -1 | 1) => {
    setContent((current) => {
      const index = current.blocks.findIndex((block) => block.id === id);
      const nextIndex = index + direction;
      if (index < 0 || nextIndex < 0 || nextIndex >= current.blocks.length) {
        return current;
      }
      const blocks = [...current.blocks];
      const [item] = blocks.splice(index, 1);
      blocks.splice(nextIndex, 0, item);
      return { blocks };
    });
  }, []);

  const viewportClass = viewport === "mobile" ? "max-w-[390px]" : viewport === "tablet" ? "max-w-[760px]" : "max-w-[1180px]";

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-primary">{t("admin.builder")}</p>
          <h1 className="mt-3 font-display text-4xl font-semibold md:text-5xl">{t("builder.title")}</h1>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-muted-foreground">{t("builder.subtitle")}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Badge variant={saveState === "error" ? "danger" : saveState === "saving" ? "trusted" : "success"}>
            {saveState === "saving" ? t("common.saving") : saveState === "saved" ? t("builder.autosaved") : saveState}
          </Badge>
          {page ? <Badge>{t("builder.savedVersion", { version: page.version })}</Badge> : null}
          <Button
            onClick={() => {
              if (!page) return;
              setSaveState("saving");
              void adminService
                .updatePage(slug, { locale: pageLocale, title: page.title, status: "PUBLISHED", content })
                .then((savedPage) => {
                  setPage(savedPage);
                  setSaveState("saved");
                });
            }}
          >
            <Save className="h-4 w-4" />
            {t("common.publish")}
          </Button>
        </div>
      </div>

      {error ? <p className="rounded-2xl border border-red-400/20 bg-red-400/10 p-4 text-sm text-red-200">{error}</p> : null}

      <div className="grid gap-4 xl:grid-cols-[260px_minmax(0,1fr)_320px]">
        <Card className="p-4">
          <div className="space-y-4">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">{t("admin.slug")}</p>
              <div className="mt-2 flex gap-2">
                <Input value={draftSlug} onChange={(event) => setDraftSlug(event.target.value.toLowerCase())} />
                <Button variant="outline" onClick={() => setSlug(draftSlug)}>
                  {t("common.edit")}
                </Button>
              </div>
            </div>
            {page ? (
              <>
                <div>
                  <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">{t("admin.pageTitle")}</p>
                  <Input
                    value={page.title}
                    onChange={(event) => setPage((current) => (current ? { ...current, title: event.target.value } : current))}
                    className="mt-2"
                  />
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">{t("admin.pageStatus")}</p>
                  <Select
                    value={page.status}
                    onValueChange={(value) =>
                      setPage((current) => (current ? { ...current, status: value as PageResponse["status"] } : current))
                    }
                  >
                    <SelectTrigger className="mt-2">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="DRAFT">DRAFT</SelectItem>
                      <SelectItem value="PUBLISHED">PUBLISHED</SelectItem>
                      <SelectItem value="ARCHIVED">ARCHIVED</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>
            ) : null}
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">{t("language.label")}</p>
              <Select value={pageLocale} onValueChange={(value) => setPageLocale(value as Locale)}>
                <SelectTrigger className="mt-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {supportedLocales.map((item) => (
                    <SelectItem key={item} value={item}>
                      {item.toUpperCase()}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">{t("builder.blocks")}</p>
              <div className="mt-3 grid gap-2">
                {blockTypes.map((item) => (
                  <Button key={item.type} variant="outline" className="justify-start" onClick={() => addBlock(item.type)}>
                    <Plus className="h-4 w-4" />
                    {t(item.labelKey)}
                  </Button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              {content.blocks.map((block) => (
                <button
                  key={block.id}
                  draggable
                  type="button"
                  onClick={() => setSelectedId(block.id)}
                  onDragStart={() => setDraggingId(block.id)}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={() => {
                    if (draggingId) {
                      setContent((current) => ({ blocks: reorderBlocks(current.blocks, draggingId, block.id) }));
                    }
                    setDraggingId(null);
                  }}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-2xl border px-3 py-3 text-left text-sm transition",
                    selectedId === block.id ? "border-primary/40 bg-primary/10 text-primary" : "border-white/8 bg-white/[0.03] text-muted-foreground hover:text-foreground",
                  )}
                >
                  <GripVertical className="h-4 w-4" />
                  <span className="capitalize">{block.type}</span>
                </button>
              ))}
            </div>
          </div>
        </Card>

        <Card className="min-h-[760px] p-0">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/8 p-4">
            <div>
              <p className="font-display text-xl font-semibold">{t("builder.canvas")}</p>
              <p className="text-sm text-muted-foreground">{t("builder.livePreview")}</p>
            </div>
            <div className="flex rounded-full border border-white/10 bg-white/[0.04] p-1">
              {[
                { value: "desktop", icon: Monitor, label: t("builder.desktop") },
                { value: "tablet", icon: Tablet, label: t("builder.tablet") },
                { value: "mobile", icon: Smartphone, label: t("builder.mobile") },
              ].map((item) => (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => setViewport(item.value as Viewport)}
                  className={cn(
                    "flex h-9 items-center gap-2 rounded-full px-3 text-xs transition",
                    viewport === item.value ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
                  )}
                  title={item.label}
                >
                  <item.icon className="h-4 w-4" />
                </button>
              ))}
            </div>
          </div>
          <div className="overflow-auto p-4">
            <div className={cn("mx-auto overflow-hidden rounded-[1.5rem] border border-white/10 bg-[#071016] shadow-glow transition-all", viewportClass)}>
              {content.blocks.length === 0 ? (
                <div className="flex min-h-[420px] items-center justify-center p-8 text-center text-sm text-muted-foreground">{t("builder.empty")}</div>
              ) : (
                content.blocks.map((block) => <PreviewBlock key={block.id} block={block} />)
              )}
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="font-display text-xl font-semibold">{t("builder.inspector")}</p>
              <p className="text-sm text-muted-foreground">{selectedBlock ? t("builder.selectedBlock") : t("builder.noSelection")}</p>
            </div>
            {selectedBlock ? <Badge>{selectedBlock.type}</Badge> : null}
          </div>

          {selectedBlock ? (
            <div className="space-y-4">
              <label className="block space-y-2">
                <span className="text-xs uppercase tracking-[0.22em] text-muted-foreground">{t("builder.eyebrow")}</span>
                <Input value={stringProp(selectedBlock, "eyebrow")} onChange={(event) => updateSelectedProp("eyebrow", event.target.value)} />
              </label>
              <label className="block space-y-2">
                <span className="text-xs uppercase tracking-[0.22em] text-muted-foreground">{t("builder.headline")}</span>
                <Textarea value={stringProp(selectedBlock, "headline")} onChange={(event) => updateSelectedProp("headline", event.target.value)} />
              </label>
              <label className="block space-y-2">
                <span className="text-xs uppercase tracking-[0.22em] text-muted-foreground">{t("builder.body")}</span>
                <Textarea value={stringProp(selectedBlock, "body")} onChange={(event) => updateSelectedProp("body", event.target.value)} />
              </label>
              {(selectedBlock.type === "hero" || selectedBlock.type === "cta") ? (
                <div className="grid gap-3">
                  <label className="block space-y-2">
                    <span className="text-xs uppercase tracking-[0.22em] text-muted-foreground">{t("builder.buttonLabel")}</span>
                    <Input value={stringProp(selectedBlock, "buttonLabel")} onChange={(event) => updateSelectedProp("buttonLabel", event.target.value)} />
                  </label>
                  <label className="block space-y-2">
                    <span className="text-xs uppercase tracking-[0.22em] text-muted-foreground">{t("builder.buttonHref")}</span>
                    <Input value={stringProp(selectedBlock, "buttonHref")} onChange={(event) => updateSelectedProp("buttonHref", event.target.value)} />
                  </label>
                </div>
              ) : null}
              {selectedBlock.type === "hero" ? (
                <label className="block space-y-2">
                  <span className="text-xs uppercase tracking-[0.22em] text-muted-foreground">{t("builder.imageUrl")}</span>
                  <Input value={stringProp(selectedBlock, "imageUrl")} onChange={(event) => updateSelectedProp("imageUrl", event.target.value)} />
                </label>
              ) : null}
              <label className="block space-y-2">
                <span className="text-xs uppercase tracking-[0.22em] text-muted-foreground">{t("builder.accent")}</span>
                <Select value={stringProp(selectedBlock, "accent") || "cyan"} onValueChange={(value) => updateSelectedProp("accent", value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cyan">Cyan</SelectItem>
                    <SelectItem value="amber">Amber</SelectItem>
                    <SelectItem value="emerald">Emerald</SelectItem>
                  </SelectContent>
                </Select>
              </label>

              <div className="grid grid-cols-2 gap-2 pt-2">
                <Button variant="outline" onClick={() => moveBlock(selectedBlock.id, -1)}>
                  <ArrowUp className="h-4 w-4" />
                  {t("builder.moveUp")}
                </Button>
                <Button variant="outline" onClick={() => moveBlock(selectedBlock.id, 1)}>
                  <ArrowDown className="h-4 w-4" />
                  {t("builder.moveDown")}
                </Button>
                <Button variant="outline" onClick={() => duplicateBlock(selectedBlock.id)}>
                  <Copy className="h-4 w-4" />
                  {t("builder.duplicate")}
                </Button>
                <Button variant="destructive" onClick={() => removeBlock(selectedBlock.id)}>
                  <Trash2 className="h-4 w-4" />
                  {t("common.delete")}
                </Button>
              </div>
            </div>
          ) : null}
        </Card>
      </div>
    </div>
  );
}

export default function BuilderPage() {
  return (
    <AdminGuard>
      <BuilderContent />
    </AdminGuard>
  );
}
