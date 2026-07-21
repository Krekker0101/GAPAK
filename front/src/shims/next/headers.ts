export async function headers() {
  return {
    get: (name: string) => {
      if (name.toLowerCase() === 'accept-language') {
        try {
          return navigator.language || (navigator.languages && navigator.languages[0]) || null;
        } catch {
          return null;
        }
      }
      return null;
    },
  };
}

export async function cookies() {
  return {
    get: (name: string) => {
      try {
        const raw = document.cookie
          .split(';')
          .map((p) => p.trim())
          .find((p) => p.startsWith(name + '='));
        if (!raw) return undefined;
        const value = raw.slice(name.length + 1);
        return { value: decodeURIComponent(value) };
      } catch {
        return undefined;
      }
    },
  };
}
