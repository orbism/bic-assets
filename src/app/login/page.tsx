import LoginForm from "@/components/LoginForm";

export default function LoginPage() {
  return (
    <div className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-4 py-10">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">
          BIC<span className="text-muted"> Asset Tracker</span>
        </h1>
        <p className="mt-1 text-sm text-muted">
          Records of provenance for onchain artefacts.
        </p>
      </div>
      <LoginForm />
    </div>
  );
}
