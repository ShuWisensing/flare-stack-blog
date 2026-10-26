import { HubDiagnosticsSchema } from "../schema/personal-ai-hub.schema";

export function HubErrorNotice({
  error,
  retry,
}: {
  error: Error | null;
  retry?: () => void;
}) {
  const detail =
    error && "diagnostics" in error
      ? HubDiagnosticsSchema.safeParse(error.diagnostics)
      : null;
  return error ? (
    <div role="alert" className="hub-error">
      {error.message}
      {detail?.success && (
        <details>
          <summary>连接诊断</summary>
          <p>
            {detail.data.method} · {detail.data.native_code}
          </p>
          <p>{detail.data.upstream_message}</p>
        </details>
      )}
      {retry && (
        <button type="button" onClick={retry}>
          重试读取
        </button>
      )}
    </div>
  ) : null;
}
