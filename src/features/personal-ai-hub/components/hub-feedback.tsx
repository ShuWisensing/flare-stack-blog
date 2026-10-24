export function HubErrorNotice({
  error,
  retry,
}: {
  error: Error | null;
  retry?: () => void;
}) {
  return error ? (
    <div role="alert" className="hub-error">
      {error.message}
      {retry && (
        <button type="button" onClick={retry}>
          重试读取
        </button>
      )}
    </div>
  ) : null;
}
