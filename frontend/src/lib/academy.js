import { api } from "@/lib/api";

let cache = null;
let pending = null;

export async function getAcademy() {
  if (cache) return cache;
  if (pending) return pending;
  pending = api.get("/academy/settings").then((r) => {
    cache = r.data || {};
    pending = null;
    return cache;
  }).catch(() => {
    pending = null;
    return {};
  });
  return pending;
}

export function invalidateAcademy() {
  cache = null;
}
