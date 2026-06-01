import { NextResponse, type NextRequest } from "next/server";

import { serverEnv } from "@/shared/config/env";

export const runtime = "nodejs";

function buildUpstreamUrl(request: NextRequest, path: string[]) {
  const backendUrl = serverEnv.backendUrl.replace(/\/+$/, "");
  const apiPrefix = serverEnv.backendApiPrefix.replace(/^\/?/, "/").replace(/\/+$/, "");
  const encodedPath = path.map((segment) => encodeURIComponent(segment)).join("/");
  const url = new URL(`${backendUrl}${apiPrefix}/${encodedPath}`);
  url.search = request.nextUrl.search;
  return url;
}

async function proxy(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  const upstreamUrl = buildUpstreamUrl(request, path);
  const headers = new Headers(request.headers);

  headers.delete("host");
  headers.delete("connection");
  headers.delete("content-length");

  const csrfToken = request.cookies.get(serverEnv.csrfCookieName)?.value;
  if (csrfToken && !headers.has("x-csrf-token")) {
    headers.set("x-csrf-token", csrfToken);
  }

  const upstream = await fetch(upstreamUrl, {
    method: request.method,
    headers,
    body: request.method === "GET" || request.method === "HEAD" ? undefined : request.body,
    duplex: "half",
    redirect: "manual",
  } as RequestInit & { duplex: "half" });

  const responseHeaders = new Headers();
  upstream.headers.forEach((value, key) => {
    if (key.toLowerCase() !== "set-cookie") {
      responseHeaders.set(key, value);
    }
  });

  const upstreamHeaders = upstream.headers as Headers & {
    getSetCookie?: () => string[];
  };

  const rawSetCookies =
    typeof upstreamHeaders.getSetCookie === "function"
      ? upstreamHeaders.getSetCookie()
      : upstream.headers.get("set-cookie")
        ? [upstream.headers.get("set-cookie") as string]
        : [];

  rawSetCookies.forEach((cookie) => responseHeaders.append("set-cookie", cookie));

  return new NextResponse(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: responseHeaders,
  });
}

export async function GET(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  return proxy(request, context);
}

export async function POST(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  return proxy(request, context);
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  return proxy(request, context);
}

export async function PUT(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  return proxy(request, context);
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  return proxy(request, context);
}
