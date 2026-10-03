import fs from "node:fs";
import path from "node:path";

// Petit stockage dans des fichiers JSON (dossier `backend/.data`, ignoré par git).
// Il garde l'abonnement et les paiements quand le serveur redémarre. C'est suffisant pour la démo ;
// en production, ces données iront dans Supabase.
export function dataDir() {
  return process.env.SHIFTSAVER_DATA_DIR || path.join(process.cwd(), ".data");
}

export function readStore<T>(name: string, fallback: () => T): T {
  try {
    return JSON.parse(fs.readFileSync(path.join(dataDir(), name), "utf8")) as T;
  } catch {
    return fallback(); // fichier absent ou illisible : on repart de zéro
  }
}

export function writeStore<T>(name: string, value: T) {
  fs.mkdirSync(dataDir(), { recursive: true });
  const file = path.join(dataDir(), name);
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(value, null, 2));
  fs.renameSync(tmp, file); // écriture atomique
}
