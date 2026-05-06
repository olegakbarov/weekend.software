import { useEffect, useState } from "react";
import { getRouteFromHash } from "../routes";

export function useHashRoute(): readonly [string, (id: string) => void] {
  const [route, setRoute] = useState<string>(getRouteFromHash);

  useEffect(() => {
    const onHash = (): void => setRoute(getRouteFromHash());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const navigate = (id: string): void => {
    history.pushState(null, "", `#/${id}`);
    setRoute(id);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return [route, navigate];
}
