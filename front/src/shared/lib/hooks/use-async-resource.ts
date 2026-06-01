"use client";

import { startTransition, useCallback, useEffect, useRef, useState } from "react";

import { ApiError } from "@/shared/types/api";

type AsyncStatus = "idle" | "loading" | "success" | "error";

type AsyncResourceState<T> = {
  status: AsyncStatus;
  data: T | null;
  error: ApiError | Error | null;
};

export function useAsyncResource<T>(loader: () => Promise<T>, deps: readonly unknown[] = []) {
  const loaderRef = useRef(loader);
  const [state, setState] = useState<AsyncResourceState<T>>({
    status: "loading",
    data: null,
    error: null,
  });

  loaderRef.current = loader;

  const execute = useCallback(async () => {
    setState((current) => ({
      ...current,
      status: current.data ? "success" : "loading",
      error: null,
    }));

    try {
      const result = await loaderRef.current();
      startTransition(() => {
        setState({
          status: "success",
          data: result,
          error: null,
        });
      });
    } catch (error) {
      startTransition(() => {
        setState({
          status: "error",
          data: null,
          error: error instanceof Error ? error : new Error("Unexpected error"),
        });
      });
    }
  }, []);

  useEffect(() => {
    void execute();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [execute, ...deps]);

  return {
    ...state,
    reload: execute,
    isLoading: state.status === "loading",
    isError: state.status === "error",
    isSuccess: state.status === "success",
  };
}
