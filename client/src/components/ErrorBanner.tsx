import "./ErrorBanner.css";

interface Props {
  message: string;
}

export default function ErrorBanner({ message }: Props) {
  return (
    <div role="alert" className="error-banner">
      <strong>Invalid JSON</strong>
      <br />
      {message}
    </div>
  );
}
