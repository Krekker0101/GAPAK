import { useNavigate as rrUseNavigate, useLocation as rrUseLocation, useParams as rrUseParams } from 'react-router-dom';

export function useRouter() {
  const navigate = rrUseNavigate();
  return {
    push: (p: any) => navigate(p),
    replace: (p: any, _options?: any) => navigate(p, { replace: true }),
    back: () => navigate(-1),
  };
}

export function redirect(path: string) {
  // client-side redirect
  window.location.href = path;
}

export function usePathname() {
  return rrUseLocation().pathname;
}

export function useSearchParams() {
  const search = rrUseLocation().search;
  return new URLSearchParams(search);
}

export const useParams = rrUseParams;
