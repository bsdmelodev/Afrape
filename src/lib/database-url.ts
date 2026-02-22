type DatabaseEnv = {
  readonly [key: string]: string | undefined;
  POSTGRES_DB?: string;
  POSTGRES_USER?: string;
  POSTGRES_PASSWORD?: string;
  POSTGRES_HOST?: string;
  POSTGRES_PORT?: string;
  POSTGRES_SSLMODE?: string;
};

function normalize(value?: string) {
  return value?.trim();
}

export function resolveDatabaseUrl(source: DatabaseEnv): string {
  const database = normalize(source.POSTGRES_DB);
  const user = normalize(source.POSTGRES_USER);
  const password = normalize(source.POSTGRES_PASSWORD);
  const host = normalize(source.POSTGRES_HOST) || "db";
  const port = normalize(source.POSTGRES_PORT) || "5432";
  const sslmode = normalize(source.POSTGRES_SSLMODE) || "disable";

  if (!database || !user || !password) {
    const missing: string[] = [];
    if (!database) missing.push("POSTGRES_DB");
    if (!user) missing.push("POSTGRES_USER");
    if (!password) missing.push("POSTGRES_PASSWORD");

    throw new Error(
      `Variáveis obrigatórias não definidas: ${missing.join(", ")}`
    );
  }

  const credentials = `${encodeURIComponent(user)}:${encodeURIComponent(password)}`;
  const params = new URLSearchParams({ sslmode });

  return `postgresql://${credentials}@${host}:${port}/${encodeURIComponent(database)}?${params.toString()}`;
}
